import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authOptions } from "./auth";

export function withRole(...allowedRoles: Role[]) {
  return async function guard() {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
    }

    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    }

    return session;
  };
}
