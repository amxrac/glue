use std::{env, str::FromStr, sync::Arc, time::Duration};

use anchor_client::{
    Client, Cluster,
    solana_sdk::{
        commitment_config::CommitmentConfig,
        pubkey::Pubkey,
        signature::{Signer, read_keypair_file},
    },
};

anchor_lang::declare_program!(glue);

use glue::client::accounts::AdvanceSimulation;
use glue::client::args::AdvanceSimulation as AdvanceSimulationArgs;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let rpc_url = env::var("RPC_URL")?;
    let keypair_path = env::var("KEEPER_KEYPAIR")?;
    let arena_id: u64 = env::var("ARENA_ID")?.parse()?;
    let arena_address = Pubkey::from_str(&env::var("ARENA_ADDRESS")?)?;

    let payer = read_keypair_file(&keypair_path)
        .map_err(|e| anyhow::anyhow!("failed to read keeper keypair: {e}"))?;
    let payer_pubkey = payer.pubkey();

    println!("Keeper: {}", payer_pubkey);
    println!("Arena:  {}", arena_address);
    println!("ID:     {}", arena_id);

    // Anchor client connected to the ER/RPC endpoint.
    let client = Client::new_with_options(
        Cluster::Custom(rpc_url.clone(), rpc_url),
        Arc::new(payer),
        CommitmentConfig::confirmed(),
    );

    let program = client.program(glue::ID)?;

    loop {
        let arena = program
            .account::<glue::accounts::ArenaAccount>(arena_address)
            .await?;

        if matches!(arena.status, glue::types::ArenaStatus::Finished) {
            println!("Arena finished.");
            break;
        }

        if !matches!(arena.status, glue::types::ArenaStatus::Running) {
            println!("Arena is not running; waiting...");
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        println!("Advancing tick {}...", arena.tick + 1);

        // Build and send advance_simulation(id).
        let magic_program = Pubkey::from_str("Magic11111111111111111111111111111111111111")?;
        let magic_context = Pubkey::from_str("MagicContext1111111111111111111111111111111")?;
        let signature = program
            .request()
            .accounts(AdvanceSimulation {
                keeper: payer_pubkey,
                arena_account: arena_address,
                magic_program,
                magic_context,
            })
            .args(AdvanceSimulationArgs { id: arena_id })
            .send()
            .await?;

        println!("Transaction: {signature}");

        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Ok(())
}
