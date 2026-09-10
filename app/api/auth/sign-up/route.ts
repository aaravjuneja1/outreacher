import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, passwordHash, sessionCookie } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, newId, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { enforceRateLimit, requestFingerprint } from "@/lib/rate-limit";

export const runtime = "nodejs";

const signUpSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password is too long."),
  acceptPrivacy: z.literal(true)
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = signUpSchema.parse(await request.json());
    const email = input.email.toLowerCase();
    await enforceRateLimit("sign-up-ip", requestFingerprint(request), { limit: 3, windowSeconds: 60 * 60, message: "Too many account attempts from this connection. Please try again later." });
    const userId = newId();
    const hash = await passwordHash(input.password);
    const sql = db();

    await sql.begin(async (transaction) => {
      const existing = await transaction.unsafe("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
      if (existing.length) throw new AppError("That email is unavailable. Sign in if you already have an account.", 409);

      const seat = await transaction.unsafe(
        "UPDATE launch_state SET seats_taken = seats_taken + 1, updated_at = NOW() WHERE id = 1 AND seats_taken < 20 RETURNING seats_taken"
      );
      if (!seat.length) {
        throw new AppError("The first 20 free accounts have been claimed. Join the next release list.", 403);
      }

      await transaction.unsafe("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [userId, email, hash]);
      await transaction.unsafe("INSERT INTO profiles (user_id, privacy_accepted_at) VALUES ($1, NOW())", [userId]);
      await transaction.unsafe("INSERT INTO credit_usage (user_id) VALUES ($1)", [userId]);
      await transaction.unsafe("INSERT INTO security_events (id, user_id, event_type) VALUES ($1, $2, 'account_created')", [newId(), userId]);
    });

    const response = NextResponse.json({ ok: true, user: { email } }, { status: 201 });
    response.cookies.set(sessionCookie(createSession(userId, email)));
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
