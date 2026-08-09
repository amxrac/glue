pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("EVh92BTdvhGSwQ2tx3wgZftuRfsP2oXfEcUmXoSwP9Hd");

#[program]
pub mod glue {
    use super::*;

    pub fn init_arena(ctx: Context<InitArena>, id: u64) -> Result<()> {
        instructions::init_arena::handler(ctx, id)
    }

    pub fn join_arena(ctx: Context<JoinArena>, id: u64) -> Result<()> {
        instructions::join_arena::handler(ctx, id)
    }

    pub fn start_arena(ctx: Context<StartArena>, id: u64) -> Result<()> {
        instructions::start_arena::handler(ctx, id)
    }

    pub fn request_randomness(ctx: Context<RequestRandomnessCtx>, id: u64) -> Result<()> {
        instructions::request_randomness::handler(ctx, id)
    }

    pub fn consume_randomness(
        ctx: Context<ConsumeRandomnessCtx>,
        randomness: [u8; 32],
    ) -> Result<()> {
        instructions::consume_randomness::handler(ctx, randomness)
    }

    pub fn delegate(ctx: Context<Delegate>, id: u64) -> Result<()> {
        instructions::delegate::handler(ctx, id)
    }

    // happens inside ER
    pub fn advance_simulation(ctx: Context<AdvanceSimulation>, id: u64) -> Result<()> {
        instructions::advance_simulation::handler(ctx, id)
    }

    pub fn upgrade_bot(ctx: Context<UpgradeBot>, upgrade: UpgradeType) -> Result<()> {
        instructions::upgrade_bot::handler(ctx, upgrade)
    }
}
