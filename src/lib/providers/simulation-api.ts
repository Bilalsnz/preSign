import type { SimulateInput } from "@/lib/schemas";
import type { SimulationProvider, SimulationResult } from "./types";
export class TenderlySimulationProvider implements SimulationProvider {
 async simulate(input:SimulateInput):Promise<SimulationResult> {
  const account=process.env.TENDERLY_ACCOUNT_SLUG, project=process.env.TENDERLY_PROJECT_SLUG, key=process.env.TENDERLY_ACCESS_KEY;
  if (!account || !project || !key) throw new Error("Simulation API is not configured");
  const response=await fetch(`https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`,{method:"POST",headers:{"content-type":"application/json","X-Access-Key":key},body:JSON.stringify({network_id:String(input.chainId),from:input.from,to:input.to,input:input.data,value:BigInt(Math.round(Number(input.value)*1e18)).toString(),save:false,save_if_fails:false}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Simulation API unavailable (${response.status})`);
  const raw=await response.json();
  const failed=Boolean(raw?.transaction?.error || raw?.simulation?.status === false || raw?.transaction?.status === false);
  const error=raw?.transaction?.error_message || raw?.transaction?.error || raw?.simulation?.error_message;
  return {status:failed?"revert":"success",summary:failed?String(error || "The contract reverted during simulation."):"The call completed successfully on the simulator's current state.",revertReason:failed?String(error || ""):undefined,gasEstimate:String(raw?.transaction?.gas_used ?? raw?.transaction?.gas ?? ""),assetChanges:[],source:"simulator",raw};
 }
}
