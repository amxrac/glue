use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct LeaveArena<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
            mut,
            seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
            bump = arena_account.bump,
        )]
    pub arena_account: Account<'info, ArenaAccount>,
}

impl<'info> LeaveArena<'info> {
    pub fn leave_arena(&mut self) -> Result<()> {
        let arena = &mut self.arena_account;
        require!(
            arena.status == ArenaStatus::Waiting,
            ArenaError::ArenaAlreadyStarted
        );

        require!(self.player.key() != arena.host, ArenaError::HostCannotLeave);

        let idx = arena
            .players
            .iter()
            .position(|p| *p == self.player.key())
            .ok_or(ArenaError::NotAPlayer)?;
        arena.players.remove(idx);

        let n = arena.players.len();
        for (i, bot) in arena.bots.iter_mut().enumerate() {
            bot.active = i < n;
        }

        let entry_fee = arena.entry_fee;
        arena.sub_lamports(entry_fee)?;
        self.player.add_lamports(entry_fee)?;

        Ok(())
    }
}

pub fn handler(ctx: Context<LeaveArena>, _id: u64) -> Result<()> {
    ctx.accounts.leave_arena()?;
    Ok(())
}
