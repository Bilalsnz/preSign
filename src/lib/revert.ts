import { decodeErrorResult, parseAbi } from "viem";
const errors = parseAbi(["error Error(string)","error Panic(uint256)"]);
export function decodeRevert(raw?: string) {
  if (!raw || !/^0x[0-9a-fA-F]{8}/.test(raw)) return { reason: undefined, summary: raw ? `Unknown reason. Raw revert data: ${raw}` : "Unknown reason. Raw revert data was not provided by the RPC." };
  const selector = raw.slice(0,10).toLowerCase();
  const common: Record<string,string> = {
    "0x08c379a0": "The contract rejected the transaction.",
    "0x4e487b71": "The contract hit a Solidity panic (for example, an arithmetic or bounds check).",
  };
  try {
    const decoded = decodeErrorResult({ abi: errors, data: raw as `0x${string}` });
    if (decoded.errorName === "Error") {
      const reason = String(decoded.args[0] ?? "");
      const lower = reason.toLowerCase();
      if (/allowance|approved/.test(lower)) return { reason, summary: "The token allowance is too low. Approve the spender for a larger amount, then retry." };
      if (/balance|insufficient/.test(lower)) return { reason, summary: "The sender does not have enough tokens or ETH to complete this transaction." };
      if (/zero address|address zero|invalid recipient/.test(lower)) return { reason, summary: "The contract does not allow sending to the zero address." };
      if (/paused|when not paused/.test(lower)) return { reason, summary: "This contract is paused and is not accepting this action right now." };
      return { reason, summary: reason || common[selector] };
    }
    const code = BigInt(decoded.args[0] as bigint);
    const panicNames: Record<string,string> = { "17":"arithmetic overflow or underflow", "18":"division by zero", "33":"invalid enum conversion", "50":"an out-of-bounds array access", "65":"memory allocation overflow" };
    return { reason: `Panic(0x${code.toString(16)})`, summary: `The contract encountered a Solidity panic: ${panicNames[code.toString()] || "an internal safety check failed"}.` };
  } catch { return { reason: raw, summary: `Unknown reason. Raw revert data: ${raw}` }; }
}
export function friendlyFailure(message: string) {
  const m = message.toLowerCase();
  if (/out of gas|gas required exceeds allowance/.test(m)) return "The transaction appears to need more gas than the network will allow.";
  if (/allowance/.test(m)) return "The token allowance is too low. Approve the spender before retrying.";
  if (/insufficient funds|balance/.test(m)) return "The sender may not have enough ETH or tokens to complete this transaction.";
  if (/zero address/.test(m)) return "The contract does not allow the zero address for this action.";
  if (/paused/.test(m)) return "This contract is paused and is not accepting this action right now.";
  return "The transaction could not be simulated. Review the raw details before proceeding.";
}
