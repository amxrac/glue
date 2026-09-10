use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::vrf,
    vrf::{
        self,
        instructions::{create_request_scoped_randomness_ix, RequestRandomnessParams},
        types::SerializableAccountMeta,
    },
};

use crate::instruction::ConsumeRandomness;
use crate::state::ArenaAccount;

#[vrf]
#[derive(Accounts)]
#[instruction(id: u64)]
pub struct RequestRandomnessCtx<'info> {
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
    #[account(
        mut,
        constraint =
            oracle_queue.key() == vrf::consts::DEFAULT_QUEUE ||                // Devnet
            oracle_queue.key() == vrf::consts::DEFAULT_TEST_QUEUE ||           // Local
            oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_QUEUE ||      // ER Devnet
            oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_TEST_QUEUE    // ER Local
    )]
    pub oracle_queue: UncheckedAccount<'info>,
}

impl<'info> RequestRandomnessCtx<'info> {
    pub fn request_randomness(&self, id: u64) -> Result<()> {
        msg!("Requesting VRF on base layer (id={})", id);

        let mut caller_seed = [0u8; 32];
        caller_seed[..8].copy_from_slice(&id.to_le_bytes());

        let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
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

pub fn handler(ctx: Context<RequestRandomnessCtx>, id: u64) -> Result<()> {
    ctx.accounts.request_randomness(id)?;
    Ok(())
}
