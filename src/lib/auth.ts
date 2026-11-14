import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { can, type Permission, type Role } from "@/lib/permissions";

const SESSION_COOKIE = "opsledger_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  currency: string;
  demoMode: boolean;
  email: string;
  fullName: string;
  title: string | null;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Add a 32-byte random string to .env.");
  }
  return secret;
}

export function hashSessionToken(token: string) {
  return createHmac("sha256", authSecret()).update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null },
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 250) ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await prisma.profile.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: { organisation: true, department: true },
      },
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) {
    return null;
  }

  const user = session.user;
  return {
    id: user.id,
    orgId: user.orgId,
    orgName: user.organisation.name,
    orgSlug: user.organisation.slug,
    currency: user.organisation.currency,
    demoMode: user.organisation.demoMode,
    email: user.email,
    fullName: user.fullName,
    title: user.title,
    role: user.role as Role,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard?denied=1");
  return user;
}

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403,
  ) {
    super(message);
  }
}

export async function requireApiUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiAuthError("Not signed in", 401);
  if (permission && !can(user.role, permission)) throw new ApiAuthError("Forbidden", 403);
  return user;
}
