mod helpers;
use helpers::*;

use glue::UpgradeType;
use solana_signer::Signer;

const SESSION_SECS: i64 = 600;

fn give_credits(t: &mut TestConfig, bot: usize, credits: u64) {
    t.write_arena(|a| a.bots[bot].credits = credits);
}

fn session_for(
    t: &mut TestConfig,
    wallet: &solana_keypair::Keypair,
) -> (solana_keypair::Keypair, solana_pubkey::Pubkey) {
    let session_key = funded_keypair(t);
    let valid_until = t.now() + SESSION_SECS;
    let token = t.create_session(&session_key, wallet, valid_until);
    (session_key, token)
}

#[test]
fn wallet_path_upgrades_own_bot() {
    let (mut t, player) = setup_running();
    give_credits(&mut t, 1, 20);

    t.upgrade_bot(&player, player.pubkey(), None, UpgradeType::Speed)
        .unwrap();

    let bot = t.arena().unwrap().bots[1];
    assert_eq!(bot.speed, glue::DEFAULT_SPEED + glue::SPEED_UPGRADE_AMOUNT);
    assert_eq!(bot.credits, 20 - glue::SPEED_UPGRADE_COST);
}

#[test]
fn session_path_upgrades_player_bot_only() {
    let (mut t, player) = setup_running();
    give_credits(&mut t, 1, 20);
    let (session_key, token) = session_for(&mut t, &player);

    t.upgrade_bot(
        &session_key,
        player.pubkey(),
        Some(token),
        UpgradeType::Vision,
    )
    .unwrap();

    let arena = t.arena().unwrap();
    assert_eq!(
        arena.bots[1].vision,
        glue::DEFAULT_VISION + glue::VISION_UPGRADE_AMOUNT
    );
    assert_eq!(arena.bots[1].credits, 20 - glue::VISION_UPGRADE_COST);
    assert_eq!(arena.bots[0].vision, glue::DEFAULT_VISION);
}

#[test]
fn session_upgrades_spend_credits_until_empty() {
    let (mut t, player) = setup_running();
    give_credits(
        &mut t,
        1,
        glue::SPEED_UPGRADE_COST + glue::VISION_UPGRADE_COST,
    );
    let (session_key, token) = session_for(&mut t, &player);

    t.upgrade_bot(
        &session_key,
        player.pubkey(),
        Some(token),
        UpgradeType::Speed,
    )
    .unwrap();
    t.upgrade_bot(
        &session_key,
        player.pubkey(),
        Some(token),
        UpgradeType::Vision,
    )
    .unwrap();
    assert_eq!(t.arena().unwrap().bots[1].credits, 0);

    assert!(t
        .upgrade_bot(
            &session_key,
            player.pubkey(),
            Some(token),
            UpgradeType::Speed
        )
        .is_err());
}

#[test]
fn expired_session_fails() {
    let (mut t, player) = setup_running();
    give_credits(&mut t, 1, 20);
    let (session_key, token) = session_for(&mut t, &player);

    t.warp(SESSION_SECS);

    assert!(t
        .upgrade_bot(
            &session_key,
            player.pubkey(),
            Some(token),
            UpgradeType::Speed
        )
        .is_err());
    assert_eq!(t.arena().unwrap().bots[1].credits, 20);
}

#[test]
fn session_key_without_token_fails() {
    let (mut t, player) = setup_running();
    give_credits(&mut t, 1, 20);
    let (session_key, _token) = session_for(&mut t, &player);

    assert!(t
        .upgrade_bot(&session_key, player.pubkey(), None, UpgradeType::Speed)
        .is_err());
}

#[test]
fn token_used_by_wrong_key_fails() {
    let (mut t, player) = setup_running();
    give_credits(&mut t, 1, 20);
    let (_key_a, token_a) = session_for(&mut t, &player);
    let key_b = funded_keypair(&mut t);

    assert!(t
        .upgrade_bot(&key_b, player.pubkey(), Some(token_a), UpgradeType::Speed)
        .is_err());
    assert_eq!(t.arena().unwrap().bots[1].credits, 20);
}

#[test]
fn attacker_cannot_upgrade_someone_elses_bot() {
    let (mut t, victim) = setup_running();
    give_credits(&mut t, 1, 20);
    let attacker = funded_keypair(&mut t);
    let (attacker_key, attacker_token) = session_for(&mut t, &attacker);

    assert!(t
        .upgrade_bot(
            &attacker_key,
            victim.pubkey(),
            Some(attacker_token),
            UpgradeType::Speed
        )
        .is_err());
    assert!(t
        .upgrade_bot(&attacker, victim.pubkey(), None, UpgradeType::Speed)
        .is_err());

    assert_eq!(t.arena().unwrap().bots[1].credits, 20);
}

#[test]
fn insufficient_credits_fails_on_session_path() {
    let (mut t, player) = setup_running();
    give_credits(&mut t, 1, 0);
    let (session_key, token) = session_for(&mut t, &player);

    assert!(t
        .upgrade_bot(
            &session_key,
            player.pubkey(),
            Some(token),
            UpgradeType::Vision
        )
        .is_err());
}

#[test]
fn upgrade_when_not_running_fails() {
    let (mut t, player) = setup_with_player();
    give_credits(&mut t, 1, 20);
    assert!(t
        .upgrade_bot(&player, player.pubkey(), None, UpgradeType::Speed)
        .is_err());
}

#[test]
fn non_player_upgrade_fails() {
    let (mut t, _player) = setup_running();
    let stranger = funded_keypair(&mut t);
    assert!(t
        .upgrade_bot(&stranger, stranger.pubkey(), None, UpgradeType::Speed)
        .is_err());
}
