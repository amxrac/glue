use anchor_lang::prelude::*;

#[error_code]
pub enum ArenaError {
    #[msg("Invalid Arena")]
    InvalidArena,
    #[msg("Arena Full")]
    ArenaFull,
    #[msg("Player already in Arena")]
    PlayerAlreadyInArena,
}
