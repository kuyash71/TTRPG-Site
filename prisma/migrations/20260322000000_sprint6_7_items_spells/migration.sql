-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('WEAPON', 'ARMOR', 'CONSUMABLE', 'MATERIAL', 'QUEST', 'MISC');

-- CreateEnum
CREATE TYPE "EquipmentSlot" AS ENUM ('HEAD', 'CHEST', 'LEGS', 'FEET', 'MAIN_HAND', 'OFF_HAND', 'ACCESSORY_1', 'ACCESSORY_2');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "SpellTargetType" AS ENUM ('SELF', 'SINGLE', 'AOE', 'LINE');

-- AlterTable
ALTER TABLE "skill_tree_nodes" ADD COLUMN "spell_definition_id" UUID;

-- CreateTable
CREATE TABLE "item_definitions" (
    "id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" "ItemCategory" NOT NULL DEFAULT 'MISC',
    "grid_width" INTEGER NOT NULL DEFAULT 1,
    "grid_height" INTEGER NOT NULL DEFAULT 1,
    "equipment_slot" "EquipmentSlot",
    "stat_bonuses" JSONB NOT NULL DEFAULT '{}',
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "max_stack" INTEGER NOT NULL DEFAULT 1,
    "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
    "icon_url" TEXT,
    CONSTRAINT "item_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_inventory_items" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "item_definition_id" UUID NOT NULL,
    "pos_x" INTEGER NOT NULL DEFAULT 0,
    "pos_y" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_equipped" BOOLEAN NOT NULL DEFAULT false,
    "equipped_slot" "EquipmentSlot",
    CONSTRAINT "character_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spell_definitions" (
    "id" UUID NOT NULL,
    "gameset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "mana_cost" INTEGER NOT NULL DEFAULT 0,
    "cooldown" INTEGER NOT NULL DEFAULT 0,
    "range" INTEGER NOT NULL DEFAULT 0,
    "target_type" "SpellTargetType" NOT NULL DEFAULT 'SINGLE',
    "effects" JSONB NOT NULL DEFAULT '[]',
    "icon_url" TEXT,
    "required_level" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "spell_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_spells" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "spell_definition_id" UUID NOT NULL,
    "slot_index" INTEGER,
    CONSTRAINT "character_spells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "character_spells_character_id_spell_definition_id_key" ON "character_spells"("character_id", "spell_definition_id");

-- AddForeignKey
ALTER TABLE "skill_tree_nodes" ADD CONSTRAINT "skill_tree_nodes_spell_definition_id_fkey" FOREIGN KEY ("spell_definition_id") REFERENCES "spell_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_definitions" ADD CONSTRAINT "item_definitions_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_inventory_items" ADD CONSTRAINT "character_inventory_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_inventory_items" ADD CONSTRAINT "character_inventory_items_item_definition_id_fkey" FOREIGN KEY ("item_definition_id") REFERENCES "item_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spell_definitions" ADD CONSTRAINT "spell_definitions_gameset_id_fkey" FOREIGN KEY ("gameset_id") REFERENCES "gamesets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_spells" ADD CONSTRAINT "character_spells_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_spells" ADD CONSTRAINT "character_spells_spell_definition_id_fkey" FOREIGN KEY ("spell_definition_id") REFERENCES "spell_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
