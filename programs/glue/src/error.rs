use anchor_lang::prelude::*;

#[error_code]
pub enum ArenaError {
    #[msg("Invalid Arena")]
    InvalidArena,
    #[msg("Arena full")]
    ArenaFull,
    #[msg("Not Enough Players")]
    NotEnoughPlayers,
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
    #[msg("Unauthorized Signer")]
    UnauthorizedSigner,
    #[msg("Game Over")]
    GameOver,
    #[msg("Counter Overflow")]
    CounterOverflow,
    #[msg("No Resource Slot")]
    NoResourceSlot,
    #[msg("No Valid Spawn Position")]
    NoValidSpawnPosition,
    #[msg("Player is not in this arena")]
    PlayerNotInArena,
    #[msg("Not enough credits")]
    InsufficientCredits,
    #[msg("Upgrade would overflow")]
    UpgradeOverflow,
    #[msg("Entry fee must be greater than 0")]
    EntryFeeError,
    #[msg("No Active Bots")]
    NoActiveBots,
    #[msg("Arena Not Finished")]
    ArenaNotFinished,
    #[msg("Prize Already Claimed")]
    PrizeAlreadyClaimed,
}
