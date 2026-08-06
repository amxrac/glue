pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("F2k77ye35MiL7n5TZfe74fRPK1MmZiX3eAJBzEz2wMYm");

#[program]
pub mod glue {
    use super::*;

    pub fn init_arena(ctx: Context<InitArena>, id: u64) -> Result<()> {
        instructions::init_arena::handler(ctx, id)
    }

    pub fn join_arena(ctx: Context<JoinArena>, id: u64) -> Result<()> {
        instructions::join_arena::handler(ctx, id)
    }
}
