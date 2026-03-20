import { Role } from "@/generated/prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      role: Role;
    };
  }

  interface User {
    id: string;
    email: string;
    username: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    username: string;
    role: Role;
  }
}
