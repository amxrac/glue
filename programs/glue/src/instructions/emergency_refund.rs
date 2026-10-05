use crate::{constants::*, error::ArenaError, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct EmergencyRefund<'info> {
    /// CHECK: for pda derivation
    pub arena_account: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"vault", arena_account.key().as_ref()],
        bump = vault_account.bump
    )]
    pub vault_account: Account<'info, VaultAccount>,
}

impl<'info> EmergencyRefund<'info> {
    pub fn emergency_refund(&mut self, remaining: &[AccountInfo<'info>]) -> Result<()> {
        require_keys_eq!(
            *self.arena_account.owner,
            DELEGATION_PROGRAM_ID,
            ArenaError::ArenaNotDelegated
        );
        let started_at = self.vault_account.started_at;
        require!(started_at > 0, ArenaError::ArenaNotRunning);

        let now = Clock::get()?.unix_timestamp;
        let deadline = started_at
            .checked_add(EMERGENCY_REFUND_SECS)
            .ok_or(ArenaError::CounterOverflow)?;
        require!(now >= deadline, ArenaError::EmergencyRefundNotReady);

        require!(!self.vault_account.refunded, ArenaError::AlreadyRefunded);

        let players = self.vault_account.players.clone();
        require!(
            remaining.len() == players.len(),
            ArenaError::MissingRefundAccounts
        );
        let fee = self.vault_account.entry_fee;

        for (account, player) in remaining.iter().zip(players.iter()) {
            require_keys_eq!(account.key(), *player, ArenaError::InvalidRefundAccount);
            require!(account.is_writable, ArenaError::InvalidRefundAccount);
            self.vault_account.sub_lamports(fee)?;
            account.add_lamports(fee)?;
        }

        self.vault_account.refunded = true;

        Ok(())
    }
}

pub fn handler<'info>(ctx: Context<'info, EmergencyRefund<'info>>) -> Result<()> {
    ctx.accounts.emergency_refund(ctx.remaining_accounts)
}
