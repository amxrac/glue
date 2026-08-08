use anchor_lang::prelude::*;

#[error_code]
pub enum ArenaError {
    #[msg("Invalid Arena")]
    InvalidArena,
    #[msg("Arena full")]
    ArenaFull,
    #[msg("Arena not full")]
    ArenaNotFull,
    #[msg("Player already in Arena")]
    PlayerAlreadyInArena,
    #[msg("Arena not joinable")]
    ArenaNotJoinable,
    #[msg("Randomness not ready")]
    RandomnessNotReady,
    #[msg("Unable to find spawn position")]
    UnableToFindSpawnPosition,
    #[msg("Arena not running")]
    ArenaNotRunning,
}
