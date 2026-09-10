import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const sql = db();
    const changed = await sql.unsafe(
      "UPDATE drafts SET status = 'skipped', updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'drafted' RETURNING prospect_id",
      [id, session.userId]
    );
    if (!changed.length) throw new AppError("That draft is no longer available.", 404);
    await sql.unsafe("UPDATE prospects SET status = 'skipped' WHERE id = $1 AND user_id = $2", [changed[0].prospect_id, session.userId]);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
