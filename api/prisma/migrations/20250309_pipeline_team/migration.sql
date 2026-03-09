-- Step 1: Add new enum values (must be in own transaction, committed before use)
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'QUALIFYING';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'PROPOSED';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'NEGOTIATING';
