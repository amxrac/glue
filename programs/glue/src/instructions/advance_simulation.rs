use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;

use crate::constants::*;
use crate::state::coordinate_occupied;
use crate::{error::ArenaError, state::*};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct AdvanceSimulation<'info> {
    #[account(
        mut,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        bump = arena_account.bump,
    )]
    pub arena_account: Account<'info, ArenaAccount>,
}

impl<'info> AdvanceSimulation<'info> {
    pub fn advance_simulation(&mut self) -> Result<()> {
        self.increment_tick()?;
        self.update_bots()?;
        self.resolve_resource_collection()?;
        self.spawn_resources()?;
        self.finish_if_complete()?;

        Ok(())
    }

    fn increment_tick(&mut self) -> Result<()> {
        require!(
            self.arena_account.status == ArenaStatus::Running,
            ArenaError::ArenaNotRunning
        );
        require!(
            self.arena_account.tick < self.arena_account.max_ticks,
            ArenaError::GameOver
        );

        self.arena_account.tick = self
            .arena_account
            .tick
            .checked_add(1)
            .ok_or(ArenaError::CounterOverflow)?;

        Ok(())
    }

    fn update_bots(&mut self) -> Result<()> {
        let resources = self.arena_account.resources;

        for bot_index in 0..self.arena_account.bots.len() {
            if !self.arena_account.bots[bot_index].active {
                continue;
            }

            let bot = self.arena_account.bots[bot_index];

            let vision = bot.vision as i32;
            let vision_sq = vision * vision;
            let speed = bot.speed as i16;

            let mut target = None;
            let mut closest_distance = i32::MAX;

            for resource in resources.iter() {
                if !resource.active {
                    continue;
                }

                let dx = resource.x as i32 - bot.x as i32;
                let dy = resource.y as i32 - bot.y as i32;
                let distance = dx * dx + dy * dy;

                if distance <= vision_sq && distance < closest_distance {
                    closest_distance = distance;
                    target = Some((resource.x, resource.y));
                }
            }

            let Some((target_x, target_y)) = target else {
                continue;
            };

            let dx = target_x - bot.x;
            let dy = target_y - bot.y;

            let mut new_x = bot.x;
            let mut new_y = bot.y;

            if dx != 0 {
                new_x += dx.signum() * speed.min(dx.abs());
            }

            if dy != 0 {
                new_y += dy.signum() * speed.min(dy.abs());
            }

            new_x = new_x.clamp(0, (MAP_WIDTH - 1) as i16);
            new_y = new_y.clamp(0, (MAP_HEIGHT - 1) as i16);

            if coordinate_occupied(
                &self.arena_account,
                new_x,
                new_y,
                self.arena_account.bots.len(),
                0,
                Some(bot_index),
            ) {
                continue;
            }

            self.arena_account.bots[bot_index].x = new_x;
            self.arena_account.bots[bot_index].y = new_y;
        }

        Ok(())
    }

    fn resolve_resource_collection(&mut self) -> Result<()> {
        let mut resources = self.arena_account.resources;

        for bot in self.arena_account.bots.iter_mut() {
            if !bot.active {
                continue;
            }

            for resource in resources.iter_mut() {
                if !resource.active {
                    continue;
                }

                if bot.x == resource.x && bot.y == resource.y {
                    resource.active = false;

                    bot.score += RESOURCE_REWARD;
                    bot.credits += RESOURCE_REWARD;

                    break;
                }
            }
        }
        self.arena_account.resources = resources;
        Ok(())
    }

    fn spawn_resources(&mut self) -> Result<()> {
        let active_resources = self
            .arena_account
            .resources
            .iter()
            .filter(|resource| resource.active)
            .count();

        if active_resources >= MAX_ACTIVE_RESOURCES {
            return Ok(());
        }

        let index = self
            .arena_account
            .resources
            .iter()
            .position(|resource| !resource.active)
            .ok_or(ArenaError::NoResourceSlot)?;

        let seed = self
            .arena_account
            .vrf_seed
            .ok_or(ArenaError::RandomnessNotReady)?;

        let mut found = None;

        for attempt in 0..MAX_POSITION_ATTEMPTS {
            let counter = self
                .arena_account
                .spawn_counter
                .checked_add(attempt as u32)
                .ok_or(ArenaError::CounterOverflow)?;

            let random = hashv(&[&seed, &counter.to_le_bytes()]);

            let bytes = random.to_bytes();

            let x = (u16::from_le_bytes([bytes[0], bytes[1]]) % MAP_WIDTH as u16) as i16;

            let y = (u16::from_le_bytes([bytes[2], bytes[3]]) % MAP_HEIGHT as u16) as i16;

            if !coordinate_occupied(
                &self.arena_account,
                x,
                y,
                self.arena_account.bots.len(),
                self.arena_account.resources.len(),
                None,
            ) {
                found = Some((x, y, counter));
                break;
            }
        }

        let Some((x, y, counter)) = found else {
            return Ok(());
        };

        self.arena_account.resources[index] = Resource { x, y, active: true };

        self.arena_account.spawn_counter =
            counter.checked_add(1).ok_or(ArenaError::CounterOverflow)?;

        Ok(())
    }

    fn finish_if_complete(&mut self) -> Result<()> {
        if self.arena_account.tick >= self.arena_account.max_ticks {
            self.arena_account.status = ArenaStatus::Finished;

            let winner_idx = self
                .arena_account
                .bots
                .iter()
                .enumerate()
                .filter(|(i, b)| b.active && *i < self.arena_account.players.len())
                .max_by_key(|(i, b)| (b.score, std::cmp::Reverse(*i)))
                .map(|(i, _)| i)
                .ok_or(ArenaError::NoActiveBots)?;

            self.arena_account.winner = Some(self.arena_account.players[winner_idx]);
        }

        Ok(())
    }
}

pub fn handler(ctx: Context<AdvanceSimulation>, _id: u64) -> Result<()> {
    ctx.accounts.advance_simulation()?;
    Ok(())
}
