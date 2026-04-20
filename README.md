# CertiChain Web App

Next.js 16 application for issuing and verifying blockchain-backed certificates.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict mode)
- Ethers.js

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file from template:

```bash
copy .env.example .env.local
```

3. Start development server:

```bash
npm run dev
```

4. Open:

- http://localhost:3000

## Environment Variables

Required public env vars:

- `NEXT_PUBLIC_SEPOLIA_RPC_URL`: Sepolia RPC endpoint used for on-chain verification.

If not set, app falls back to a public Sepolia endpoint.

## Pre-push Checklist

Run these commands before pushing to GitHub:

```bash
npm run lint
npm run build
```

Both commands must pass.

## Deploy to Vercel

1. Push repository to GitHub.
2. Import the repo in Vercel.
3. In Project Settings -> Environment Variables, set:
	- `NEXT_PUBLIC_SEPOLIA_RPC_URL`
4. Deploy.

Build command: `npm run build`

Output: Next.js default output (auto-detected by Vercel).

## Important Production Note

`app/api/certificates/route.ts` currently stores certificate metadata in memory (`Map`).

On Vercel serverless runtime, in-memory data is not persistent across instances/restarts.
For production persistence, replace this with a database (for example Postgres, MongoDB, or KV).
