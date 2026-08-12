use std::{println, vec};

use glue::{state::*, ID};
use {
    anchor_lang::{
        prelude::*, solana_program::instruction::Instruction, AccountDeserialize, InstructionData,
        ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_native_token::LAMPORTS_PER_SOL,
    solana_rpc_client::rpc_client::RpcClient,
    solana_sdk_ids::system_program::ID as SYSTEM_PROGRAM_ID,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    solana_transaction::Transaction,
    std::{path::PathBuf, str::FromStr},
};

static PROGRAM_ID: Pubkey = ID;

struct TestConfig {
    program: LiteSVM,
    arena_id: u64,
    arena_address: Pubkey,
    host: Keypair,
    players: Vec<Keypair>,
    system_program: Pubkey,
}

impl TestConfig {
    pub fn init_arena(&mut self, id: u64) {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::InitArena {
                host: self.host.pubkey(),
                arena_account: self.arena_address,
                system_program: self.system_program,
            }
            .to_account_metas(None),
            data: glue::instruction::InitArena { id }.data(),
        };
        let message = Message::new(&[ix], Some(&self.host.pubkey()));

        let tx = Transaction::new(&[&self.host], message, self.program.latest_blockhash());

        let result = self.program.send_transaction(tx).unwrap();

        println!("{}", result.pretty_logs());

        println!("\n\nInitArena transaction sucessfull");
        println!("CUs Consumed: {}", result.compute_units_consumed);
        println!("Tx Signature: {}", result.signature);
    }

    pub fn join_arena(&mut self, id: u64, player_index: usize) {
        let player = &self.players[player_index];

        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::JoinArena {
                player: player.pubkey(),
                arena_account: self.arena_address,
            }
            .to_account_metas(None),
            data: glue::instruction::JoinArena { id }.data(),
        };

        let message = Message::new(&[ix], Some(&player.pubkey()));

        let tx = Transaction::new(&[player], message, self.program.latest_blockhash());

        let result = self.program.send_transaction(tx).unwrap();
        println!("{}", result.pretty_logs());

        println!("\n\nJoinArena transaction sucessfull");
        println!("CUs Consumed: {}", result.compute_units_consumed);
        println!("Tx Signature: {}", result.signature);
    }

    pub fn start_arena(&mut self, id: u64) {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::StartArena {
                host: self.host.pubkey(),
                arena_account: self.arena_address,
            }
            .to_account_metas(None),
            data: glue::instruction::StartArena { id }.data(),
        };
        let message = Message::new(&[ix], Some(&self.host.pubkey()));

        let tx = Transaction::new(&[&self.host], message, self.program.latest_blockhash());

        let result = self.program.send_transaction(tx).unwrap();

        println!("{}", result.pretty_logs());

        println!("\n\nJStartArena transaction sucessfull");
        println!("CUs Consumed: {}", result.compute_units_consumed);
        println!("Tx Signature: {}", result.signature);
    }
}

fn setup() -> TestConfig {
    let mut program = LiteSVM::new();
    let host = Keypair::new();
    let player_1 = Keypair::new();
    let player_2 = Keypair::new();
    let player_3 = Keypair::new();
    let player_4 = Keypair::new();
    let player_5 = Keypair::new();
    let player_6 = Keypair::new();

    let players = vec![player_1, player_2, player_3, player_4, player_5, player_6];

    program
        .airdrop(&host.pubkey(), 10 * LAMPORTS_PER_SOL)
        .expect("Failed to airdrop SOL to host");

    for player in &players {
        program
            .airdrop(&player.pubkey(), 10 * LAMPORTS_PER_SOL)
            .expect("Failed to airdrop SOL to player");
    }

    let so_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy/glue.so");

    let program_data = std::fs::read(so_path).expect("Failed to read program SO file");

    let _ = program.add_program(PROGRAM_ID, &program_data);

    let host_pubkey = host.pubkey();
    let arena_id = 1u64;
    let arena = Pubkey::find_program_address(
        &[
            b"arena".as_ref(),
            host_pubkey.as_ref(),
            &arena_id.to_le_bytes(),
        ],
        &PROGRAM_ID,
    )
    .0;
    println!("Arena PDA: {}\n", arena);

    let system_program = SYSTEM_PROGRAM_ID;

    TestConfig {
        program,
        arena_id,
        arena_address: arena,
        host,
        players,
        system_program,
    }
}

#[test]
fn test_init_arena() {
    let mut test_config: TestConfig = setup();
    test_config.init_arena(1);
    let account = test_config
        .program
        .get_account(&test_config.arena_address)
        .expect("Arena account was not created");
    let mut data: &[u8] = &account.data;
    let arena =
        glue::ArenaAccount::try_deserialize(&mut data).expect("Failed to deserialize ArenaAccount");

    assert_eq!(arena.host, test_config.host.pubkey());
    assert_eq!(arena.id, 1);
}

#[test]
fn test_join_arena() {
    let mut test_config = setup();

    test_config.init_arena(1);
    test_config.join_arena(1, 0);

    let account = test_config
        .program
        .get_account(&test_config.arena_address)
        .expect("Arena account was not created");

    let mut data: &[u8] = &account.data;

    let arena =
        glue::ArenaAccount::try_deserialize(&mut data).expect("Failed to deserialize ArenaAccount");

    assert_eq!(arena.players.len(), 2);
    assert!(arena.players.contains(&test_config.players[0].pubkey()));
    assert_eq!(arena.status, ArenaStatus::Waiting);
}

#[test]
fn test_start_arena() {
    let mut test_config = setup();

    test_config.init_arena(1);

    for i in 0..5 {
        test_config.join_arena(1, i);
    }

    test_config.start_arena(1);

    let account = test_config
        .program
        .get_account(&test_config.arena_address)
        .expect("Arena account was not created");

    let mut data: &[u8] = &account.data;

    let arena =
        glue::ArenaAccount::try_deserialize(&mut data).expect("Failed to deserialize ArenaAccount");

    assert_eq!(arena.players.len(), 6);
    assert_eq!(arena.status, ArenaStatus::Running);
}
