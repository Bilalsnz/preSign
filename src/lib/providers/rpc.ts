import { createPublicClient, http, parseEther, parseAbi, formatUnits } from "viem";
import { chains } from "@/lib/chains";
import { decodeRevert, friendlyFailure } from "@/lib/revert";
import type { SimulationProvider, SimulationResult } from "./types";
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)","function allowance(address,address) view returns (uint256)","function decimals() view returns (uint8)","function symbol() view returns (string)"]);
export class RpcFallbackProvider implements SimulationProvider {
 async simulate(input: import("@/lib/schemas").SimulateInput): Promise<SimulationResult> {
  const chain = chains[input.chainId];
  const client = createPublicClient({ transport: http(chain.rpc, { timeout: 12000 }) });
  const tx = { account: input.from as `0x${string}`, to: input.to as `0x${string}`, data: input.data as `0x${string}`, value: parseEther(input.value) };
  const warnings:string[]=[];
  const selector=input.data.slice(0,10).toLowerCase();
  let assetChanges:SimulationResult["assetChanges"] = [];
  try {
   if (selector === "0x095ea7b3" || selector === "0xa9059cbb" || selector === "0x23b872dd") {
    const [balance, decimals, symbol] = await Promise.all([
     client.readContract({address:tx.to,abi:erc20,functionName:"balanceOf",args:[tx.account]}),
     client.readContract({address:tx.to,abi:erc20,functionName:"decimals"}),
     client.readContract({address:tx.to,abi:erc20,functionName:"symbol"}),
    ]);
    if (selector === "0x095ea7b3") {
      const spender = (("0x"+input.data.slice(34,74)) as `0x${string}`);
      const allowance = await client.readContract({address:tx.to,abi:erc20,functionName:"allowance",args:[tx.account,spender]});
      warnings.push(`Current allowance: ${formatUnits(allowance,decimals)} ${symbol}.`);
    } else if (selector === "0xa9059cbb" || selector === "0x23b872dd") warnings.push(`Current sender balance: ${formatUnits(balance,decimals)} ${symbol}.`);
   }
  } catch { warnings.push("Token pre-checks were unavailable; the token may not expose standard ERC-20 read methods."); }
  try {
   const [gasEstimate] = await Promise.all([client.estimateGas(tx)]);
   await client.call(tx);
   return { status:"success", summary:"The call completed successfully on the selected network's current state. This does not guarantee the transaction will succeed later.", gasEstimate:gasEstimate.toString(), assetChanges, source:"rpc-fallback", warnings, raw:{ chainId:input.chainId, simulatedWith:"eth_call + eth_estimateGas" } };
  } catch (error) {
   const e=error as {message?:string;cause?:{data?:string};data?:string};
   const raw=e.cause?.data || e.data;
   const decoded=decodeRevert(raw);
   const message=e.message || "Simulation failed";
   return { status:"revert", summary:raw ? decoded.summary : friendlyFailure(message), revertReason:decoded.reason, source:"rpc-fallback", warnings, raw:{ message, revertData:raw } };
  }
 }
}
