use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        mut,
        close = winner,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        constraint = arena_account.status == ArenaStatus::Finished @ ArenaError::ArenaNotFinished,
        constraint = arena_account.winner == Some(winner.key()) @ ArenaError::NotWinner,
        bump = arena_account.bump
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    /// CHECK: for validation
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimPrize<'info> {
    pub fn claim_prize(&mut self) -> Result<()> {
        Ok(())
    }
}

pub fn handler(ctx: Context<ClaimPrize>, _id: u64) -> Result<()> {
    ctx.accounts.claim_prize()?;
    Ok(())
}
