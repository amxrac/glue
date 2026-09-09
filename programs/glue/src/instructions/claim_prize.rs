use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};
use anchor_lang::prelude::*;

#[event]
pub struct ArenaSettled {
    pub arena_id: u64,
    pub winner: Pubkey,
    pub score: u64,
    pub payout: u64,
}

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
    pub fn claim_prize(&mut self, id: u64) -> Result<()> {
        let payout = self.arena_account.to_account_info().lamports();
        let winner_key = self.winner.key();
        let idx = self
            .arena_account
            .players
            .iter()
            .position(|p| *p == winner_key)
            .ok_or(ArenaError::NotWinner)?;
        let score = self.arena_account.bots[idx].score;
        emit!(ArenaSettled {
            arena_id: id,
            winner: self.winner.key(),
            score,
            payout,
        });
        Ok(())
    }
}

pub fn handler(ctx: Context<ClaimPrize>, id: u64) -> Result<()> {
    ctx.accounts.claim_prize(id)?;
    Ok(())
}
