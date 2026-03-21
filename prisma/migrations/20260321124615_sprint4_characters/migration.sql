-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "public_data" JSONB NOT NULL DEFAULT '{}',
    "private_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_stats" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_value" INTEGER NOT NULL DEFAULT 0,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "max_value" INTEGER,
    "is_public" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "character_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_wallets" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "silver" INTEGER NOT NULL DEFAULT 0,
    "copper" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "character_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "characters_session_id_user_id_key" ON "characters"("session_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_stats_character_id_name_key" ON "character_stats"("character_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "character_wallets_character_id_key" ON "character_wallets"("character_id");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
