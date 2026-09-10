import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { removePrivateFile } from "@/lib/storage";

export const runtime = "nodejs";

const updateSchema = z.object({ useForContext: z.boolean() });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = updateSchema.parse(await request.json());
    const { id } = await context.params;
    const updated = await db().unsafe(
      "UPDATE documents SET use_for_context = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
      [input.useForContext, id, session.userId]
    );
    if (!updated.length) throw new AppError("That file was not found.", 404);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const rows = await db().unsafe("SELECT storage_path FROM documents WHERE id = $1 AND user_id = $2", [id, session.userId]);
    if (!rows.length) throw new AppError("That file was not found.", 404);
    await removePrivateFile(rows[0].storage_path);
    await db().unsafe("DELETE FROM documents WHERE id = $1 AND user_id = $2", [id, session.userId]);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
