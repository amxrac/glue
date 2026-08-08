use anchor_lang::prelude::*;

#[constant]
pub const STARTING_CREDITS: u64 = 100;
pub const DEFAULT_VISION: u16 = 10;
pub const DEFAULT_SPEED: u16 = 2;
pub const DEFAULT_CARRY_CAPACITY: u16 = 1;
pub const MAP_WIDTH: i16 = 100;
pub const MAP_HEIGHT: i16 = 100;
pub const MAX_POSITION_ATTEMPTS: u8 = 20;
