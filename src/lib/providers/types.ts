import type { SimulateInput } from "@/lib/schemas";
export type SimulationResult = { status:"success"|"revert"|"error"; summary:string; revertReason?:string; gasEstimate?:string; assetChanges?:{token:string;symbol:string;amount:string;direction:"in"|"out"}[]; source:"simulator"|"rpc-fallback"; raw?:unknown; warnings?:string[] };
export interface SimulationProvider { simulate(input: SimulateInput): Promise<SimulationResult> }
