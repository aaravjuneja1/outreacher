import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { readDocumentBytes } from "@/lib/documents";
import { enforceRateLimit } from "@/lib/rate-limit";
import { downloadPrivateFile, removePrivateFile } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({ documentId: z.string().uuid() });

type PendingUpload = {
  id: string;
  original_name: string;
  mime_type: string;
  byte_size: number;
  storage_path: string;
  use_for_context: boolean;
};

export async function POST(request: NextRequest) {
  let upload: { storage_path: string } | undefined;
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await enforceRateLimit("document-finalize", session.userId, { limit: 12, windowSeconds: 60 * 60 });
    const input = schema.parse(await request.json());
    const sql = db();
    const rows = await sql.unsafe(
      "DELETE FROM document_uploads WHERE id = $1 AND user_id = $2 AND expires_at > NOW() RETURNING id, original_name, mime_type, byte_size, storage_path, use_for_context",
      [input.documentId, session.userId]
    );
    const pending = rows[0] as unknown as PendingUpload | undefined;
    if (!pending) throw new AppError("This upload link expired. Please choose the file again.", 422);
    upload = pending;

    const bytes = await downloadPrivateFile(pending.storage_path);
    const parsed = await readDocumentBytes({
      name: pending.original_name,
      mimeType: pending.mime_type,
      bytes
    });
    if (bytes.length !== Number(pending.byte_size)) {
      throw new AppError("The uploaded file did not match the file you selected. Please try again.", 422);
    }

    await sql.begin(async (transaction) => {
      const user = await transaction.unsafe("SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [session.userId]);
      if (!user.length) throw new AppError("Please sign in again.", 401);
      const totals = await transaction.unsafe(
        "SELECT COUNT(*)::int AS count, COALESCE(SUM(byte_size), 0)::bigint AS total FROM documents WHERE user_id = $1",
        [session.userId]
      );
      if (Number(totals[0]?.count || 0) >= 10 || Number(totals[0]?.total || 0) + bytes.length > 50 * 1024 * 1024) {
        throw new AppError("You can store up to 10 files and 50 MB in total. Delete a file before adding another.", 422);
      }
      await transaction.unsafe(
        "INSERT INTO documents (id, user_id, original_name, mime_type, byte_size, storage_path, extracted_text, use_for_context) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          input.documentId,
          session.userId,
          pending.original_name,
          parsed.mimeType,
          bytes.length,
          pending.storage_path,
          parsed.text,
          pending.use_for_context
        ]
      );
    });

    return noStore(NextResponse.json({ id: input.documentId, ok: true }, { status: 201 }));
  } catch (error) {
    if (upload) {
      try {
        await removePrivateFile(upload.storage_path);
        await db().unsafe("DELETE FROM document_uploads WHERE storage_path = $1", [upload.storage_path]);
      } catch {
        // The incomplete object is private and unreachable from the app.
      }
    }
    return errorResponse(error);
  }
}
