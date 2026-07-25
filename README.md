# Stellar FX
Stellar FX is a Stellar-powered cross-border payroll system that lets BPO companies pay offshore Filipino staff by receiving USD-denominated funds from clients and automatically converting and disbursing them as PHP directly into staff wallets.

## Problem
BPO companies frequently serve offshore clients who pay for services in USD, while their Filipino staff need to be paid in PHP. This currency mismatch forces companies to rely on traditional banking rails and FX providers to convert funds before payroll can be disbursed. These processes are often slow, involve multiple intermediaries, carry high conversion fees, and lack transparency for both the company and its employees. For BPOs managing payroll for many staff members each cycle, this adds significant operational overhead, delays, and cost.

## How It Works
1. **Setup** — A BPO company registers on Stellar FX and onboards its staff, linking each employee to a Stellar payout wallet.
2. **Payroll run creation** — The company creates a payroll run for the cycle, specifying each employee's USDC amount. This is mirrored on-chain via a Soroban smart contract alongside the existing Postgres records (Company, Employee, PayrollRun, PayrollItem).
3. **Client funding** — The offshore client funds the run by sending USDC on the Stellar network into the smart contract, which custodies the funds until disbursement.
4. **Disbursement** — Once funded, the company triggers disbursement. The contract pays each employee's Stellar wallet in USDC and emits an on-chain event per employee.
5. **USDC → PHP conversion** — An off-chain worker listens for these disbursement events and automatically initiates a SEP-24 interactive withdrawal with a Stellar anchor for each employee, converting their USDC into PHP and depositing it to their linked bank account or e-wallet.
6. **Audit trail** — Every status change (funded, disbursed, failed, converted) is recorded in a StatusHistory table, giving the company and employees full transparency into where funds are at each step.

## How It Uses Stellar
The client pays in USDC on the Stellar network. Using a SEP-24 anchor, the USDC is automatically converted into PHP and the resulting funds are disbursed directly to staff wallets, enabling a fast, low-cost, end-to-end USDC → PHP payment flow without relying on traditional cross-border banking rails.

## Track
[description]

## Tech Stack
- Framework: Next.js 16 (App Router) / React 19 / TypeScript 5
- Smart Contracts: Soroban (Rust) — payroll disbursement contract handling USDC custody, funding, and per-employee disbursement
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
- A Neon Postgres database (or any Postgres instance Prisma can reach)
- [Freighter wallet](https://www.freighter.app/) browser extension, for connecting a Stellar account in dev
- A deployed Soroban payroll disbursement contract (or access to one) if you're testing on-chain features
- Rust toolchain + `stellar` CLI, if building/deploying the smart contract yourself

### 1. Install dependencies
```bash
npm install
```
`postinstall` runs `prisma generate` automatically.

### 2. Configure environment
Set up a `.env` with your Neon Postgres connection string, JWT secret, and the deployed payroll contract's ID and network passphrase.

### 3. Run database migrations
```bash
npx prisma migrate deploy
```

### 4. Build and deploy the smart contract (optional, if not using an existing deployment)
```bash
cd contracts/payroll-disbursement
cargo test
stellar contract build
stellar contract deploy --wasm target/wasm32v1-none/release/payroll_disbursement.wasm --source <admin-key> --network testnet
```

### 5. Start the app
```bash
npm run dev
```

## Team
- Ezra Ysabela G. Gellecania — @ezraysabela 
- Aiyesha Threa S. Caña — @aiyesha-cn 
- Nicole Marie T. Eduliantes — @Nicole-Marie-Eduliantes 
- Vonne Chelsea Reese A. Sumbeling — @Vonne01010


## License
MIT License
