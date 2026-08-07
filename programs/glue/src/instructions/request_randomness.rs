use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::consts::DEFAULT_QUEUE;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

use crate::{error::ArenaError, instruction::ConsumeRandomness, state::ArenaAccount, ArenaStatus};

#[vrf]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct RequestRandomness<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        mut,
        seeds = [b"arena", arena_account.host.key().as_ref(), &id.to_le_bytes()],
        bump = arena_account.bump,
        has_one = host
    )]
    pub arena_account: Account<'info, ArenaAccount>,
    /// CHECK: Oracle queue for base-layer VRF
    #[account(mut, address = DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
}

impl<'info> RequestRandomness<'info> {
    pub fn request_randomness(&self, id: u64) -> Result<()> {
        msg!("Requesting VRF on base layer (id={})", id);

        let mut caller_seed = [0u8; 32];
        caller_seed[..8].copy_from_slice(&id.to_le_bytes());

        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: self.host.key(),
            oracle_queue: self.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: ConsumeRandomness::DISCRIMINATOR.to_vec(),
            caller_seed: caller_seed,
            accounts_metas: Some(vec![
                // The callback needs the arena_account PDA to be writable
                SerializableAccountMeta {
                    pubkey: self.arena_account.key(),
                    is_signer: false,
                    is_writable: true,
                },
            ]),
            ..Default::default()
        });

        self.invoke_signed_vrf(&self.host.to_account_info(), &ix)?;
        Ok(())
    }
}

pub fn handler(ctx: Context<RequestRandomness>, id: u64) -> Result<()> {
    ctx.accounts.request_randomness(id)?;
    Ok(())
}
