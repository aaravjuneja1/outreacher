import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, requireSession } from "@/lib/auth";
import { assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { removePrivateFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const sql = db();
    const documents = await sql.unsafe("SELECT storage_path FROM documents WHERE user_id = $1", [session.userId]);
    for (const document of documents) {
      try {
        await removePrivateFile(document.storage_path);
      } catch {
        // The database deletion below revokes access even if storage is temporarily unavailable.
      }
    }
    await sql.unsafe("DELETE FROM users WHERE id = $1", [session.userId]);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(clearSessionCookie());
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
