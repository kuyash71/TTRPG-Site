import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import jwt from "jsonwebtoken";

const SOCKET_JWT_SECRET = process.env.SOCKET_JWT_SECRET || "dev-secret";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = jwt.sign(
    {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
    },
    SOCKET_JWT_SECRET,
    { expiresIn: "12h" }
  );

  return NextResponse.json({ token });
}
