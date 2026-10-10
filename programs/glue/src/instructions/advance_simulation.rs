use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;

use crate::{constants::*, error::ArenaError, state::*};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct AdvanceSimulation<'info> {
    #[account(
        mut,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        bump = arena_account.bump,
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    #[account(address = crank_signer_pda(&arena_account.host) @ ArenaError::UnauthorizedSigner)]
    pub crank_signer: Signer<'info>,
}

impl<'info> AdvanceSimulation<'info> {
    pub fn advance_simulation(&mut self) -> Result<()> {
        self.increment_tick()?;
        self.update_bots()?;
        self.resolve_resource_collection()?;
        self.resolve_robberies()?;
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
        let tick = self.arena_account.tick;

        if tick % 8 == 0 {
            for bot in self.arena_account.bots.iter_mut() {
                bot.flip_x = false;
                bot.flip_y = false;
            }
        }

        for bot_index in 0..self.arena_account.bots.len() {
            if !self.arena_account.bots[bot_index].active {
                continue;
            }

            let bot = self.arena_account.bots[bot_index];
            let vision = bot.vision as i32;
            let vision_sq = vision * vision;
            let speed = if bot.mode == BotMode::Defend {
                bot.speed.saturating_sub(DEFEND_SPEED_PENALTY).max(1)
            } else {
                bot.speed
            } as i16;

            let mut target = None;
            let mut closest_distance = i32::MAX;
            let mut chasing_bot = false;

            if bot.mode == BotMode::Hunt {
                for (other_index, other) in self.arena_account.bots.iter().enumerate() {
                    if other_index == bot_index
                        || !other.active
                        || other.mode == BotMode::Defend
                        || tick < other.robbed_cooldown_until
                        || other.score == 0
                    {
                        continue;
                    }
                    let dx = other.x as i32 - bot.x as i32;
                    let dy = other.y as i32 - bot.y as i32;
                    let distance = dx * dx + dy * dy;
                    if distance <= vision_sq && distance < closest_distance {
                        closest_distance = distance;
                        target = Some((other.x, other.y));
                    }
                }
                chasing_bot = target.is_some();
            } else {
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
            }

            let (target_x, target_y) = match target {
                Some(t) => t,
                None => {
                    let seed = self
                        .arena_account
                        .vrf_seed
                        .ok_or(ArenaError::RandomnessNotReady)?;
                    let epoch = tick / 8;
                    let h = hashv(&[
                        &seed,
                        &(bot_index as u8).to_le_bytes(),
                        &epoch.to_le_bytes(),
                    ]);
                    let (mut dx, mut dy) = DIRECTIONS[(h.to_bytes()[0] % 8) as usize];

                    let mut flip_x = bot.flip_x;
                    let mut flip_y = bot.flip_y;
                    if flip_x {
                        dx = -dx;
                    }
                    if flip_y {
                        dy = -dy;
                    }

                    let step_x = bot.x + dx * speed;
                    if step_x < 0 || step_x > MAP_WIDTH - 1 {
                        dx = -dx;
                        flip_x = !flip_x;
                    }
                    let step_y = bot.y + dy * speed;
                    if step_y < 0 || step_y > MAP_HEIGHT - 1 {
                        dy = -dy;
                        flip_y = !flip_y;
                    }

                    self.arena_account.bots[bot_index].flip_x = flip_x;
                    self.arena_account.bots[bot_index].flip_y = flip_y;

                    (bot.x + dx * speed, bot.y + dy * speed)
                }
            };

            let step = |d: i16| -> i16 {
                if chasing_bot {
                    if d.abs() <= 1 {
                        0
                    } else {
                        d.signum() * speed.min(d.abs() - 1)
                    }
                } else if d != 0 {
                    d.signum() * speed.min(d.abs())
                } else {
                    0
                }
            };

            let new_x = (bot.x + step(target_x - bot.x)).clamp(0, MAP_WIDTH - 1);
            let new_y = (bot.y + step(target_y - bot.y)).clamp(0, MAP_HEIGHT - 1);

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
            if !bot.active || bot.mode == BotMode::Hunt {
                continue;
            }

            for resource in resources.iter_mut() {
                if !resource.active {
                    continue;
                }

                if bot.x == resource.x && bot.y == resource.y {
                    resource.active = false;

                    let reward = if bot.mode == BotMode::Defend {
                        DEFEND_RESOURCE_REWARD
                    } else {
                        RESOURCE_REWARD
                    };

                    bot.score += reward;
                    bot.credits += reward;

                    break;
                }
            }
        }
        self.arena_account.resources = resources;
        Ok(())
    }

    fn resolve_robberies(&mut self) -> Result<()> {
        let tick = self.arena_account.tick;
        let n = self.arena_account.players.len();
        if n == 0 {
            return Ok(());
        }

        let start = (tick % n as u64) as usize;
        for k in 0..n {
            let h = (start + k) % n;
            let hunter = self.arena_account.bots[h];

            if !hunter.active || hunter.mode != BotMode::Hunt || tick < hunter.robbed_cooldown_until
            {
                continue;
            }

            let victim = (0..n).map(|k| (start + k) % n).find(|&v| {
                let b = self.arena_account.bots[v];
                v != h
                    && b.active
                    && b.mode != BotMode::Defend
                    && tick >= b.robbed_cooldown_until
                    && b.score > 0
                    && (b.x - hunter.x).abs() <= 1
                    && (b.y - hunter.y).abs() <= 1
            });
            let Some(v) = victim else { continue };

            let stolen = self.arena_account.bots[v].score.min(STEAL_AMOUNT);
            self.arena_account.bots[v].score -= stolen;
            self.arena_account.bots[v].robbed_cooldown_until = tick
                .checked_add(ROB_COOLDOWN_TICKS)
                .ok_or(ArenaError::CounterOverflow)?;
            self.arena_account.bots[h].score = self.arena_account.bots[h]
                .score
                .checked_add(stolen)
                .ok_or(ArenaError::CounterOverflow)?;
        }

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
            self.arena_account.finalize(false)?;
        }

        Ok(())
    }
}

pub fn handler(ctx: Context<AdvanceSimulation>, _id: u64) -> Result<()> {
    ctx.accounts.advance_simulation()?;
    Ok(())
}
