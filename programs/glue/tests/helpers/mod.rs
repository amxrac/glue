use {
    anchor_lang::{AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas},
    ephemeral_rollups_sdk::vrf::consts::scoped_vrf_identity,
    glue::{ArenaAccount, UpgradeType, VaultAccount},
    litesvm::{types::TransactionResult, LiteSVM},
    session_keys::SessionTokenV2,
    solana_account::Account,
    solana_clock::Clock,
    solana_instruction::{AccountMeta, Instruction},
    solana_keypair::Keypair,
    solana_message::Message,
    solana_native_token::LAMPORTS_PER_SOL,
    solana_pubkey::Pubkey,
    solana_sdk_ids::system_program::ID as SYSTEM_PROGRAM_ID,
    solana_signer::Signer,
    solana_transaction::Transaction,
    std::path::PathBuf,
};

pub static PROGRAM_ID: Pubkey = glue::ID;

pub const ARENA_ID: u64 = 1;
pub const ENTRY_FEE: u64 = LAMPORTS_PER_SOL / 100;
pub const NAME: &str = "host";
pub const SEED: [u8; 32] = [42u8; 32];
pub const START_TIME: i64 = 1_700_000_000;

pub fn arena_pda(host: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"arena", host.as_ref(), &id.to_le_bytes()], &PROGRAM_ID).0
}

pub fn vault_pda(arena: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", arena.as_ref()], &PROGRAM_ID).0
}

pub fn session_token_pda(signer: &Pubkey, authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[
            SessionTokenV2::SEED_PREFIX.as_bytes(),
            PROGRAM_ID.as_ref(),
            signer.as_ref(),
            authority.as_ref(),
        ],
        &session_keys::ID,
    )
    .0
}

pub fn vrf_identity() -> Pubkey {
    scoped_vrf_identity(&PROGRAM_ID)
}

pub struct TestConfig {
    pub program: LiteSVM,
    pub host: Keypair,
    pub arena_pda: Pubkey,
    pub vault_pda: Pubkey,
    pub system_program: Pubkey,
}

fn log_result(result: &TransactionResult, label: &str) {
    match result {
        Ok(meta) => println!(
            "{}\n{label} succeeded | CUs: {}",
            meta.pretty_logs(),
            meta.compute_units_consumed
        ),
        Err(failed) => println!(
            "{}\n{label} failed | error: {:?}",
            failed.meta.pretty_logs(),
            failed.err
        ),
    }
}

impl TestConfig {
    pub fn send(
        svm: &mut LiteSVM,
        ix: Instruction,
        signer: &Keypair,
        label: &str,
    ) -> TransactionResult {
        svm.expire_blockhash();
        let message = Message::new(&[ix], Some(&signer.pubkey()));
        let tx = Transaction::new(&[signer], message, svm.latest_blockhash());
        let result = svm.send_transaction(tx);
        log_result(&result, label);
        result
    }

    pub fn send_with_virtual_signers(
        svm: &mut LiteSVM,
        ix: Instruction,
        payer: &Keypair,
        label: &str,
    ) -> TransactionResult {
        svm.expire_blockhash();
        let message = Message::new(&[ix], Some(&payer.pubkey()));
        let mut tx = Transaction::new_unsigned(message);
        tx.partial_sign(&[payer], svm.latest_blockhash());
        let result = svm.send_transaction(tx);
        log_result(&result, label);
        result
    }

    pub fn init_arena(&mut self, entry_fee: u64, name: &str) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::InitArena {
                host: self.host.pubkey(),
                arena_account: self.arena_pda,
                vault_account: self.vault_pda,
                system_program: self.system_program,
            }
            .to_account_metas(None),
            data: glue::instruction::InitArena {
                id: ARENA_ID,
                entry_fee,
                name: name.to_string(),
            }
            .data(),
        };
        Self::send(&mut self.program, ix, &self.host, "init_arena")
    }

    pub fn join_arena(&mut self, player: &Keypair, name: &str) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::JoinArena {
                player: player.pubkey(),
                arena_account: self.arena_pda,
                vault_account: self.vault_pda,
                system_program: self.system_program,
            }
            .to_account_metas(None),
            data: glue::instruction::JoinArena {
                id: ARENA_ID,
                name: name.to_string(),
            }
            .data(),
        };
        Self::send(&mut self.program, ix, player, "join_arena")
    }

    pub fn leave_arena(&mut self, player: &Keypair) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::LeaveArena {
                player: player.pubkey(),
                arena_account: self.arena_pda,
                vault_account: self.vault_pda,
            }
            .to_account_metas(None),
            data: glue::instruction::LeaveArena { id: ARENA_ID }.data(),
        };
        Self::send(&mut self.program, ix, player, "leave_arena")
    }

    pub fn cancel_arena(&mut self, refund_to: &[Pubkey]) -> TransactionResult {
        let mut accounts = glue::accounts::CancelArena {
            host: self.host.pubkey(),
            arena_account: self.arena_pda,
            vault_account: self.vault_pda,
        }
        .to_account_metas(None);
        accounts.extend(refund_to.iter().map(|p| AccountMeta::new(*p, false)));
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts,
            data: glue::instruction::CancelArena { id: ARENA_ID }.data(),
        };
        Self::send(&mut self.program, ix, &self.host, "cancel_arena")
    }

    pub fn start_arena(&mut self) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::StartArena {
                host: self.host.pubkey(),
                arena_account: self.arena_pda,
                vault_account: self.vault_pda,
            }
            .to_account_metas(None),
            data: glue::instruction::StartArena { id: ARENA_ID }.data(),
        };
        Self::send(&mut self.program, ix, &self.host, "start_arena")
    }

    pub fn consume_randomness(
        &mut self,
        payer: &Keypair,
        randomness: [u8; 32],
    ) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::ConsumeRandomnessCtx {
                vrf_program_identity: vrf_identity(),
                arena_account: self.arena_pda,
            }
            .to_account_metas(None),
            data: glue::instruction::ConsumeRandomness { randomness }.data(),
        };
        Self::send_with_virtual_signers(&mut self.program, ix, payer, "consume_randomness")
    }

    pub fn advance_simulation(&mut self, payer: &Keypair) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::AdvanceSimulation {
                arena_account: self.arena_pda,
                crank_signer: glue::crank_signer_pda(&self.host.pubkey()),
            }
            .to_account_metas(None),
            data: glue::instruction::AdvanceSimulation { id: ARENA_ID }.data(),
        };
        Self::send_with_virtual_signers(&mut self.program, ix, payer, "advance_simulation")
    }

    pub fn upgrade_bot(
        &mut self,
        signer: &Keypair,
        player_wallet: Pubkey,
        session_token: Option<Pubkey>,
        upgrade: UpgradeType,
    ) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::UpgradeBot {
                signer: signer.pubkey(),
                arena_account: self.arena_pda,
                player_wallet,
                session_token,
            }
            .to_account_metas(None),
            data: glue::instruction::UpgradeBot {
                id: ARENA_ID,
                upgrade,
            }
            .data(),
        };
        Self::send(&mut self.program, ix, signer, "upgrade_bot")
    }

    pub fn force_finish(&mut self, payer: &Keypair) -> TransactionResult {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: glue::accounts::ForceFinish {
                arena_account: self.arena_pda,
            }
            .to_account_metas(None),
            data: glue::instruction::ForceFinish { id: ARENA_ID }.data(),
        };
        Self::send(&mut self.program, ix, payer, "force_finish")
    }

    pub fn claim_prize(&mut self, caller: &Keypair, winners: &[Pubkey]) -> TransactionResult {
        let mut accounts = glue::accounts::ClaimPrize {
            caller: caller.pubkey(),
            arena_account: self.arena_pda,
            host: self.host.pubkey(),
            vault_account: self.vault_pda,
        }
        .to_account_metas(None);
        accounts.extend(winners.iter().map(|p| AccountMeta::new(*p, false)));
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts,
            data: glue::instruction::ClaimPrize { id: ARENA_ID }.data(),
        };
        Self::send(&mut self.program, ix, caller, "claim_prize")
    }

    pub fn emergency_refund(&mut self, payer: &Keypair, players: &[Pubkey]) -> TransactionResult {
        let mut accounts = glue::accounts::EmergencyRefund {
            arena_account: self.arena_pda,
            vault_account: self.vault_pda,
        }
        .to_account_metas(None);
        accounts.extend(players.iter().map(|p| AccountMeta::new(*p, false)));
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts,
            data: glue::instruction::EmergencyRefund {}.data(),
        };
        Self::send(&mut self.program, ix, payer, "emergency_refund")
    }

    fn read<T: AccountDeserialize>(&self, address: &Pubkey) -> Option<T> {
        let account = self.program.get_account(address)?;
        Some(
            T::try_deserialize(&mut account.data.as_slice())
                .unwrap_or_else(|e| panic!("failed to deserialize account {address}: {e:?}")),
        )
    }

    pub fn arena(&self) -> Option<ArenaAccount> {
        self.read(&self.arena_pda)
    }

    pub fn vault(&self) -> Option<VaultAccount> {
        self.read(&self.vault_pda)
    }

    pub fn balance(&self, address: &Pubkey) -> u64 {
        self.program.get_balance(address).unwrap_or(0)
    }

    pub fn write_arena(&mut self, f: impl FnOnce(&mut ArenaAccount)) {
        let mut account = self
            .program
            .get_account(&self.arena_pda)
            .expect("arena missing");
        let mut arena = ArenaAccount::try_deserialize(&mut account.data.as_slice()).unwrap();
        f(&mut arena);
        let mut data = Vec::with_capacity(account.data.len());
        arena.try_serialize(&mut data).unwrap();
        assert!(
            data.len() <= account.data.len(),
            "arena data exceeds allocated space"
        );
        data.resize(account.data.len(), 0);
        account.data = data;
        self.program.set_account(self.arena_pda, account).unwrap();
    }

    pub fn set_vrf_seed(&mut self, seed: [u8; 32]) {
        self.write_arena(|a| a.vrf_seed = Some(seed));
    }

    pub fn set_delegated(&mut self) {
        let mut account = self
            .program
            .get_account(&self.arena_pda)
            .expect("arena missing");
        account.owner = glue::DELEGATION_PROGRAM_ID;
        self.program.set_account(self.arena_pda, account).unwrap();
    }

    pub fn set_undelegated(&mut self) {
        let mut account = self
            .program
            .get_account(&self.arena_pda)
            .expect("arena missing");
        account.owner = PROGRAM_ID;
        self.program.set_account(self.arena_pda, account).unwrap();
    }

    pub fn send_multi(
        svm: &mut LiteSVM,
        ix: Instruction,
        payer: &Keypair,
        others: &[&Keypair],
        label: &str,
    ) -> TransactionResult {
        svm.expire_blockhash();
        let message = Message::new(&[ix], Some(&payer.pubkey()));
        let mut signers: Vec<&Keypair> = vec![payer];
        signers.extend_from_slice(others);
        let tx = Transaction::new(&signers, message, svm.latest_blockhash());
        let result = svm.send_transaction(tx);
        log_result(&result, label);
        result
    }

    pub fn create_session(
        &mut self,
        session_key: &Keypair,
        wallet: &Keypair,
        valid_until: i64,
    ) -> Pubkey {
        let session_token = session_token_pda(&session_key.pubkey(), &wallet.pubkey());
        let ix = Instruction {
            program_id: session_keys::ID,
            accounts: session_keys::accounts::CreateSessionTokenV2 {
                session_token,
                session_signer: session_key.pubkey(),
                fee_payer: wallet.pubkey(),
                authority: wallet.pubkey(),
                target_program: PROGRAM_ID,
                system_program: self.system_program,
            }
            .to_account_metas(None),
            data: session_keys::instruction::CreateSessionV2 {
                top_up: Some(false),
                valid_until: Some(valid_until),
                lamports: None,
            }
            .data(),
        };
        Self::send_multi(
            &mut self.program,
            ix,
            wallet,
            &[session_key],
            "create_session",
        )
        .expect("create_session failed");
        session_token
    }

    pub fn now(&self) -> i64 {
        self.program.get_sysvar::<Clock>().unix_timestamp
    }

    pub fn set_clock(&mut self, unix_timestamp: i64) {
        let mut clock = self.program.get_sysvar::<Clock>();
        clock.unix_timestamp = unix_timestamp;
        self.program.set_sysvar::<Clock>(&clock);
    }

    pub fn warp(&mut self, seconds: i64) {
        let now = self.now();
        self.set_clock(now + seconds);
    }
}

pub fn setup() -> TestConfig {
    let mut program = LiteSVM::new().with_sigverify(false);
    let host = Keypair::new();

    program
        .airdrop(&host.pubkey(), 10 * LAMPORTS_PER_SOL)
        .expect("Failed to airdrop SOL to host");

    let so_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../target/deploy/glue.so");
    let program_bytes = std::fs::read(so_path).expect("Failed to read program SO file");
    program
        .add_program(PROGRAM_ID, &program_bytes)
        .expect("Failed to deploy program");

    let session_so =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/session_keys.so");
    let session_bytes =
        std::fs::read(session_so).expect("Failed to read session_keys.so (see tests/fixtures)");
    program
        .add_program(session_keys::ID, &session_bytes)
        .expect("Failed to deploy session program");

    let arena_pda = arena_pda(&host.pubkey(), ARENA_ID);
    let vault_pda = vault_pda(&arena_pda);

    let mut t = TestConfig {
        program,
        host,
        arena_pda,
        vault_pda,
        system_program: SYSTEM_PROGRAM_ID,
    };
    t.set_clock(START_TIME);
    t
}

pub fn funded_keypair(t: &mut TestConfig) -> Keypair {
    let kp = Keypair::new();
    t.program.airdrop(&kp.pubkey(), LAMPORTS_PER_SOL).unwrap();
    kp
}

pub fn setup_initialized() -> TestConfig {
    let mut t = setup();
    t.init_arena(ENTRY_FEE, NAME).unwrap();
    t
}

pub fn setup_with_player() -> (TestConfig, Keypair) {
    let mut t = setup_initialized();
    let player = funded_keypair(&mut t);
    t.join_arena(&player, "player").unwrap();
    (t, player)
}

pub fn setup_running() -> (TestConfig, Keypair) {
    let (mut t, player) = setup_with_player();
    t.set_vrf_seed(SEED);
    t.start_arena().unwrap();
    (t, player)
}

pub fn run_to_end(t: &mut TestConfig, payer: &Keypair) {
    t.write_arena(|a| a.tick = a.max_ticks - 1);
    t.advance_simulation(payer).unwrap();
}
