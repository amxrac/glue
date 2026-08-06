use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ArenaAccount {
    pub id: u64,
    pub host: Pubkey,
    #[max_len(6)]
    pub players: Vec<Pubkey>,
    pub bots: [Bot; 6],
    pub status: ArenaStatus,
    pub vrf_seed: u64,
    pub spawn_counter: u32,
    pub resources: [Resource; 20],
    pub tick: u64,
    pub max_ticks: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone)]
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
    pub carry_capacity: u16,
    pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Default)]
pub struct Resource {
    pub x: i16,
    pub y: i16,
    pub active: bool,
}
