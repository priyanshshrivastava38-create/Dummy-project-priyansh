"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { loginSchema, signupSchema } from "@/lib/validation/schemas";

export type AuthState = { error?: string; fieldErrors?: Record<string, string> };

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: "Check your email and password.",
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, isActive: true },
  });
  if (!profile || !(await verifyPassword(parsed.data.password, profile.passwordHash))) {
    return { error: "That email and password combination is not recognised." };
  }
  if (!profile.isActive) {
    return { error: "This account has been deactivated. Contact your administrator." };
  }

  await createSession(profile.id);
  redirect(safeNext(formData.get("next")));
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form.",
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
    };
  }

  const demoOrg = await prisma.organisation.findFirst({
    where: { demoMode: true },
    orderBy: { createdAt: "asc" },
    include: { departments: { orderBy: { name: "asc" }, take: 1 } },
  });
  if (!demoOrg) {
    return { error: "The demo workspace is not initialised yet. Run the database seed first." };
  }

  const existing = await prisma.profile.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "An account with this email already exists. Sign in instead." };

  const profile = await prisma.profile.create({
    data: {
      orgId: demoOrg.id,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      passwordHash: await hashPassword(parsed.data.password),
      role: "APPROVER",
      departmentId: demoOrg.departments[0]?.id ?? null,
      title: "Department Manager",
    },
  });

  await createSession(profile.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
