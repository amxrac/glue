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
}

impl<'info> CancelArena<'info> {
    pub fn cancel_arena(&self, remaining: &[AccountInfo<'info>]) -> Result<()> {
        require!(
            self.arena_account.status == ArenaStatus::Waiting,
            ArenaError::ArenaNotCancellable
        );

        let entry_fee = self.arena_account.entry_fee;
        let players = self.arena_account.players.clone();
        require!(
            remaining.len() == players.len(),
            ArenaError::MissingRefundAccounts
        );

        let arena_account_info = self.arena_account.to_account_info();

        for (i, player_key) in players.iter().enumerate() {
            let dest = &remaining[i];
            require!(dest.key == player_key, ArenaError::InvalidRefundAccount);
            require!(dest.is_writable, ArenaError::InvalidRefundAccount);

            let arena_lamports = arena_account_info.lamports();
            **arena_account_info.try_borrow_mut_lamports()? = arena_lamports
                .checked_sub(entry_fee)
                .ok_or(ArenaError::CounterOverflow)?;

            let dest_lamports = dest.lamports();
            **dest.try_borrow_mut_lamports()? = dest_lamports
                .checked_add(entry_fee)
                .ok_or(ArenaError::CounterOverflow)?;
        }
        Ok(())
    }
}

pub fn handler<'info>(ctx: Context<'info, CancelArena<'info>>, _id: u64) -> Result<()> {
    ctx.accounts.cancel_arena(ctx.remaining_accounts)?;
    Ok(())
}
