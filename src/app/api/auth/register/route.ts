import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email, username, password } = await req.json();

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username ve password zorunludur." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalıdır." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu email veya kullanıcı adı zaten kullanılıyor." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, role: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Kayıt sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
