mod helpers;
use helpers::*;

use glue::{BotMode, Resource};
use solana_keypair::Keypair;
use solana_signer::Signer;

const SESSION_SECS: i64 = 600;

fn place_bot(t: &mut TestConfig, i: usize, x: i16, y: i16, mode: BotMode, score: u64, speed: u16) {
    t.write_arena(|a| {
        let b = &mut a.bots[i];
        b.x = x;
        b.y = y;
        b.mode = mode;
        b.score = score;
        b.speed = speed;
        b.robbed_cooldown_until = 0;
    });
}

fn clear_resources(t: &mut TestConfig) {
    t.write_arena(|a| {
        for r in a.resources.iter_mut() {
            r.active = false;
        }
    });
}

fn set_tick(t: &mut TestConfig, tick: u64) {
    t.write_arena(|a| a.tick = tick);
}

fn set_cooldown(t: &mut TestConfig, i: usize, until: u64) {
    t.write_arena(|a| a.bots[i].robbed_cooldown_until = until);
}

fn setup_running_three() -> (TestConfig, Keypair, Keypair) {
    let (mut t, p1) = setup_with_player();
    let p2 = funded_keypair(&mut t);
    t.join_arena(&p2, "p2").unwrap();
    t.set_vrf_seed(SEED);
    t.start_arena().unwrap();
    (t, p1, p2)
}

#[test]
fn bots_start_in_gather() {
    let (t, _player) = setup_running();
    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[0].mode, BotMode::Gather);
    assert_eq!(arena.bots[1].mode, BotMode::Gather);
}

#[test]
fn set_mode_wallet_path() {
    let (mut t, player) = setup_running();
    t.set_mode(&player, player.pubkey(), None, BotMode::Hunt)
        .unwrap();
    assert_eq!(t.arena().unwrap().bots[1].mode, BotMode::Hunt);
}

#[test]
fn set_mode_session_path() {
    let (mut t, player) = setup_running();
    let session_key = funded_keypair(&mut t);
    let valid_until = t.now() + SESSION_SECS;
    let token = t.create_session(&session_key, &player, valid_until);

    t.set_mode(&session_key, player.pubkey(), Some(token), BotMode::Defend)
        .unwrap();
    assert_eq!(t.arena().unwrap().bots[1].mode, BotMode::Defend);
}

#[test]
fn set_mode_for_someone_else_fails() {
    let (mut t, victim) = setup_running();
    let attacker = funded_keypair(&mut t);
    assert!(t
        .set_mode(&attacker, victim.pubkey(), None, BotMode::Hunt)
        .is_err());
    assert_eq!(t.arena().unwrap().bots[1].mode, BotMode::Gather);
}

#[test]
fn set_mode_when_not_running_fails() {
    let (mut t, player) = setup_with_player();
    assert!(t
        .set_mode(&player, player.pubkey(), None, BotMode::Hunt)
        .is_err());
}

#[test]
fn switching_mode_keeps_upgrades() {
    let (mut t, player) = setup_running();
    t.write_arena(|a| {
        a.bots[1].speed = 5;
        a.bots[1].vision = 12;
    });
    t.set_mode(&player, player.pubkey(), None, BotMode::Defend)
        .unwrap();

    let bot = t.arena().unwrap().bots[1];
    assert_eq!(bot.speed, 5);
    assert_eq!(bot.vision, 12);
}

#[test]
fn hunter_robs_adjacent_bot() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 51, 51, BotMode::Gather, 50, 0);
    set_tick(&mut t, 0);

    t.advance_simulation(&payer).unwrap();

    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[1].score, 50 - glue::STEAL_AMOUNT);
    assert_eq!(arena.bots[0].score, glue::STEAL_AMOUNT);
    assert_eq!(
        arena.bots[1].robbed_cooldown_until,
        1 + glue::ROB_COOLDOWN_TICKS
    );
}

#[test]
fn robbery_is_capped_at_victim_score() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Gather, 5, 0);

    t.advance_simulation(&payer).unwrap();

    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[1].score, 0);
    assert_eq!(arena.bots[0].score, 5);
}

#[test]
fn victim_on_cooldown_is_not_robbed() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Gather, 50, 0);
    set_cooldown(&mut t, 1, 100);

    t.advance_simulation(&payer).unwrap();

    assert_eq!(t.arena().unwrap().bots[1].score, 50);
}

#[test]
fn defending_bot_is_not_robbed() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Defend, 50, 0);

    t.advance_simulation(&payer).unwrap();

    assert_eq!(t.arena().unwrap().bots[1].score, 50);
}

#[test]
fn bot_with_zero_score_is_not_robbed() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 7, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Gather, 0, 0);

    t.advance_simulation(&payer).unwrap();

    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[0].score, 7);
    assert_eq!(arena.bots[1].robbed_cooldown_until, 0);
}

#[test]
fn hunter_on_cooldown_cannot_rob() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Gather, 50, 0);
    set_cooldown(&mut t, 0, 100);

    t.advance_simulation(&payer).unwrap();

    assert_eq!(t.arena().unwrap().bots[1].score, 50);
}

#[test]
fn adjacent_hunters_first_in_order_robs_and_no_rob_back() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 50, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Hunt, 50, 0);
    set_tick(&mut t, 1);

    t.advance_simulation(&payer).unwrap();

    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[0].score, 50 + glue::STEAL_AMOUNT);
    assert_eq!(arena.bots[1].score, 50 - glue::STEAL_AMOUNT);
    assert_eq!(arena.bots[0].robbed_cooldown_until, 0);
}

#[test]
fn rotation_changes_which_hunter_goes_first() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 50, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Hunt, 50, 0);
    set_tick(&mut t, 0);

    t.advance_simulation(&payer).unwrap();

    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[1].score, 50 + glue::STEAL_AMOUNT);
    assert_eq!(arena.bots[0].score, 50 - glue::STEAL_AMOUNT);
}

#[test]
fn rotation_changes_which_victim_is_robbed() {
    let (mut t, _p1, _p2) = setup_running_three();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Gather, 50, 0);
    place_bot(&mut t, 2, 49, 50, BotMode::Gather, 50, 0);

    set_tick(&mut t, 2);
    t.advance_simulation(&payer).unwrap();
    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[1].score, 50 - glue::STEAL_AMOUNT);
    assert_eq!(arena.bots[2].score, 50);

    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 51, 50, BotMode::Gather, 50, 0);
    place_bot(&mut t, 2, 49, 50, BotMode::Gather, 50, 0);
    clear_resources(&mut t);
    set_tick(&mut t, 4);
    t.advance_simulation(&payer).unwrap();
    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[2].score, 50 - glue::STEAL_AMOUNT);
    assert_eq!(arena.bots[1].score, 50);
}

fn put_resource_at(t: &mut TestConfig, x: i16, y: i16) {
    clear_resources(t);
    t.write_arena(|a| a.resources[0] = Resource { x, y, active: true });
}

#[test]
fn hunter_does_not_collect() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 0);
    place_bot(&mut t, 1, 10, 10, BotMode::Gather, 0, 0);
    put_resource_at(&mut t, 50, 50);

    t.advance_simulation(&payer).unwrap();

    let arena = t.arena().unwrap();
    assert_eq!(arena.bots[0].score, 0);
    assert!(arena.resources[0].active);
}

#[test]
fn gatherer_collects_full_reward() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Gather, 0, 0);
    place_bot(&mut t, 1, 10, 10, BotMode::Gather, 0, 0);
    put_resource_at(&mut t, 50, 50);

    t.advance_simulation(&payer).unwrap();

    let bot = t.arena().unwrap().bots[0];
    assert_eq!(bot.score, glue::RESOURCE_REWARD);
    assert_eq!(bot.credits, glue::RESOURCE_REWARD);
}

#[test]
fn defender_collects_reduced_reward() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Defend, 0, 0);
    place_bot(&mut t, 1, 10, 10, BotMode::Gather, 0, 0);
    put_resource_at(&mut t, 50, 50);

    t.advance_simulation(&payer).unwrap();

    let bot = t.arena().unwrap().bots[0];
    assert_eq!(bot.score, glue::DEFEND_RESOURCE_REWARD);
    assert_eq!(bot.credits, glue::DEFEND_RESOURCE_REWARD);
}

#[test]
fn defender_moves_one_slower_and_keeps_stored_speed() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Defend, 0, 4);
    place_bot(&mut t, 1, 10, 10, BotMode::Gather, 0, 0);

    t.advance_simulation(&payer).unwrap();

    let bot = t.arena().unwrap().bots[0];
    let moved = (bot.x - 50).abs().max((bot.y - 50).abs());
    assert_eq!(moved, 3);
    assert_eq!(bot.speed, 4);
}

#[test]
fn hunter_stops_next_to_target_and_robs() {
    let (mut t, _player) = setup_running();
    let payer = funded_keypair(&mut t);
    clear_resources(&mut t);
    place_bot(&mut t, 0, 50, 50, BotMode::Hunt, 0, 2);
    place_bot(&mut t, 1, 53, 50, BotMode::Gather, 50, 0);

    t.advance_simulation(&payer).unwrap();

    let arena = t.arena().unwrap();
    assert_eq!((arena.bots[0].x, arena.bots[0].y), (52, 50));
    assert_eq!(arena.bots[1].score, 50 - glue::STEAL_AMOUNT);
}
