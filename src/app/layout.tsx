import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"PreSign — Simulate before you sign",description:"Understand what an EVM transaction is likely to do before signing. Read-only, no wallet connection, no private keys."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
