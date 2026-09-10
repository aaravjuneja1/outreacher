import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  enabled: z.boolean(),
  acknowledgement: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = schema.parse(await request.json());
    if (input.enabled) {
      if (!input.acknowledgement) throw new AppError("Confirm that right swipe sends an email immediately.", 422);
      const connection = await db().unsafe("SELECT user_id FROM gmail_connections WHERE user_id = $1", [session.userId]);
      if (!connection.length) throw new AppError("Connect Gmail before turning on Live sending.", 422);
    }
    await db().unsafe("UPDATE profiles SET live_sending = $1, updated_at = NOW() WHERE user_id = $2", [input.enabled, session.userId]);
    await db().unsafe("INSERT INTO security_events (id, user_id, event_type) VALUES ($1, $2, $3)", [
      crypto.randomUUID(),
      session.userId,
      input.enabled ? "live_sending_enabled" : "live_sending_disabled"
    ]);
    return noStore(NextResponse.json({ ok: true, liveSending: input.enabled }));
  } catch (error) {
    return errorResponse(error);
  }
}
