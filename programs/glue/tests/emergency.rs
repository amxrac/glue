mod helpers;
use helpers::*;

use glue::ArenaStatus;
use solana_signer::Signer;

fn setup_stuck() -> (TestConfig, solana_keypair::Keypair) {
    let (mut t, player) = setup_running();
    t.set_delegated();
    t.warp(glue::EMERGENCY_REFUND_SECS);
    (t, player)
}

#[test]
fn refund_pays_every_player_and_leaves_rent() {
    let (mut t, player) = setup_stuck();
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    let host_before = t.balance(&host);
    let player_before = t.balance(&player.pubkey());

    t.emergency_refund(&caller, &[host, player.pubkey()])
        .unwrap();

    assert_eq!(t.balance(&host), host_before + ENTRY_FEE);
    assert_eq!(t.balance(&player.pubkey()), player_before + ENTRY_FEE);

    let vault = t
        .vault()
        .expect("vault stays open (arena may be recovered later)");
    assert!(vault.refunded);
    let vault_account = t.program.get_account(&t.vault_pda).unwrap();
    let rent = t
        .program
        .minimum_balance_for_rent_exemption(vault_account.data.len());
    assert_eq!(vault_account.lamports, rent);
}

#[test]
fn refund_fails_when_not_delegated() {
    let (mut t, player) = setup_running();
    t.warp(glue::EMERGENCY_REFUND_SECS);
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    assert!(t
        .emergency_refund(&caller, &[host, player.pubkey()])
        .is_err());
    assert!(!t.vault().unwrap().refunded);
}

#[test]
fn refund_fails_before_deadline() {
    let (mut t, player) = setup_running();
    t.set_delegated();
    t.warp(glue::EMERGENCY_REFUND_SECS - 1);
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    assert!(t
        .emergency_refund(&caller, &[host, player.pubkey()])
        .is_err());
}

#[test]
fn refund_succeeds_exactly_at_deadline() {
    let (mut t, player) = setup_stuck();
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();
    assert!(t
        .emergency_refund(&caller, &[host, player.pubkey()])
        .is_ok());
}

#[test]
fn refund_fails_if_match_never_started() {
    let (mut t, player) = setup_with_player();
    t.set_delegated(); // artificial: a Waiting arena is never delegated in practice
    t.warp(glue::EMERGENCY_REFUND_SECS);
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    assert!(t
        .emergency_refund(&caller, &[host, player.pubkey()])
        .is_err());
}

#[test]
fn refund_twice_fails() {
    let (mut t, player) = setup_stuck();
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    t.emergency_refund(&caller, &[host, player.pubkey()])
        .unwrap();
    assert!(t
        .emergency_refund(&caller, &[host, player.pubkey()])
        .is_err());
}

#[test]
fn refund_with_missing_player_fails() {
    let (mut t, _player) = setup_stuck();
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    assert!(t.emergency_refund(&caller, &[host]).is_err());
    assert!(!t.vault().unwrap().refunded);
}

#[test]
fn refund_with_wrong_player_order_fails() {
    let (mut t, player) = setup_stuck();
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    assert!(t
        .emergency_refund(&caller, &[player.pubkey(), host])
        .is_err());
    assert!(!t.vault().unwrap().refunded);
}

#[test]
fn finished_but_unsettled_arena_can_be_refunded_after_deadline() {
    let (mut t, player) = setup_running();
    t.write_arena(|a| {
        a.status = ArenaStatus::Finished;
        a.winners = 0b10;
        a.tick = a.max_ticks;
    });
    t.set_delegated();
    t.warp(glue::EMERGENCY_REFUND_SECS);
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    assert!(t
        .emergency_refund(&caller, &[host, player.pubkey()])
        .is_ok());
}
