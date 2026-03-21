import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SessionRoom } from "./session-room";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id },
    include: {
      gm: { select: { id: true, username: true } },
      gameset: { select: { name: true } },
      players: {
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

  if (!gameSession) redirect("/dashboard");

  const isGm = gameSession.gmId === session.user.id;
  const isPlayer = gameSession.players.some(
    (p) => p.userId === session.user.id
  );

  if (!isGm && !isPlayer) redirect("/dashboard");

  return (
    <SessionRoom
      sessionId={gameSession.id}
      sessionName={gameSession.name}
      gamesetName={gameSession.gameset.name}
      status={gameSession.status}
      gm={gameSession.gm}
      players={gameSession.players.map((p) => ({
        id: p.user.id,
        username: p.user.username,
      }))}
      currentUser={{
        id: session.user.id,
        username: session.user.username,
        isGm,
      }}
    />
  );
}
