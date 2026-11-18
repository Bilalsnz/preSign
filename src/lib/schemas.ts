import { z } from "zod";
export const simulateSchema = z.object({
  chainId: z.union([z.literal(1), z.literal(8453), z.literal(42161), z.literal(10)]),
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid from address"),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid to address"),
  data: z.string().regex(/^0x(?:[a-fA-F0-9]{2})*$/, "Calldata must be even-length hex beginning with 0x").max(200000, "Calldata is too large"),
  value: z.string().regex(/^(?:\d+)?(?:\.\d{0,18})?$/, "Enter a valid ETH amount").refine(v => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0, "Value must be zero or greater"),
});
export type SimulateInput = z.infer<typeof simulateSchema>;
