use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::vrf_callback;

use crate::state::ArenaAccount;

#[vrf_callback]
#[derive(Accounts)]
pub struct ConsumeRandomnessCtx<'info> {
    #[account(mut)]
    pub arena_account: Account<'info, ArenaAccount>,
}

impl<'info> ConsumeRandomnessCtx<'info> {
    pub fn consume_randomness(&mut self, randomness: [u8; 32]) -> Result<()> {
        self.arena_account.vrf_seed = Some(randomness);

        Ok(())
    }
}

pub fn handler(ctx: Context<ConsumeRandomnessCtx>, randomness: [u8; 32]) -> Result<()> {
    ctx.accounts.consume_randomness(randomness)?;
    Ok(())
}
