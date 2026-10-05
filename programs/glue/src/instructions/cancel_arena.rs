use crate::{error::ArenaError, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CancelArena<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        mut,
        close = host,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        bump = arena_account.bump,
        has_one = host
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    #[account(
        mut,
        close = host,
        seeds = [b"vault", arena_account.key().as_ref()],
        bump = vault_account.bump
    )]
    pub vault_account: Account<'info, VaultAccount>,
}

impl<'info> CancelArena<'info> {
    pub fn cancel_arena(&self, remaining: &[AccountInfo<'info>]) -> Result<()> {
        require!(
            self.arena_account.status == ArenaStatus::Waiting,
            ArenaError::ArenaNotCancellable
        );

        let entry_fee = self.vault_account.entry_fee;
        let players = self.arena_account.players.clone();
        require!(
            remaining.len() == players.len(),
            ArenaError::MissingRefundAccounts
        );

        let vault_account_info = self.vault_account.to_account_info();

        for (i, player_key) in players.iter().enumerate() {
            let dest = &remaining[i];
            require!(dest.key == player_key, ArenaError::InvalidRefundAccount);
            require!(dest.is_writable, ArenaError::InvalidRefundAccount);

            self.vault_account.sub_lamports(entry_fee)?;
            dest.add_lamports(entry_fee)?;
        }
        Ok(())
    }
}

pub fn handler<'info>(ctx: Context<'info, CancelArena<'info>>, _id: u64) -> Result<()> {
    ctx.accounts.cancel_arena(ctx.remaining_accounts)?;
    Ok(())
}
