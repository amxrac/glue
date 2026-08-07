use anchor_lang::prelude::*;

#[error_code]
pub enum ArenaError {
    #[msg("Invalid Arena")]
    InvalidArena,
    #[msg("Arena Full")]
    ArenaFull,
    #[msg("Arena not Full")]
    ArenaNotFull,
    #[msg("Player already in Arena")]
    PlayerAlreadyInArena,
    #[msg("Arena not joinable")]
    ArenaNotJoinable,
}
