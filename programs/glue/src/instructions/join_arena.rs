use std::vec;

use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct JoinArena<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        bump = arena_account.bump
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    pub system_program: Program<'info, System>,
}

impl<'info> JoinArena<'info> {
    pub fn join_arena(&mut self) -> Result<()> {
        require!(
            self.arena_account.status == ArenaStatus::Waiting,
            ArenaError::ArenaNotJoinable
        );
        require!(self.arena_account.players.len() < 6, ArenaError::ArenaFull);
        require!(
            !self.arena_account.players.contains(&self.player.key()),
            ArenaError::PlayerAlreadyInArena
        );

        let cpi_accounts = Transfer {
            from: self.player.to_account_info(),
            to: self.arena_account.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.system_program.key(), cpi_accounts);

        transfer(cpi_ctx, self.arena_account.entry_fee)?;

        let slot = self.arena_account.players.len();
        self.arena_account.players.push(self.player.key());
        self.arena_account.bots[slot].active = true;

        Ok(())
    }
}

pub fn handler(ctx: Context<JoinArena>, _id: u64) -> Result<()> {
    ctx.accounts.join_arena()?;
    Ok(())
}
