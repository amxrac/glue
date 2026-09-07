use crate::state::ScheduleAdvanceArgs;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use bincode;
use ephemeral_rollups_sdk::crank::ScheduleCrankCpi;
use magicblock_magic_program_api::args::ScheduleTaskArgs;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ScheduleAdvance<'info> {
    /// CHECK: used for CPI
    #[account()]
    pub magic_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub host: Signer<'info>,

    /// CHECK: used for CPI
    #[account(
        mut,
        seeds = [
            b"arena",
            host.key().as_ref(),
            &id.to_le_bytes()
        ],
        bump
    )]
    pub arena_account: UncheckedAccount<'info>,

    /// CHECK: used for CPI
    pub program: UncheckedAccount<'info>,
}

impl<'info> ScheduleAdvance<'info> {
    pub fn schedule_advance(&self, id: u64, args: ScheduleAdvanceArgs) -> Result<()> {
        let advance_ix = Instruction {
            program_id: crate::ID,
            accounts: vec![AccountMeta::new(self.arena_account.key(), false)],
            data: anchor_lang::InstructionData::data(&crate::instruction::AdvanceSimulation { id }),
        };

        let ix_data = bincode::serialize(&MagicBlockInstruction::ScheduleTask(ScheduleTaskArgs {
            task_id: args.task_id,
            execution_interval_millis: args.execution_interval_millis,
            iterations: args.iterations,
            instructions: vec![advance_ix],
        }))
        .map_err(|err| {
            msg!("ERROR: failed to serialize args {:?}", err);
            ProgramError::InvalidArgument
        })?;

        let schedule_ix = Instruction::new_with_bytes(
            MAGIC_PROGRAM_ID,
            &ix_data,
            vec![
                AccountMeta::new(self.host.key(), true),
                AccountMeta::new(self.arena_account.key(), false),
            ],
        );

        invoke_signed(
            &schedule_ix,
            &[
                self.host.to_account_info(),
                self.arena_account.to_account_info(),
            ],
            &[],
        )?;

        Ok(())
    }
}

pub fn handler(ctx: Context<ScheduleAdvance>, id: u64, args: ScheduleAdvanceArgs) -> Result<()> {
    ctx.accounts.schedule_advance(id, args)
}
