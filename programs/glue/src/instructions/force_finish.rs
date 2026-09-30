use anchor_lang::prelude::*;

use crate::{constants::*, error::ArenaError, state::*};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ForceFinish<'info> {
    #[account(
        mut,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        bump = arena_account.bump,
    )]
    pub arena_account: Account<'info, ArenaAccount>,
}

impl<'info> ForceFinish<'info> {
    pub fn force_finish(&mut self) -> Result<()> {
        require!(
            self.arena_account.status == ArenaStatus::Running,
            ArenaError::ArenaNotRunning
        );
        let now = Clock::get()?.unix_timestamp;
        let deadline = self
            .arena_account
            .started_at
            .checked_add(MATCH_TIMEOUT_SECS)
            .ok_or(ArenaError::CounterOverflow)?;
        require!(now >= deadline, ArenaError::MatchNotTimedOut);

        self.arena_account.finalize(true)?;

        Ok(())
    }
}

pub fn handler(ctx: Context<ForceFinish>, _id: u64) -> Result<()> {
    ctx.accounts.force_finish()
}
