use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::rnd::random_u8_with_range;

use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    /// Signer PDA of the VRF program — proves the oracle produced this callback
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    /// The player account to update with the random bonus
    #[account(mut)]
    pub arena_account: Account<'info, ArenaAccount>,
}

impl<'info> ConsumeRandomness<'info> {
    pub fn consume_randomness(&mut self, randomness: [u8; 32]) -> Result<()> {
        self.arena_account.vrf_seed = Some(randomness);

        Ok(())
    }
}

pub fn handler(ctx: Context<ConsumeRandomness>, randomness: [u8; 32]) -> Result<()> {
    ctx.accounts.consume_randomness(randomness)?;
    Ok(())
}
