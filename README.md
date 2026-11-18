# PreSign

**Simulate an EVM transaction before signing.** PreSign is a free, mobile-first, read-only transaction preview for Ethereum, Base, Arbitrum and Optimism.

## Features
- Address, calldata and ETH value validation
- Read-only `eth_call` + `eth_estimateGas` RPC fallback
- Optional server-side Tenderly Simulation API adapter; automatically falls back to public RPC on errors/quota exhaustion
- Solidity `Error(string)` and `Panic(uint256)` revert decoding with plain-English explanations
- ERC-20 approve/transfer/transferFrom pre-checks where standard read methods are available
- In-memory per-IP rate limit (12 requests/minute per running instance)
- No wallet connection, private keys, seed phrases, database, or transaction broadcasting

> Simulation is a prediction, not a guarantee. State, gas prices, block conditions and mempool ordering can change before a transaction is included.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. No environment variables are required for RPC fallback. Optional Tenderly credentials are configured only on the server:

- `TENDERLY_ACCOUNT_SLUG`
- `TENDERLY_PROJECT_SLUG`
- `TENDERLY_ACCESS_KEY`

Never prefix secrets with `NEXT_PUBLIC_`.

## API examples

### 1. Simple ETH transfer (Base)
```bash
curl -X POST http://localhost:3000/api/simulate \\
  -H 'content-type: application/json' \\
  -d '{"chainId":8453,"from":"0x0000000000000000000000000000000000000001","to":"0x0000000000000000000000000000000000000002","data":"0x","value":"0.001"}'
```

### 2. ERC-20 approve (Ethereum)
```bash
curl -X POST http://localhost:3000/api/simulate \\
  -H 'content-type: application/json' \\
  -d '{"chainId":1,"from":"0x0000000000000000000000000000000000000001","to":"0x0000000000000000000000000000000000000002","data":"0x095ea7b300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001","value":"0"}'
```

### 3. Contract call with calldata (Arbitrum)
```bash
curl -X POST http://localhost:3000/api/simulate \\
  -H 'content-type: application/json' \\
  -d '{"chainId":42161,"from":"0x0000000000000000000000000000000000000001","to":"0x0000000000000000000000000000000000000002","data":"0x12345678","value":"0"}'
```

All addresses above are placeholders; use real addresses and calldata for meaningful results. API response shape:
```json
{"status":"success","summary":"The call completed successfully...","gasEstimate":"21000","assetChanges":[],"source":"rpc-fallback"}
```

## Architecture

- `src/lib/providers/types.ts`: swappable `SimulationProvider` interface
- `src/lib/providers/rpc.ts`: public RPC fallback and ERC-20 pre-checks
- `src/lib/providers/simulation-api.ts`: optional Tenderly adapter
- `src/lib/revert.ts`: revert decoding and friendly messages
- `src/app/api/simulate/route.ts`: validated, rate-limited API endpoint

## Deploy to Vercel

Import this repository into Vercel and deploy with the default Next.js settings. The app works without paid services or environment variables. Add optional Tenderly environment variables in Project Settings → Environment Variables if desired. The in-memory rate limit is best-effort per serverless instance; use Vercel Firewall or a shared store if you later need globally coordinated limits.

## Screenshots

Add current desktop and mobile screenshots here after deploying, for example `docs/screenshots/mobile.png` and `docs/screenshots/desktop.png`.

## Safety

PreSign only reads public chain state. It does not connect to wallets, request secrets, sign, submit, or broadcast transactions. A successful simulation cannot guarantee future execution.
