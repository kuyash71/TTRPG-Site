import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const { user } = session;
  const isGm = user.role === "GM" || user.role === "ADMIN";

  return (
    <DashboardContent
      username={user.username}
      role={user.role}
      isGm={isGm}
    />
  );
}
