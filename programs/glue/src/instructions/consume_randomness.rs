use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::{vrf, vrf_callback},
    vrf::{
        self,
        instructions::{create_request_scoped_randomness_ix, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};

#[derive(Accounts)]
#[vrf_callback]
pub struct ConsumeRandomnessCtx<'info> {
    #[account(address = ephemeral_rollups_sdk::vrf::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
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
