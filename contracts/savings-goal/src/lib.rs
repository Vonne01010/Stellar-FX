#![no_std]

//! BPO Cross-Border Payroll Disbursement Contract
//!
//! Flow:
//! 1. Company admin registers employees (each mapped to a Stellar wallet address).
//! 2. Admin creates a PayrollRun with line items (employee_id -> USDC amount, in stroops-equivalent
//!    fixed-point integer matching the token's decimals — USDC on Stellar uses 7 decimals).
//! 3. Offshore client funds the run by sending USDC into the contract (client signs the transfer).
//! 4. Admin triggers disbursement: contract pushes USDC out to each employee's Stellar wallet.
//!    Employees (or their linked anchor) then do the SEP-24 USDC -> PHP off-ramp off-chain;
//!    this contract emits a `disbursed` event per item that an off-chain worker listens to
//!    in order to kick off the anchor withdrawal automatically.
//!
//! All amounts are i128 fixed-point integers matching the underlying token's `decimals()`,
//! consistent with how amounts are already stored in Company/Employee/PayrollRun/PayrollItem
//! in the off-chain Postgres schema.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Map,
    Vec,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,           // USDC SAC (Stellar Asset Contract) address
    Employee(u64),   // employee_id -> Employee
    Run(u64),        // run_id -> PayrollRun
    Item(u64, u64),  // (run_id, employee_id) -> PayrollItem
    RunItems(u64),   // run_id -> Vec<employee_id>, preserves ordering for iteration
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum RunStatus {
    Draft,      // created, not yet funded
    Funded,     // client has deposited full total
    Disbursing, // partially disbursed (some items failed / in progress)
    Completed,  // all items disbursed
}

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum ItemStatus {
    Pending,
    Disbursed,
    Failed,
}

#[contracttype]
#[derive(Clone)]
pub struct Employee {
    pub wallet: Address,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct PayrollRun {
    pub run_id: u64,
    pub client: Address,   // offshore client who funds this run
    pub total_amount: i128,
    pub funded_amount: i128,
    pub status: RunStatus,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct PayrollItem {
    pub run_id: u64,
    pub employee_id: u64,
    pub amount: i128,
    pub status: ItemStatus,
}

// ---------------------------------------------------------------------------
// Events (off-chain worker listens for these to trigger SEP-24 anchor withdrawal)
//
// Topics use short symbols + run_id/employee_id so an indexer can filter cheaply;
// data payload carries the rest. Using env.events().publish() directly (rather than
// the #[contractevent] derive) keeps this compatible across soroban-sdk minor versions.
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub struct ItemDisbursedData {
    pub employee_id: u64,
    pub wallet: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct ItemFailedData {
    pub employee_id: u64,
    pub amount: i128,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PayrollError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAdmin = 3,
    EmployeeExists = 4,
    EmployeeNotFound = 5,
    EmployeeInactive = 6,
    RunExists = 7,
    RunNotFound = 8,
    EmptyRun = 9,
    InvalidAmount = 10,
    WrongRunStatus = 11,
    AlreadyFunded = 12,
    InsufficientFunding = 13,
    ItemNotFound = 14,
    ItemNotPending = 15,
    Overflow = 16,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct PayrollContract;

#[contractimpl]
impl PayrollContract {
    /// One-time setup. `admin` is the BPO company's signing key (or a multisig/policy
    /// contract address). `usdc_token` is the USDC Stellar Asset Contract address
    /// (testnet USDC issuer's SAC, or the anchor's USDC SAC).
    pub fn initialize(env: Env, admin: Address, usdc_token: Address) -> Result<(), PayrollError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(PayrollError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &usdc_token);
        Ok(())
    }

    /// Register an employee and their Stellar wallet (funded testnet/mainnet account,
    /// or a smart wallet contract address — both are just `Address` to Soroban).
    pub fn add_employee(
        env: Env,
        employee_id: u64,
        wallet: Address,
    ) -> Result<(), PayrollError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let key = DataKey::Employee(employee_id);
        if env.storage().persistent().has(&key) {
            return Err(PayrollError::EmployeeExists);
        }
        env.storage().persistent().set(
            &key,
            &Employee {
                wallet,
                active: true,
            },
        );
        Ok(())
    }

    /// Update an employee's payout wallet (e.g. they switch to a new Stellar wallet).
    pub fn update_employee_wallet(
        env: Env,
        employee_id: u64,
        new_wallet: Address,
    ) -> Result<(), PayrollError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let key = DataKey::Employee(employee_id);
        let mut employee: Employee = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(PayrollError::EmployeeNotFound)?;
        employee.wallet = new_wallet;
        env.storage().persistent().set(&key, &employee);
        Ok(())
    }

    pub fn set_employee_active(
        env: Env,
        employee_id: u64,
        active: bool,
    ) -> Result<(), PayrollError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let key = DataKey::Employee(employee_id);
        let mut employee: Employee = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(PayrollError::EmployeeNotFound)?;
        employee.active = active;
        env.storage().persistent().set(&key, &employee);
        Ok(())
    }

    pub fn get_employee(env: Env, employee_id: u64) -> Result<Employee, PayrollError> {
        env.storage()
            .persistent()
            .get(&DataKey::Employee(employee_id))
            .ok_or(PayrollError::EmployeeNotFound)
    }

    /// Create a payroll run with line items. `items` is a map of employee_id -> USDC amount
    /// (fixed-point, matching token decimals — mirrors PayrollItem rows already created
    /// off-chain). This mirrors the run to the ledger but does not move funds yet.
    pub fn create_payroll_run(
        env: Env,
        run_id: u64,
        client: Address,
        items: Map<u64, i128>,
    ) -> Result<(), PayrollError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let run_key = DataKey::Run(run_id);
        if env.storage().persistent().has(&run_key) {
            return Err(PayrollError::RunExists);
        }
        if items.is_empty() {
            return Err(PayrollError::EmptyRun);
        }

        let mut total: i128 = 0;
        let mut employee_ids: Vec<u64> = Vec::new(&env);

        for (employee_id, amount) in items.iter() {
            if amount <= 0 {
                return Err(PayrollError::InvalidAmount);
            }
            // employee must exist and be active
            let employee: Employee = env
                .storage()
                .persistent()
                .get(&DataKey::Employee(employee_id))
                .ok_or(PayrollError::EmployeeNotFound)?;
            if !employee.active {
                return Err(PayrollError::EmployeeInactive);
            }

            total = total.checked_add(amount).ok_or(PayrollError::Overflow)?;
            employee_ids.push_back(employee_id);

            env.storage().persistent().set(
                &DataKey::Item(run_id, employee_id),
                &PayrollItem {
                    run_id,
                    employee_id,
                    amount,
                    status: ItemStatus::Pending,
                },
            );
        }

        env.storage()
            .persistent()
            .set(&DataKey::RunItems(run_id), &employee_ids);

        env.storage().persistent().set(
            &run_key,
            &PayrollRun {
                run_id,
                client,
                total_amount: total,
                funded_amount: 0,
                status: RunStatus::Draft,
                created_at: env.ledger().timestamp(),
            },
        );

        Ok(())
    }

    /// Offshore client funds the run by transferring USDC into the contract.
    /// Client must sign this call (their wallet authorizes the token transfer).
    pub fn fund_run(env: Env, run_id: u64, amount: i128) -> Result<(), PayrollError> {
        if amount <= 0 {
            return Err(PayrollError::InvalidAmount);
        }
        let mut run = Self::get_run(env.clone(), run_id)?;
        if run.status != RunStatus::Draft {
            return Err(PayrollError::WrongRunStatus);
        }
        run.client.require_auth();

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(PayrollError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);

        // Pulls USDC from the client's wallet into this contract.
        token_client.transfer(&run.client, &env.current_contract_address(), &amount);

        run.funded_amount = run
            .funded_amount
            .checked_add(amount)
            .ok_or(PayrollError::Overflow)?;

        if run.funded_amount > run.total_amount {
            return Err(PayrollError::AlreadyFunded);
        }
        if run.funded_amount == run.total_amount {
            run.status = RunStatus::Funded;
        }

        env.storage().persistent().set(&DataKey::Run(run_id), &run);

        env.events().publish(
            (symbol_short!("run_fund"), run_id),
            run.funded_amount,
        );

        Ok(())
    }

    /// Admin triggers disbursement of every pending item in a fully-funded run.
    /// Each successful transfer emits `ItemDisbursed`, which an off-chain worker
    /// subscribes to in order to call the SEP-24 anchor and off-ramp that employee's
    /// USDC into PHP automatically.
    pub fn disburse(env: Env, run_id: u64) -> Result<(), PayrollError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let mut run = Self::get_run(env.clone(), run_id)?;
        if run.status != RunStatus::Funded && run.status != RunStatus::Disbursing {
            return Err(PayrollError::WrongRunStatus);
        }

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(PayrollError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);

        let employee_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::RunItems(run_id))
            .ok_or(PayrollError::EmptyRun)?;

        let mut all_done = true;

        for employee_id in employee_ids.iter() {
            let item_key = DataKey::Item(run_id, employee_id);
            let mut item: PayrollItem = env
                .storage()
                .persistent()
                .get(&item_key)
                .ok_or(PayrollError::ItemNotFound)?;

            if item.status != ItemStatus::Pending {
                continue;
            }

            let employee: Employee = env
                .storage()
                .persistent()
                .get(&DataKey::Employee(employee_id))
                .ok_or(PayrollError::EmployeeNotFound)?;

            if !employee.active {
                item.status = ItemStatus::Failed;
                env.storage().persistent().set(&item_key, &item);
                env.events().publish(
                    (symbol_short!("itm_fail"), run_id),
                    ItemFailedData {
                        employee_id,
                        amount: item.amount,
                    },
                );
                all_done = false;
                continue;
            }

            token_client.transfer(
                &env.current_contract_address(),
                &employee.wallet,
                &item.amount,
            );

            item.status = ItemStatus::Disbursed;
            env.storage().persistent().set(&item_key, &item);

            env.events().publish(
                (symbol_short!("itm_paid"), run_id),
                ItemDisbursedData {
                    employee_id,
                    wallet: employee.wallet,
                    amount: item.amount,
                },
            );
        }

        run.status = if all_done {
            RunStatus::Completed
        } else {
            RunStatus::Disbursing
        };
        env.storage().persistent().set(&DataKey::Run(run_id), &run);

        if all_done {
            env.events()
                .publish((symbol_short!("run_done"),), run_id);
        }

        Ok(())
    }

    /// Retry a single failed item (e.g. after re-activating an employee or fixing their wallet).
    pub fn retry_item(env: Env, run_id: u64, employee_id: u64) -> Result<(), PayrollError> {
        let admin = Self::require_admin(&env)?;
        admin.require_auth();

        let item_key = DataKey::Item(run_id, employee_id);
        let mut item: PayrollItem = env
            .storage()
            .persistent()
            .get(&item_key)
            .ok_or(PayrollError::ItemNotFound)?;

        if item.status == ItemStatus::Disbursed {
            return Err(PayrollError::ItemNotPending);
        }

        let employee: Employee = env
            .storage()
            .persistent()
            .get(&DataKey::Employee(employee_id))
            .ok_or(PayrollError::EmployeeNotFound)?;
        if !employee.active {
            return Err(PayrollError::EmployeeInactive);
        }

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(PayrollError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);

        token_client.transfer(
            &env.current_contract_address(),
            &employee.wallet,
            &item.amount,
        );

        item.status = ItemStatus::Disbursed;
        env.storage().persistent().set(&item_key, &item);

        env.events().publish(
            (symbol_short!("itm_paid"), run_id),
            ItemDisbursedData {
                employee_id,
                wallet: employee.wallet,
                amount: item.amount,
            },
        );

        // Check if the whole run is now complete.
        let employee_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::RunItems(run_id))
            .ok_or(PayrollError::EmptyRun)?;
        let mut all_done = true;
        for eid in employee_ids.iter() {
            let it: PayrollItem = env
                .storage()
                .persistent()
                .get(&DataKey::Item(run_id, eid))
                .ok_or(PayrollError::ItemNotFound)?;
            if it.status != ItemStatus::Disbursed {
                all_done = false;
                break;
            }
        }
        if all_done {
            let mut run = Self::get_run(env.clone(), run_id)?;
            run.status = RunStatus::Completed;
            env.storage().persistent().set(&DataKey::Run(run_id), &run);
            env.events()
                .publish((symbol_short!("run_done"),), run_id);
        }

        Ok(())
    }

    pub fn get_run(env: Env, run_id: u64) -> Result<PayrollRun, PayrollError> {
        env.storage()
            .persistent()
            .get(&DataKey::Run(run_id))
            .ok_or(PayrollError::RunNotFound)
    }

    pub fn get_item(env: Env, run_id: u64, employee_id: u64) -> Result<PayrollItem, PayrollError> {
        env.storage()
            .persistent()
            .get(&DataKey::Item(run_id, employee_id))
            .ok_or(PayrollError::ItemNotFound)
    }

    pub fn get_run_employee_ids(env: Env, run_id: u64) -> Result<Vec<u64>, PayrollError> {
        env.storage()
            .persistent()
            .get(&DataKey::RunItems(run_id))
            .ok_or(PayrollError::RunNotFound)
    }

    /// USDC token balance currently custodied by the contract (sanity/reconciliation check).
    pub fn contract_balance(env: Env) -> Result<i128, PayrollError> {
        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(PayrollError::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);
        Ok(token_client.balance(&env.current_contract_address()))
    }

    pub fn admin(env: Env) -> Result<Address, PayrollError> {
        Self::require_admin(&env)
    }

    // -----------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------

    fn require_admin(env: &Env) -> Result<Address, PayrollError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(PayrollError::NotInitialized)
    }
}

mod test;