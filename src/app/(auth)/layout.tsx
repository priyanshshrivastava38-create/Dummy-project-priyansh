import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <div className="min-h-svh bg-zinc-50/60">{children}</div>;
}
