import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { assertSameOrigin, errorResponse, newId, noStore } from "@/lib/core";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const sql = db();
    await sql.begin(async (transaction) => {
      await transaction.unsafe("DELETE FROM gmail_connections WHERE user_id = $1", [session.userId]);
      await transaction.unsafe("UPDATE profiles SET live_sending = FALSE, updated_at = NOW() WHERE user_id = $1", [session.userId]);
      await transaction.unsafe("INSERT INTO security_events (id, user_id, event_type) VALUES ($1, $2, 'gmail_disconnected')", [newId(), session.userId]);
    });
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
