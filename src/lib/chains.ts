import { defineChain } from "viem";
export const chains = {
  1: { id: 1, name: "Ethereum", rpc: process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io" },
  8453: { id: 8453, name: "Base", rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org", explorer: "https://basescan.org" },
  42161: { id: 42161, name: "Arbitrum", rpc: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io" },
  10: { id: 10, name: "Optimism", rpc: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io", explorer: "https://optimistic.etherscan.io" },
} as const;
export type SupportedChainId = keyof typeof chains;
export const isSupportedChain = (id: number): id is SupportedChainId => id in chains;
