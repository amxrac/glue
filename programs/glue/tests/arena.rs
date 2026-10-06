mod helpers;
use helpers::*;

use glue::ArenaStatus;

use anchor_lang::prelude::*;
use solana_keypair::Keypair;
use solana_signer::Signer;

const TX_FEE: u64 = 5_000;

fn impersonate(t: &mut TestConfig, signer: Keypair) {
    t.host = signer;
}

fn name_of(arena: &glue::ArenaAccount, i: usize) -> String {
    let bytes = &arena.names[i];
    let end = bytes.iter().position(|b| *b == 0).unwrap_or(bytes.len());
    String::from_utf8(bytes[..end].to_vec()).unwrap()
}

// init_arena
#[test]
fn init_creates_arena_and_vault() {
    let t = setup_initialized();
    let host = t.host.pubkey();

    let arena = t.arena().expect("arena missing");
    assert_eq!(arena.host, host);
    assert_eq!(arena.players, vec![host]);
    assert_eq!(arena.status, ArenaStatus::Waiting);
    assert_eq!(arena.entry_fee, ENTRY_FEE);
    assert_eq!(name_of(&arena, 0), NAME);
    assert!(arena.bots[0].active);
    assert!(!arena.bots[1].active);

    let vault = t.vault().expect("vault missing");
    assert_eq!(vault.arena, t.arena_pda);
    assert_eq!(vault.players, vec![host]);
    assert_eq!(vault.entry_fee, ENTRY_FEE);
    assert_eq!(vault.started_at, 0);
    assert!(!vault.refunded);
}

#[test]
fn init_moves_fee_into_vault() {
    let t = setup_initialized();

    let vault_account = t.program.get_account(&t.vault_pda).unwrap();
    let rent = t
        .program
        .minimum_balance_for_rent_exemption(vault_account.data.len());
    assert_eq!(vault_account.lamports, rent + ENTRY_FEE);

    let arena_account = t.program.get_account(&t.arena_pda).unwrap();
    let arena_rent = t
        .program
        .minimum_balance_for_rent_exemption(arena_account.data.len());
    assert_eq!(arena_account.lamports, arena_rent);
}

#[test]
fn init_with_zero_fee_fails() {
    let mut t = setup();
    assert!(t.init_arena(0, NAME).is_err());
    assert!(t.arena().is_none());
    assert!(t.vault().is_none());
}

#[test]
fn init_with_name_too_long_fails() {
    let mut t = setup();
    let too_long = "a".repeat(glue::MAX_NAME_LEN + 1);
    assert!(t.init_arena(ENTRY_FEE, &too_long).is_err());
    assert!(t.arena().is_none());
}

#[test]
fn init_twice_fails() {
    let mut t = setup_initialized();
    assert!(t.init_arena(ENTRY_FEE, NAME).is_err());
}

// join_arena
#[test]
fn join_adds_player_to_arena_and_vault() {
    let (t, player) = setup_with_player();
    let expected = vec![t.host.pubkey(), player.pubkey()];

    let arena = t.arena().unwrap();
    assert_eq!(arena.players, expected);
    assert_eq!(name_of(&arena, 1), "player");
    assert!(arena.bots[1].active);

    let vault = t.vault().unwrap();
    assert_eq!(vault.players, expected);
}

#[test]
fn join_moves_fee_into_vault() {
    let mut t = setup_initialized();
    let player = funded_keypair(&mut t);
    let vault_before = t.balance(&t.vault_pda);
    let player_before = t.balance(&player.pubkey());

    t.join_arena(&player, "player").unwrap();

    assert_eq!(t.balance(&t.vault_pda), vault_before + ENTRY_FEE);
    assert_eq!(
        t.balance(&player.pubkey()),
        player_before - ENTRY_FEE - TX_FEE
    );
}

#[test]
fn join_twice_fails() {
    let (mut t, player) = setup_with_player();
    assert!(t.join_arena(&player, "player").is_err());
    assert_eq!(t.arena().unwrap().players.len(), 2);
    assert_eq!(t.vault().unwrap().players.len(), 2);
}

#[test]
fn join_full_arena_fails() {
    let mut t = setup_initialized();
    for i in 0..5 {
        let p = funded_keypair(&mut t);
        t.join_arena(&p, &format!("p{i}")).unwrap();
    }
    let seventh = funded_keypair(&mut t);
    assert!(t.join_arena(&seventh, "late").is_err());
    assert_eq!(t.arena().unwrap().players.len(), 6);
    assert_eq!(t.vault().unwrap().players.len(), 6);
}

#[test]
fn join_after_start_fails() {
    let (mut t, _player) = setup_running();
    let late = funded_keypair(&mut t);
    assert!(t.join_arena(&late, "late").is_err());
}

#[test]
fn join_with_name_too_long_fails() {
    let mut t = setup_initialized();
    let player = funded_keypair(&mut t);
    let too_long = "a".repeat(glue::MAX_NAME_LEN + 1);
    assert!(t.join_arena(&player, &too_long).is_err());
    assert_eq!(t.arena().unwrap().players.len(), 1);
}

// leave_arena
#[test]
fn leave_refunds_and_keeps_lists_aligned() {
    let mut t = setup_initialized();
    let p1 = funded_keypair(&mut t);
    let p2 = funded_keypair(&mut t);
    t.join_arena(&p1, "p1").unwrap();
    t.join_arena(&p2, "p2").unwrap();

    let p1_before = t.balance(&p1.pubkey());
    let vault_before = t.balance(&t.vault_pda);

    t.leave_arena(&p1).unwrap();

    let expected = vec![t.host.pubkey(), p2.pubkey()];
    let arena = t.arena().unwrap();
    assert_eq!(arena.players, expected);
    assert_eq!(t.vault().unwrap().players, expected);
    assert_eq!(name_of(&arena, 1), "p2");
    assert_eq!(name_of(&arena, 2), "");
    assert!(arena.bots[0].active && arena.bots[1].active);
    assert!(!arena.bots[2].active);

    assert_eq!(t.balance(&p1.pubkey()), p1_before + ENTRY_FEE - TX_FEE);
    assert_eq!(t.balance(&t.vault_pda), vault_before - ENTRY_FEE);
}

#[test]
fn host_cannot_leave() {
    let mut t = setup_initialized();
    let host = t.host.insecure_clone();
    assert!(t.leave_arena(&host).is_err());
    assert_eq!(t.arena().unwrap().players.len(), 1);
}

#[test]
fn non_player_leave_fails() {
    let mut t = setup_initialized();
    let stranger = funded_keypair(&mut t);
    assert!(t.leave_arena(&stranger).is_err());
}

#[test]
fn leave_after_start_fails() {
    let (mut t, player) = setup_running();
    assert!(t.leave_arena(&player).is_err());
    assert_eq!(t.arena().unwrap().players.len(), 2);
}

// cancel_arena
#[test]
fn cancel_refunds_everyone_and_closes_accounts() {
    let (mut t, player) = setup_with_player();
    let host = t.host.pubkey();

    let host_before = t.balance(&host);
    let player_before = t.balance(&player.pubkey());
    let arena_lamports = t.balance(&t.arena_pda);
    let vault_lamports = t.balance(&t.vault_pda);

    t.cancel_arena(&[host, player.pubkey()]).unwrap();

    assert!(t.arena().is_none());
    assert!(t.vault().is_none());

    assert_eq!(t.balance(&player.pubkey()), player_before + ENTRY_FEE);
    let host_gain = arena_lamports + vault_lamports - ENTRY_FEE;
    assert_eq!(t.balance(&host), host_before + host_gain - TX_FEE);
}

#[test]
fn cancel_by_non_host_fails() {
    let (mut t, player) = setup_with_player();
    let real_host = t.host.pubkey();
    let intruder = funded_keypair(&mut t);
    impersonate(&mut t, intruder);

    assert!(t.cancel_arena(&[real_host, player.pubkey()]).is_err());
    assert!(t.arena().is_some());
}

#[test]
fn cancel_with_missing_refund_account_fails() {
    let (mut t, _player) = setup_with_player();
    let host = t.host.pubkey();
    assert!(t.cancel_arena(&[host]).is_err());
    assert!(t.arena().is_some());
}

#[test]
fn cancel_with_wrong_refund_order_fails() {
    let (mut t, player) = setup_with_player();
    let host = t.host.pubkey();
    assert!(t.cancel_arena(&[player.pubkey(), host]).is_err());
    assert!(t.arena().is_some());
}

#[test]
fn cancel_after_start_fails() {
    let (mut t, player) = setup_running();
    let host = t.host.pubkey();
    assert!(t.cancel_arena(&[host, player.pubkey()]).is_err());
    assert!(t.arena().is_some());
}
