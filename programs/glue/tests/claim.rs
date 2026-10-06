mod helpers;
use helpers::*;

use glue::ArenaStatus;
use solana_signer::Signer;

fn finish_with_winners(t: &mut TestConfig, winners: u8) {
    t.write_arena(|a| {
        a.status = ArenaStatus::Finished;
        a.winners = winners;
        a.tick = a.max_ticks;
    });
}

#[test]
fn claim_pays_single_winner_from_vault_and_closes() {
    let (mut t, player) = setup_running();
    finish_with_winners(&mut t, 0b10);
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    let pool = ENTRY_FEE * 2;
    let player_before = t.balance(&player.pubkey());
    let host_before = t.balance(&host);
    let arena_lamports = t.balance(&t.arena_pda);
    let vault_lamports = t.balance(&t.vault_pda);

    t.claim_prize(&caller, &[player.pubkey()]).unwrap();

    assert_eq!(t.balance(&player.pubkey()), player_before + pool);
    assert_eq!(
        t.balance(&host),
        host_before + arena_lamports + (vault_lamports - pool)
    );
    assert!(t.arena().is_none());
    assert!(t.vault().is_none());
}

#[test]
fn claim_splits_tie_with_remainder_to_first_winner() {
    let fee = 1_000_001;
    let mut t = setup();
    t.init_arena(fee, NAME).unwrap();
    let p1 = funded_keypair(&mut t);
    let p2 = funded_keypair(&mut t);
    t.join_arena(&p1, "p1").unwrap();
    t.join_arena(&p2, "p2").unwrap();
    t.set_vrf_seed(SEED);
    t.start_arena().unwrap();
    finish_with_winners(&mut t, 0b110);
    let caller = funded_keypair(&mut t);

    let pool = fee * 3;
    let share = pool / 2;
    let dust = pool % 2;
    let p1_before = t.balance(&p1.pubkey());
    let p2_before = t.balance(&p2.pubkey());

    t.claim_prize(&caller, &[p1.pubkey(), p2.pubkey()]).unwrap();

    assert_eq!(t.balance(&p1.pubkey()), p1_before + share + dust);
    assert_eq!(t.balance(&p2.pubkey()), p2_before + share);
}

#[test]
fn claim_after_real_final_tick_pays_top_scorer() {
    let (mut t, player) = setup_running();
    t.write_arena(|a| a.bots[1].score = 100);
    let caller = funded_keypair(&mut t);

    run_to_end(&mut t, &caller);

    let arena = t.arena().unwrap();
    assert_eq!(arena.status, ArenaStatus::Finished);
    assert_eq!(arena.winners, 0b10);

    let before = t.balance(&player.pubkey());
    t.claim_prize(&caller, &[player.pubkey()]).unwrap();
    assert_eq!(t.balance(&player.pubkey()), before + ENTRY_FEE * 2);
}

#[test]
fn forced_finish_claim_refunds_everyone() {
    let (mut t, player) = setup_running();
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    t.warp(glue::MATCH_TIMEOUT_SECS + 1);
    t.force_finish(&caller).unwrap();
    assert_eq!(t.arena().unwrap().winners, 0b11);
    let player_before = t.balance(&player.pubkey());
    t.claim_prize(&caller, &[host, player.pubkey()]).unwrap();

    assert_eq!(t.balance(&player.pubkey()), player_before + ENTRY_FEE);
}

#[test]
fn claim_with_wrong_winner_account_fails() {
    let (mut t, _player) = setup_running();
    finish_with_winners(&mut t, 0b10);
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    assert!(t.claim_prize(&caller, &[host]).is_err());
    assert!(t.arena().is_some());
}

#[test]
fn claim_with_missing_winner_fails() {
    let (mut t, _player) = setup_running();
    finish_with_winners(&mut t, 0b10);
    let caller = funded_keypair(&mut t);

    assert!(t.claim_prize(&caller, &[]).is_err());
    assert!(t.arena().is_some());
}

#[test]
fn claim_before_finish_fails() {
    let (mut t, player) = setup_running();
    let caller = funded_keypair(&mut t);
    assert!(t.claim_prize(&caller, &[player.pubkey()]).is_err());
    assert!(t.arena().is_some());
}

#[test]
fn claim_twice_fails() {
    let (mut t, player) = setup_running();
    finish_with_winners(&mut t, 0b10);
    let caller = funded_keypair(&mut t);

    t.claim_prize(&caller, &[player.pubkey()]).unwrap();
    assert!(t.claim_prize(&caller, &[player.pubkey()]).is_err());
}

#[test]
fn claim_after_emergency_refund_closes_without_paying() {
    let (mut t, player) = setup_running();
    let caller = funded_keypair(&mut t);
    let host = t.host.pubkey();

    finish_with_winners(&mut t, 0b10);
    t.set_delegated();
    t.warp(glue::EMERGENCY_REFUND_SECS);
    t.emergency_refund(&caller, &[host, player.pubkey()])
        .unwrap();

    t.set_undelegated();
    let player_before = t.balance(&player.pubkey());

    t.claim_prize(&caller, &[player.pubkey()]).unwrap();

    assert_eq!(t.balance(&player.pubkey()), player_before);
    assert!(t.arena().is_none());
    assert!(t.vault().is_none());
}
