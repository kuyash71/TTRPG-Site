-- Cleanup: drop partially created type from previous failed attempt
DROP TYPE IF EXISTS "SessionStatus_new";

-- Update any CLOSING sessions to CLOSED before removing the enum value
UPDATE "sessions" SET "status" = 'CLOSED', "closed_at" = NOW() WHERE "status" = 'CLOSING';

-- Drop the default first so the column can be retyped
ALTER TABLE "sessions" ALTER COLUMN "status" DROP DEFAULT;

-- Remove CLOSING from SessionStatus enum
CREATE TYPE "SessionStatus_new" AS ENUM ('OPEN', 'ACTIVE', 'CLOSED');
ALTER TABLE "sessions" ALTER COLUMN "status" TYPE "SessionStatus_new" USING ("status"::text::"SessionStatus_new");
ALTER TYPE "SessionStatus" RENAME TO "SessionStatus_old";
ALTER TYPE "SessionStatus_new" RENAME TO "SessionStatus";
DROP TYPE "SessionStatus_old";

-- Restore the default
ALTER TABLE "sessions" ALTER COLUMN "status" SET DEFAULT 'OPEN'::"SessionStatus";
