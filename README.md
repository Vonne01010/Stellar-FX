# Stellar FX
Stellar FX is a Stellar-powered cross-border payroll system that lets BPO companies pay offshore Filipino staff by receiving USD-denominated funds from clients and automatically converting and disbursing them as PHP directly into staff wallets.

## Problem
BPO companies frequently serve offshore clients who pay for services in USD, while their Filipino staff need to be paid in PHP. This currency mismatch forces companies to rely on traditional banking rails and FX providers to convert funds before payroll can be disbursed. These processes are often slow, involve multiple intermediaries, carry high conversion fees, and lack transparency for both the company and its employees. For BPOs managing payroll for many staff members each cycle, this adds significant operational overhead, delays, and cost.

## How It Works
[description]

## How It Uses Stellar
The client pays in USDC on the Stellar network. Using a SEP-24 anchor, the USDC is automatically converted into PHP and the resulting funds are disbursed directly to staff wallets, enabling a fast, low-cost, end-to-end USDC → PHP payment flow without relying on traditional cross-border banking rails.

## Track
[description]

## Tech Stack
- Framework: Next.js 16 (App Router) / React 19 / TypeScript 5
- Stellar SDK: @stellar/stellar-sdk v16.0.1
- HD Wallet: stellar-hd-wallet (mnemonic/keypair derivation)
- Network: Testnet
- Wallet: @stellar/freighter-api v6.0.1
- Database/ORM: Prisma 7.8.0 with @prisma/adapter-neon, on Neon serverless Postgres (@neondatabase/serverless v1.1.0)
- Auth: jsonwebtoken v9.0.3 (JWT-based session auth)
- Styling: Tailwind CSS v4 (@tailwindcss/postcss)
- Icons: lucide-react v1.23.0
- QR: qrcode v1.5.4 (generate) / jsqr v1.4.0 (scan)

## Setup & Run

### Prerequisites
- Node.js 20+
- - A Neon Postgres database (or any Postgres instance Prisma can reach)
- [Freighter wallet](https://www.freighter.app/) browser extension, for connecting a Stellar account in dev
- A deployed Soroban savings/vault contract (or access to one) if you're testing on-chain features

### 1. Install dependencies
```bash
npm install
```
`postinstall` runs `prisma generate` automatically.


## Team
- Ezra Ysabela G. Gellecania — @ezraysabela 
- Aiyesha Threa S. Caña — @aiyesha-cn 
- Nicole Marie T. Eduliantes — @Nicole-Marie-Eduliantes 
- Vonne Chelsea Reese A. Sumbeling — @Vonne01010

## License
Proprietary — All Rights Reserved. Unauthorized copying, distribution, or use of this software, in whole or in part, is strictly prohibited without prior written permission.
