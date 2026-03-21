-- CreateEnum
CREATE TYPE "StatType" AS ENUM ('BASE', 'DERIVED', 'RESOURCE');

-- CreateEnum
CREATE TYPE "SkillNodeType" AS ENUM ('PASSIVE', 'ACTIVE', 'SPELL_UNLOCK');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "class_id" UUID,
ADD COLUMN     "gameset_id" UUID,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "race_id" UUID,
ADD COLUMN     "skill_points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stat_groups" (
    "id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stat_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stat_definitions" (
    "id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "StatType" NOT NULL,
    "formula" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "max_val" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stat_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "hit_die" INTEGER NOT NULL DEFAULT 8,
    "icon_url" TEXT,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subclasses" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "unlock_level" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "subclasses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "races" (
    "id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "racial_traits" JSONB NOT NULL DEFAULT '[]',
    "icon_url" TEXT,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_tree_nodes" (
    "id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "class_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "node_type" "SkillNodeType" NOT NULL DEFAULT 'PASSIVE',
    "max_level" INTEGER NOT NULL DEFAULT 1,
    "cost_per_level" INTEGER NOT NULL DEFAULT 1,
    "unlock_level" INTEGER NOT NULL DEFAULT 1,
    "prerequisites" UUID[],
    "stat_bonuses_per_level" JSONB NOT NULL DEFAULT '{}',
    "effect" JSONB,
    "pos_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pos_y" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "skill_tree_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_skill_unlocks" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "unlocked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_skill_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_approval_requests" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "gm_comment" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "character_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stat_definitions_gameset_id_key_key" ON "stat_definitions"("gameset_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "character_skill_unlocks_character_id_node_id_key" ON "character_skill_unlocks"("character_id", "node_id");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "races"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_groups" ADD CONSTRAINT "stat_groups_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_definitions" ADD CONSTRAINT "stat_definitions_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stat_definitions" ADD CONSTRAINT "stat_definitions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "stat_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subclasses" ADD CONSTRAINT "subclasses_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "races" ADD CONSTRAINT "races_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_tree_nodes" ADD CONSTRAINT "skill_tree_nodes_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_tree_nodes" ADD CONSTRAINT "skill_tree_nodes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_skill_unlocks" ADD CONSTRAINT "character_skill_unlocks_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_skill_unlocks" ADD CONSTRAINT "character_skill_unlocks_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "skill_tree_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_approval_requests" ADD CONSTRAINT "character_approval_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_approval_requests" ADD CONSTRAINT "character_approval_requests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
