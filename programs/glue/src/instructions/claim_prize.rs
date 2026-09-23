use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};
use anchor_lang::prelude::*;

#[event]
pub struct ArenaSettled {
    pub arena_id: u64,
    pub winners: Vec<Pubkey>,
    pub top_score: u64,
    pub pool: u64,
    pub share: u64,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(
        mut,
        close = host,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        constraint = arena_account.status == ArenaStatus::Finished @ ArenaError::ArenaNotFinished,
        bump = arena_account.bump
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    /// CHECK: for validation
    #[account(
        mut,
        address = arena_account.host @ ArenaError::UnauthorizedSigner
    )]
    pub host: UncheckedAccount<'info>,
}

impl<'info> ClaimPrize<'info> {
    pub fn claim_prize(&self, id: u64, leader_accounts: &[AccountInfo<'info>]) -> Result<()> {
        let arena = &self.arena_account;
        let n = self.arena_account.players.len();

        let leaders: Vec<(usize, Pubkey)> = (0..n)
            .filter(|&i| arena.winners & (1u8 << i) != 0)
            .map(|i| (i, arena.players[i]))
            .collect();

        require!(!leaders.is_empty(), ArenaError::NoActiveBots);
        require!(
            leader_accounts.len() == leaders.len(),
            ArenaError::InvalidWinnerAccounts
        );

        let pool = arena
            .entry_fee
            .checked_mul(n as u64)
            .ok_or(ArenaError::CounterOverflow)?;
        let count = leaders.len() as u64;
        let share = pool / count;
        let dust = pool % count;

        for (i, (acc, (bot_idx, key))) in leader_accounts.iter().zip(&leaders).enumerate() {
            require_keys_eq!(acc.key(), *key, ArenaError::InvalidWinnerAccounts);
            let amount = if i == 0 { share + dust } else { share };
            arena.sub_lamports(amount)?;
            acc.add_lamports(amount)?;
        }

        emit!(ArenaSettled {
            arena_id: id,
            winners: leaders.iter().map(|(_, k)| *k).collect(),
            top_score: arena.bots[leaders[0].0].score,
            pool,
            share,
        });
        Ok(())
    }
}

pub fn handler<'info>(ctx: Context<'info, ClaimPrize<'info>>, id: u64) -> Result<()> {
    ctx.accounts.claim_prize(id, ctx.remaining_accounts)?;
    Ok(())
}
