use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};

use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};

#[delegate]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct Delegate<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        mut,
        del,
        seeds = [
            b"arena",
            host.key().as_ref(),
            &id.to_le_bytes()
        ],
        bump
    )]
    pub arena_account: AccountInfo<'info>,
    /// CHECK: Validator account supplied to the delegation program
    pub validator: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Delegate<'info> {
    pub fn delegate(&mut self, id: u64) -> Result<()> {
        let data = self.arena_account.try_borrow_data()?;
        let arena = ArenaAccount::try_deserialize(&mut &data[..])?;
        require!(arena.host == self.host.key(), ArenaError::Unauthorized);
        require!(
            arena.status == ArenaStatus::Running,
            ArenaError::ArenaNotRunning
        );
        drop(data);
        let id_bytes = id.to_le_bytes();
        let pda_seeds: &[&[u8]] = &[b"arena", self.host.key().as_ref(), &id_bytes];

        // Hand the arena_account PDA over to the Ephemeral Rollup
        self.delegate_arena_account(
            &self.host,
            pda_seeds,
            DelegateConfig {
                validator: Some(self.validator.key()),
                ..DelegateConfig::default()
            },
        )?;

        Ok(())
    }
}

pub fn handler(ctx: Context<Delegate>, id: u64) -> Result<()> {
    ctx.accounts.delegate(id)?;
    Ok(())
}
