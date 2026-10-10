use crate::constants::*;
use crate::{error::ArenaError, state::*};
use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

#[derive(Accounts, Session)]
#[instruction(id: u64)]
pub struct SetMode<'info> {
    pub signer: Signer<'info>,
    #[account(
            mut,
            seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
            bump = arena_account.bump,
            constraint = arena_account.status == ArenaStatus::Running
                @ ArenaError::ArenaNotRunning
        )]
    pub arena_account: Account<'info, ArenaAccount>,
    /// CHECK: for signer validation
    pub player_wallet: UncheckedAccount<'info>,
    #[session(
           signer = signer,
           authority = player_wallet.key()
       )]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

impl<'info> SetMode<'info> {
    pub fn set_mode(&mut self, mode: BotMode) -> Result<()> {
        let player_wallet = self.player_wallet.key();

        let bot_index = self
            .arena_account
            .players
            .iter()
            .position(|player| *player == player_wallet)
            .ok_or(ArenaError::PlayerNotInArena)?;

        let bot = &mut self.arena_account.bots[bot_index];

        bot.mode = mode;
        Ok(())
    }
}

pub fn handler(ctx: Context<SetMode>, _id: u64, mode: BotMode) -> Result<()> {
    ctx.accounts.set_mode(mode)?;
    Ok(())
}
