import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, passwordMatches, sessionCookie } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const signInSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = signInSchema.parse(await request.json());
    const email = input.email.toLowerCase();
    const rows = await db().unsafe("SELECT id, email, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1", [email]);
    const user = rows[0];
    if (!user || !(await passwordMatches(input.password, user.password_hash))) {
      throw new AppError("That email or password is not correct.", 401);
    }
    const response = NextResponse.json({ ok: true, user: { email: user.email } });
    response.cookies.set(sessionCookie(createSession(user.id, user.email)));
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
