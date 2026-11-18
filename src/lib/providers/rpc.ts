import { createPublicClient, http, parseEther, parseAbi, formatUnits } from "viem";
import { chains } from "@/lib/chains";
import { decodeRevert, friendlyFailure } from "@/lib/revert";
import type { SimulationProvider, SimulationResult } from "./types";

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Simulation service unavailable";
}

function isExecutionRevert(message: string): boolean {
  return /execution reverted|transaction reverted|reverted with|revert reason|panic\(|custom error/i.test(message);
}

function isInsufficientFunds(message: string): boolean {
  return /insufficient funds|insufficient balance|not enough funds|funds for gas|exceeds the balance|sender balance/i.test(message);
}

export class RpcFallbackProvider implements SimulationProvider {
  async simulate(input: import("@/lib/schemas").SimulateInput): Promise<SimulationResult> {
    const chain = chains[input.chainId];
    const client = createPublicClient({
      transport: http(chain.rpc, { timeout: 12000 }),
    });

    const tx = {
      account: input.from as `0x${string}`,
      to: input.to as `0x${string}`,
      data: input.data as `0x${string}`,
      value: parseEther(input.value),
    };

    const warnings: string[] = [];
    const selector = input.data.slice(0, 10).toLowerCase();
    const assetChanges: SimulationResult["assetChanges"] = [];

    // ERC-20 metadata/allowance checks are advisory. A failure here must not
    // prevent the actual transaction simulation.
    try {
      if (selector === "0x23b872dd" && input.data.length >= 202) {
        const owner = ("0x" + input.data.slice(34, 74)) as `0x${string}`;
        const requiredAllowance = BigInt("0x" + input.data.slice(138, 202));
        const [decimals, symbol, allowance] = await Promise.all([
          client.readContract({ address: tx.to, abi: erc20, functionName: "decimals" }),
          client.readContract({ address: tx.to, abi: erc20, functionName: "symbol" }),
          client.readContract({ address: tx.to, abi: erc20, functionName: "allowance", args: [owner, tx.account] }),
        ]);
        const missingAllowance = requiredAllowance > allowance ? requiredAllowance - allowance : BigInt(0);
        warnings.push(`Current allowance for this spender: ${formatUnits(allowance, decimals)} ${symbol}.`);
        if (missingAllowance > BigInt(0)) {
          return {
            status: "revert",
            summary: `The spender lacks allowance to transfer ${formatUnits(requiredAllowance, decimals)} ${symbol}. Current allowance: ${formatUnits(allowance, decimals)} ${symbol}. Missing allowance: ${formatUnits(missingAllowance, decimals)} ${symbol}.`,
            revertReason: "Insufficient ERC-20 allowance",
            assetChanges,
            source: "rpc-fallback",
            warnings,
            raw: {
              chainId: input.chainId,
              token: tx.to,
              symbol,
              owner,
              spender: tx.account,
              requiredAllowance: requiredAllowance.toString(),
              currentAllowance: allowance.toString(),
              missingAllowance: missingAllowance.toString(),
              simulatedWith: "ERC-20 allowance pre-check",
            },
          };
        }
      } else if (selector === "0x095ea7b3" || selector === "0xa9059cbb") {
        const [balance, decimals, symbol] = await Promise.all([
          client.readContract({ address: tx.to, abi: erc20, functionName: "balanceOf", args: [tx.account] }),
          client.readContract({ address: tx.to, abi: erc20, functionName: "decimals" }),
          client.readContract({ address: tx.to, abi: erc20, functionName: "symbol" }),
        ]);
        if (selector === "0x095ea7b3") {
          const spender = ("0x" + input.data.slice(34, 74)) as `0x${string}`;
          const allowance = await client.readContract({
            address: tx.to,
            abi: erc20,
            functionName: "allowance",
            args: [tx.account, spender],
          });
          warnings.push(`Current allowance: ${formatUnits(allowance, decimals)} ${symbol}.`);
        } else {
          warnings.push(`Current sender balance: ${formatUnits(balance, decimals)} ${symbol}.`);
        }
      }
    } catch {
      warnings.push("Token pre-checks were unavailable; the token may not expose standard ERC-20 read methods.");
    }

    try {
      // eth_estimateGas can succeed even when the sender cannot afford the
      // transaction: eth_call/estimateGas do not consistently enforce the
      // sender's real ETH balance. Check value + maximum quoted gas cost
      // explicitly before reporting success.
      const [gasEstimate, balance, feeQuote] = await Promise.all([
        client.estimateGas(tx),
        client.getBalance({ address: tx.account }),
        client.estimateFeesPerGas(),
      ]);

      const feePerGas = feeQuote.maxFeePerGas ?? feeQuote.gasPrice;
      if (feePerGas === undefined) {
        throw new Error("The RPC did not provide a usable gas price quote.");
      }

      const estimatedFee = gasEstimate * feePerGas;
      const requiredBalance = tx.value + estimatedFee;

      if (balance < requiredBalance) {
        const shortfall = requiredBalance - balance;
        return {
          status: "revert",
          summary: "The sender does not have enough ETH to cover the transaction value and estimated network fee.",
          revertReason: "Insufficient ETH balance",
          gasEstimate: gasEstimate.toString(),
          assetChanges,
          source: "rpc-fallback",
          warnings,
          raw: {
            chainId: input.chainId,
            senderBalanceWei: balance.toString(),
            transactionValueWei: tx.value.toString(),
            estimatedGas: gasEstimate.toString(),
            estimatedFeeWei: estimatedFee.toString(),
            requiredBalanceWei: requiredBalance.toString(),
            shortfallWei: shortfall.toString(),
            simulatedWith: "eth_getBalance + eth_estimateGas + eth_call",
          },
        };
      }

      await client.call(tx);

      return {
        status: "success",
        summary: "The call completed successfully and the sender's current ETH balance appears sufficient for the transaction value and estimated network fee. This does not guarantee the transaction will succeed later.",
        gasEstimate: gasEstimate.toString(),
        assetChanges,
        source: "rpc-fallback",
        warnings,
        raw: {
          chainId: input.chainId,
          senderBalanceWei: balance.toString(),
          estimatedFeeWei: estimatedFee.toString(),
          simulatedWith: "eth_getBalance + eth_estimateGas + eth_call",
        },
      };
    } catch (error) {
      const message = errorMessage(error);
      const e = error as { cause?: { data?: string }; data?: string };
      const revertData = e?.cause?.data || e?.data;
      const decoded = decodeRevert(revertData);

      if (isExecutionRevert(message) || isInsufficientFunds(message)) {
        return {
          status: "revert",
          summary: revertData ? decoded.summary : isExecutionRevert(message) ? "Unknown reason. Raw revert data was not provided by the RPC." : friendlyFailure(message),
          revertReason: decoded.reason || (isInsufficientFunds(message) ? "Insufficient ETH balance" : undefined),
          source: "rpc-fallback",
          warnings,
          raw: { message, revertData },
        };
      }

      // Network, provider, timeout, and unexpected client errors are not
      // evidence that the transaction itself would revert.
      return {
        status: "error",
        summary: "The simulation service could not complete the request. This is an RPC/provider error, not a confirmed transaction revert.",
        source: "rpc-fallback",
        warnings,
        raw: { message },
      };
    }
  }
}
