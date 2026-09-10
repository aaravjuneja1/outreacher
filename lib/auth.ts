import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AppError } from "@/lib/core";
import { requiredEnv } from "@/lib/env";

export type Session = {
  userId: string;
  email: string;
  exp: number;
};

const COOKIE_NAME = "outreacher_session";

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", requiredEnv("NEXTAUTH_SECRET")).update(value).digest("base64url");
}

export function createSession(userId: string, email: string) {
  const payload: Session = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  return encoded + "." + sign(encoded);
}

export function sessionCookie(value: string) {
  return {
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0
  };
}

function readSession(token?: string): Session | undefined {
  if (!token) return undefined;
  const [encoded, givenSignature] = token.split(".");
  if (!encoded || !givenSignature) return undefined;

  const expectedSignature = sign(encoded);
  const left = Buffer.from(givenSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return undefined;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Session;
    if (!parsed.userId || !parsed.email || parsed.exp < Math.floor(Date.now() / 1000)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function currentSession() {
  return readSession((await cookies()).get(COOKIE_NAME)?.value);
}

export async function requireSession() {
  const session = await currentSession();
  if (!session) throw new AppError("Please sign in to continue.", 401);
  return session;
}

export async function passwordHash(password: string) {
  return bcrypt.hash(password, 12);
}

export async function passwordMatches(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
