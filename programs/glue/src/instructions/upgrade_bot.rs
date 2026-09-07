use crate::constants::*;
use crate::{error::ArenaError, state::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct UpgradeBot<'info> {
    pub player: Signer<'info>,
    #[account(
            mut,
            seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
            bump = arena_account.bump,
            constraint = arena_account.status == ArenaStatus::Running
                @ ArenaError::ArenaNotRunning
        )]
    pub arena_account: Account<'info, ArenaAccount>,
}

impl<'info> UpgradeBot<'info> {
    pub fn upgrade_bot(&mut self, upgrade: UpgradeType) -> Result<()> {
        let player_key = self.player.key();

        let bot_index = self
            .arena_account
            .players
            .iter()
            .position(|player| *player == player_key)
            .ok_or(ArenaError::PlayerNotInArena)?;

        let bot = &mut self.arena_account.bots[bot_index];

        match upgrade {
            UpgradeType::Speed => {
                require!(
                    bot.credits >= SPEED_UPGRADE_COST,
                    ArenaError::InsufficientCredits
                );

                bot.speed = bot
                    .speed
                    .checked_add(SPEED_UPGRADE_AMOUNT)
                    .ok_or(ArenaError::UpgradeOverflow)?;

                bot.credits -= SPEED_UPGRADE_COST;
            }

            UpgradeType::Vision => {
                require!(
                    bot.credits >= VISION_UPGRADE_COST,
                    ArenaError::InsufficientCredits
                );

                bot.vision = bot
                    .vision
                    .checked_add(VISION_UPGRADE_AMOUNT)
                    .ok_or(ArenaError::UpgradeOverflow)?;

                bot.credits -= VISION_UPGRADE_COST;
            }
        }

        Ok(())
    }
}

pub fn handler(ctx: Context<UpgradeBot>, _id: u64, upgrade: UpgradeType) -> Result<()> {
    ctx.accounts.upgrade_bot(upgrade)?;
    Ok(())
}
