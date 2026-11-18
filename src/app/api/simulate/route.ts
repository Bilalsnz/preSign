import { NextRequest, NextResponse } from "next/server";
import { simulateSchema } from "@/lib/schemas";
import { simulate } from "@/lib/simulate";
export const runtime="nodejs";
const hits=new Map<string,{count:number;reset:number}>();
function allowed(ip:string){const now=Date.now();const entry=hits.get(ip);if(!entry||entry.reset<now){hits.set(ip,{count:1,reset:now+60_000});return true;}if(entry.count>=12)return false;entry.count++;return true;}
export async function POST(request:NextRequest){
 const ip=(request.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();
 if(!allowed(ip))return NextResponse.json({status:"error",summary:"Too many simulations. Please wait a minute and try again.",source:"rpc-fallback"},{status:429});
 try {const body=await request.json();const parsed=simulateSchema.safeParse(body);if(!parsed.success)return NextResponse.json({status:"error",summary:parsed.error.issues[0]?.message||"Invalid input",source:"rpc-fallback"},{status:400});
 const result=await simulate(parsed.data);return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){return NextResponse.json({status:"error",summary:error instanceof Error?error.message:"Simulation service unavailable",source:"rpc-fallback"},{status:502});}
}
