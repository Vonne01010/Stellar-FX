#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _},
    Env, Map,
};

fn create_usdc_token<'a>(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let asset_client = token::StellarAssetClient::new(env, &sac.address());
    (sac.address(), asset_client)
}

#[test]
fn full_payroll_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let client = Address::generate(&env); // offshore BPO client
    let token_admin = Address::generate(&env);
    let (token_addr, token_admin_client) = create_usdc_token(&env, &token_admin);
    let token_client = token::Client::new(&env, &token_addr);

    // Mint USDC to the client so they can fund payroll.
    token_admin_client.mint(&client, &1_000_0000000i128);

    let contract_id = env.register(PayrollContract, ());
    let contract = PayrollContractClient::new(&env, &contract_id);

    contract.initialize(&admin, &token_addr);

    let emp1 = Address::generate(&env);
    let emp2 = Address::generate(&env);
    contract.add_employee(&1u64, &emp1);
    contract.add_employee(&2u64, &emp2);

    let mut items: Map<u64, i128> = Map::new(&env);
    items.set(1u64, 300_0000000i128);
    items.set(2u64, 200_0000000i128);

    contract.create_payroll_run(&1u64, &client, &items);

    let run = contract.get_run(&1u64);
    assert_eq!(run.total_amount, 500_0000000i128);
    assert_eq!(run.status, RunStatus::Draft);

    contract.fund_run(&1u64, &500_0000000i128);
    let run = contract.get_run(&1u64);
    assert_eq!(run.status, RunStatus::Funded);
    assert_eq!(token_client.balance(&contract_id), 500_0000000i128);

    contract.disburse(&1u64);

    assert_eq!(token_client.balance(&emp1), 300_0000000i128);
    assert_eq!(token_client.balance(&emp2), 200_0000000i128);
    assert_eq!(token_client.balance(&contract_id), 0);

    let run = contract.get_run(&1u64);
    assert_eq!(run.status, RunStatus::Completed);
}

#[test]
fn inactive_employee_item_fails_then_retries() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let client = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_addr, token_admin_client) = create_usdc_token(&env, &token_admin);

    token_admin_client.mint(&client, &100_0000000i128);

    let contract_id = env.register(PayrollContract, ());
    let contract = PayrollContractClient::new(&env, &contract_id);
    contract.initialize(&admin, &token_addr);

    let emp1 = Address::generate(&env);
    contract.add_employee(&1u64, &emp1);

    let mut items: Map<u64, i128> = Map::new(&env);
    items.set(1u64, 100_0000000i128);
    contract.create_payroll_run(&1u64, &client, &items);
    contract.fund_run(&1u64, &100_0000000i128);

    // Deactivate employee before disbursement -> item should fail, not panic.
    contract.set_employee_active(&1u64, &false);
    contract.disburse(&1u64);

    let item = contract.get_item(&1u64, &1u64);
    assert_eq!(item.status, ItemStatus::Failed);

    // Reactivate and retry.
    contract.set_employee_active(&1u64, &true);
    contract.retry_item(&1u64, &1u64);

    let item = contract.get_item(&1u64, &1u64);
    assert_eq!(item.status, ItemStatus::Disbursed);

    let run = contract.get_run(&1u64);
    assert_eq!(run.status, RunStatus::Completed);
}