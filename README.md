# StellaQR
StellaQR is a Stellar-powered payment system that lets bazaar vendors accept multiple payment methods through a single QR code, automatically consolidating digital payments into one USDC balance for easier reconciliation.

## Problem
Bazaar and tabletop vendors often accept payments through different methods such as GCash, Maya, and cash to accommodate customers. While this provides convenience for buyers, it creates challenges for vendors who must manually reconcile transactions from multiple platforms at the end of the day. Tracking payments across different apps and cash records is time-consuming, increases the risk of errors, and makes it difficult to maintain accurate financial records, especially for small businesses with limited resources.

## How It Works
[description]

## How It Uses Stellar
[description]

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
