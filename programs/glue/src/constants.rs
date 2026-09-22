use anchor_lang::prelude::*;

#[constant]
pub const DEFAULT_VISION: u16 = 10;
pub const DEFAULT_SPEED: u16 = 2;
pub const DEFAULT_CARRY_CAPACITY: u16 = 1;
pub const MAP_WIDTH: i16 = 100;
pub const MAP_HEIGHT: i16 = 100;
pub const MAX_POSITION_ATTEMPTS: u8 = 20;
pub const RESOURCE_REWARD: u64 = 10;
pub const MAX_ACTIVE_RESOURCES: usize = 20;
pub const COMMIT_INTERVAL: u64 = 10;
pub const SPEED_UPGRADE_COST: u64 = 10;
pub const VISION_UPGRADE_COST: u64 = 10;
pub const SPEED_UPGRADE_AMOUNT: u16 = 1;
pub const VISION_UPGRADE_AMOUNT: u16 = 1;
pub const DIRECTIONS: [(i16, i16); 8] = [
    (0, 1),
    (1, 1),
    (1, 0),
    (1, -1),
    (0, -1),
    (-1, -1),
    (-1, 0),
    (-1, 1),
];
pub const ER_VALIDATOR: Pubkey = pubkey!("MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e");
