import { RpcFallbackProvider } from "@/lib/providers/rpc";
import { TenderlySimulationProvider } from "@/lib/providers/simulation-api";
import type { SimulateInput } from "@/lib/schemas";
import type { SimulationResult } from "@/lib/providers/types";
export async function simulate(input:SimulateInput):Promise<SimulationResult> {
 const rpc=new RpcFallbackProvider();
 if (process.env.TENDERLY_ACCESS_KEY && process.env.TENDERLY_ACCOUNT_SLUG && process.env.TENDERLY_PROJECT_SLUG) {
  try { return await new TenderlySimulationProvider().simulate(input); }
  catch { /* API failure or quota: automatically fall back to public RPC. */ }
 }
 return rpc.simulate(input);
}
