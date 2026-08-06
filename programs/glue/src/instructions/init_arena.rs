use std::vec;

use crate::{state::ArenaAccount, Bot, Resource};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitArena<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        init,
        payer = host,
        space = ArenaAccount::INIT_SPACE,
        seeds = [b"arena", host.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitArena<'info> {
    pub fn init_arena(&mut self, id: u64, bumps: &InitArenaBumps) -> Result<()> {
        self.arena_account.set_inner(ArenaAccount {
            id,
            host: self.host.key(),
            players: vec![self.host.key()],
            bots: [Bot::default(); 6],
            status: crate::ArenaStatus::Waiting,
            vrf_seed: 0,
            spawn_counter: 0,
            resources: [Resource::default(); 20],
            tick: 0,
            max_ticks: 0,
            bump: bumps.arena_account,
        });

        Ok(())
    }
}

pub fn handler(ctx: Context<InitArena>, id: u64) -> Result<()> {
    ctx.accounts.init_arena(id, &ctx.bumps)?;
    Ok(())
}
