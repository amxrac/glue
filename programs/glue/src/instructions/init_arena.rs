use std::vec;

use crate::{error::*, state::*, Resource};
use anchor_lang::context::CpiContext;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitArena<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        init,
        payer = host,
        space = 8 + ArenaAccount::INIT_SPACE,
        seeds = [b"arena", host.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitArena<'info> {
    pub fn init_arena(&mut self, id: u64, entry_fee: u64, bumps: &InitArenaBumps) -> Result<()> {
        require!(entry_fee > 0, ArenaError::EntryFeeError);
        let cpi_accounts = Transfer {
            from: self.host.to_account_info(),
            to: self.arena_account.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.system_program.key(), cpi_accounts);

        transfer(cpi_ctx, entry_fee)?;

        self.arena_account.set_inner(ArenaAccount {
            id,
            host: self.host.key(),
            players: vec![self.host.key()],
            bots: {
                let mut bots = [default_bot(); 6];
                bots[0].active = true;
                bots
            },
            status: crate::ArenaStatus::Waiting,
            vrf_seed: None,
            spawn_counter: 0,
            resources: [Resource::default(); 20],
            tick: 0,
            max_ticks: 60,
            entry_fee,
            winner: None,
            bump: bumps.arena_account,
        });

        Ok(())
    }
}

pub fn handler(ctx: Context<InitArena>, id: u64, entry_fee: u64) -> Result<()> {
    ctx.accounts.init_arena(id, entry_fee, &ctx.bumps)?;
    Ok(())
}
