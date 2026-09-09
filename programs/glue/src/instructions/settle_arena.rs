use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus};
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{FoldableIntentBuilder, MagicIntentBundleBuilder};

#[commit]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct SettleArena<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
            mut,
            seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
            bump = arena_account.bump,
            has_one = host
        )]
    pub arena_account: Account<'info, ArenaAccount>,
}

impl<'info> SettleArena<'info> {
    pub fn settle_arena(&mut self) -> Result<()> {
        require!(
            self.arena_account.status == ArenaStatus::Finished,
            ArenaError::ArenaNotFinished
        );
        self.arena_account.exit(&crate::ID)?;

        MagicIntentBundleBuilder::new(
            self.host.to_account_info(),
            self.magic_context.to_account_info(),
            self.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[self.arena_account.to_account_info()])
        .build_and_invoke()?;

        Ok(())
    }
}

pub fn handler(ctx: Context<SettleArena>, _id: u64) -> Result<()> {
    ctx.accounts.settle_arena()?;
    Ok(())
}
