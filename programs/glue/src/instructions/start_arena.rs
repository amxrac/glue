use crate::constants::*;
use crate::state::coordinate_occupied;
use crate::{error::ArenaError, state::ArenaAccount, ArenaStatus, Resource};
use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;
use std::vec;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct StartArena<'info> {
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

impl<'info> StartArena<'info> {
    pub fn start_arena(&mut self) -> Result<()> {
        require!(
            self.arena_account.status == ArenaStatus::Waiting,
            ArenaError::ArenaNotJoinable
        );

        require!(
            self.arena_account.players.len() >= 2,
            ArenaError::NotEnoughPlayers
        );
        let vrf_seed = self
            .arena_account
            .vrf_seed
            .ok_or(ArenaError::RandomnessNotReady)?;

        for bot_index in 0..self.arena_account.players.len() {
            let mut attempts = 0;

            loop {
                require!(
                    attempts < MAX_POSITION_ATTEMPTS,
                    ArenaError::UnableToFindSpawnPosition
                );

                let counter = self.arena_account.spawn_counter;

                let position = derive_position(vrf_seed, counter);

                self.arena_account.spawn_counter = self
                    .arena_account
                    .spawn_counter
                    .checked_add(1)
                    .ok_or(ArenaError::CounterOverflow)?;

                attempts += 1;

                if !coordinate_occupied(
                    &self.arena_account,
                    position.0,
                    position.1,
                    bot_index,
                    0,
                    None,
                ) {
                    self.arena_account.bots[bot_index].x = position.0;
                    self.arena_account.bots[bot_index].y = position.1;
                    self.arena_account.bots[bot_index].active = true;
                    break;
                }
            }
        }

        for resource_index in 0..self.arena_account.resources.len() {
            let mut attempts = 0;

            loop {
                require!(
                    attempts < MAX_POSITION_ATTEMPTS,
                    ArenaError::UnableToFindSpawnPosition
                );

                let counter = self.arena_account.spawn_counter;

                let position = derive_position(vrf_seed, counter);

                self.arena_account.spawn_counter = self
                    .arena_account
                    .spawn_counter
                    .checked_add(1)
                    .ok_or(ArenaError::CounterOverflow)?;

                attempts += 1;

                if !coordinate_occupied(
                    &self.arena_account,
                    position.0,
                    position.1,
                    self.arena_account.players.len(),
                    resource_index,
                    None,
                ) {
                    self.arena_account.resources[resource_index] = Resource {
                        x: position.0,
                        y: position.1,
                        active: true,
                    };
                    break;
                }
            }
        }

        self.arena_account.status = ArenaStatus::Running;
        Ok(())
    }
}

fn derive_position(vrf_seed: [u8; 32], spawn_counter: u32) -> (i16, i16) {
    let counter_bytes = spawn_counter.to_le_bytes();
    let hash = hashv(&[&vrf_seed[..], &counter_bytes[..]]);
    let bytes = hash.to_bytes();

    let x = u64::from_le_bytes(bytes[0..8].try_into().unwrap()) % MAP_WIDTH as u64;

    let y = u64::from_le_bytes(bytes[8..16].try_into().unwrap()) % MAP_HEIGHT as u64;

    (x as i16, y as i16)
}

pub fn handler(ctx: Context<StartArena>, _id: u64) -> Result<()> {
    ctx.accounts.start_arena()?;
    Ok(())
}
