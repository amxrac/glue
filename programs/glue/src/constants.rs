use anchor_lang::prelude::*;

#[constant]
pub const STARTING_CREDITS: u64 = 100;
pub const DEFAULT_VISION: u16 = 10;
pub const DEFAULT_SPEED: u16 = 2;
pub const DEFAULT_CARRY_CAPACITY: u16 = 1;
pub const MAP_WIDTH: i16 = 100;
pub const MAP_HEIGHT: i16 = 100;
pub const MAX_POSITION_ATTEMPTS: u8 = 20;
pub const RESOURCE_REWARD: u64 = 10;
pub const MAX_ACTIVE_RESOURCES: usize = 20;
pub const COMMIT_INTERVAL: u64 = 10;
pub const KEEPER_PUBKEY: Pubkey = pubkey!("6hdhdfhmkbB4GENUkYkNrcnQq8NEsuc2gVu2S2vRZYL");
