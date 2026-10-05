use crate::{constants::*, error::*};
use anchor_lang::prelude::*;
use magicblock_magic_program_api::{pda::CRANK_SEED, CRANK_PROGRAM_ID};

#[account]
#[derive(InitSpace)]
pub struct VaultAccount {
    pub arena: Pubkey,
    #[max_len(6)]
    pub players: Vec<Pubkey>,
    pub started_at: i64,
    pub entry_fee: u64,
    pub refunded: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ArenaAccount {
    pub id: u64,
    pub host: Pubkey,
    #[max_len(6)]
    pub players: Vec<Pubkey>,
    pub names: [[u8; 32]; 6],
    pub bots: [Bot; 6],
    pub status: ArenaStatus,
    pub vrf_seed: Option<[u8; 32]>,
    pub spawn_counter: u32,
    pub resources: [Resource; 20],
    pub tick: u64,
    pub max_ticks: u64,
    pub entry_fee: u64,
    pub winners: u8,
    pub started_at: i64,
    pub bump: u8,
}

impl ArenaAccount {
    pub fn finalize(&mut self, forced: bool) -> Result<()> {
        self.status = ArenaStatus::Finished;

        let n = self.players.len();
        let mut winners = 0u8;

        if forced {
            for (i, b) in self.bots[..n].iter().enumerate() {
                if b.active {
                    winners |= 1u8 << i;
                }
            }
        } else {
            let top = self.bots[..n]
                .iter()
                .filter(|b| b.active)
                .map(|b| b.score)
                .max()
                .ok_or(ArenaError::NoActiveBots)?;
            for (i, b) in self.bots[..n].iter().enumerate() {
                if b.active && b.score == top {
                    winners |= 1u8 << i;
                }
            }
        }

        require!(winners != 0, ArenaError::NoActiveBots);
        self.winners = winners;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, PartialEq, Eq, Debug)]
pub enum ArenaStatus {
    Waiting,
    Running,
    Finished,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Default)]
pub struct Bot {
    pub x: i16,
    pub y: i16,
    pub vision: u16,
    pub speed: u16,
    pub score: u64,
    pub credits: u64,
    pub active: bool,
    pub flip_x: bool,
    pub flip_y: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Default)]
pub struct Resource {
    pub x: i16,
    pub y: i16,
    pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum UpgradeType {
    Speed,
    Vision,
}

pub const fn default_bot() -> Bot {
    Bot {
        x: 0,
        y: 0,
        vision: DEFAULT_VISION,
        speed: DEFAULT_SPEED,
        score: 0,
        credits: 0,
        active: false,
        flip_x: false,
        flip_y: false,
    }
}

pub fn encode_name(name: &str) -> Result<[u8; 32]> {
    let bytes = name.as_bytes();
    require!(bytes.len() <= MAX_NAME_LEN, ArenaError::NameTooLong);
    let mut out = [0u8; 32];
    out[..bytes.len()].copy_from_slice(bytes);
    Ok(out)
}

pub fn coordinate_occupied(
    arena: &ArenaAccount,
    x: i16,
    y: i16,
    bot_count: usize,
    resource_count: usize,
    ignore_bot: Option<usize>,
) -> bool {
    for (index, bot) in arena.bots[..bot_count].iter().enumerate() {
        if !bot.active || Some(index) == ignore_bot {
            continue;
        }

        if bot.x == x && bot.y == y {
            return true;
        }
    }

    for resource in arena.resources[..resource_count].iter() {
        if resource.active && resource.x == x && resource.y == y {
            return true;
        }
    }

    false
}

pub fn crank_signer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[CRANK_SEED, authority.as_ref()], &CRANK_PROGRAM_ID).0
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ScheduleAdvanceArgs {
    pub task_id: i64,
    pub execution_interval_millis: i64,
    pub iterations: i64,
}
