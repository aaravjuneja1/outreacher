import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, newId, noStore, safeName } from "@/lib/core";
import { db } from "@/lib/db";
import { documentTypeForName } from "@/lib/documents";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createPrivateUploadUrl, privateStoragePath, removePrivateFile } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  byteSize: z.number().int().positive().max(10 * 1024 * 1024),
  useForContext: z.boolean()
});

const MAX_DOCUMENTS_PER_USER = 10;
const MAX_DOCUMENT_BYTES_PER_USER = 50 * 1024 * 1024;
const MAX_ACTIVE_UPLOADS = 3;

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = schema.parse(await request.json());
    await enforceRateLimit("document-upload", session.userId, { limit: 12, windowSeconds: 60 * 60 });
    const documentType = documentTypeForName(input.name);
    const documentId = newId();
    const fileName = safeName(input.name);
    if (!fileName) throw new AppError("Use a file name with letters or numbers.", 422);
    const storagePath = privateStoragePath(session.userId, documentId, fileName);
    const sql = db();
    const expired = await sql.unsafe(
      "DELETE FROM document_uploads WHERE user_id = $1 AND expires_at <= NOW() RETURNING storage_path",
      [session.userId]
    );
    await Promise.all(expired.map(async (upload) => {
      try {
        await removePrivateFile(String(upload.storage_path));
      } catch {
        // Expired uploads are private and will never be returned by the app.
      }
    }));

    await sql.begin(async (transaction) => {
      const user = await transaction.unsafe("SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [session.userId]);
      if (!user.length) throw new AppError("Please sign in again.", 401);
      const totals = await transaction.unsafe(
        "SELECT COUNT(*)::int AS count, COALESCE(SUM(byte_size), 0)::bigint AS total FROM documents WHERE user_id = $1",
        [session.userId]
      );
      if (Number(totals[0]?.count || 0) >= MAX_DOCUMENTS_PER_USER || Number(totals[0]?.total || 0) + input.byteSize > MAX_DOCUMENT_BYTES_PER_USER) {
        throw new AppError("You can store up to 10 files and 50 MB in total. Delete a file before adding another.", 422);
      }
      const pending = await transaction.unsafe("SELECT COUNT(*)::int AS count FROM document_uploads WHERE user_id = $1", [session.userId]);
      if (Number(pending[0]?.count || 0) >= MAX_ACTIVE_UPLOADS) {
        throw new AppError("Finish or wait for your current uploads before adding another file.", 429);
      }
      await transaction.unsafe(
        "INSERT INTO document_uploads (id, user_id, original_name, mime_type, byte_size, storage_path, use_for_context, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '15 minutes')",
        [documentId, session.userId, fileName, documentType.mimeType, input.byteSize, storagePath, input.useForContext]
      );
    });
    try {
      const signedUrl = await createPrivateUploadUrl(storagePath);
      return noStore(NextResponse.json({ documentId, signedUrl, mimeType: documentType.mimeType }));
    } catch (error) {
      await sql.unsafe("DELETE FROM document_uploads WHERE id = $1 AND user_id = $2", [documentId, session.userId]);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
