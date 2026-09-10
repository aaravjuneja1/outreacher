import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, newId, noStore, safeName } from "@/lib/core";
import { db } from "@/lib/db";
import { createPrivateUploadUrl, privateStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

const supportedNames = /\.(pdf|docx|txt)$/i;
const schema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(255),
  byteSize: z.number().int().positive().max(10 * 1024 * 1024),
  useForContext: z.boolean()
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = schema.parse(await request.json());
    if (!supportedNames.test(input.name)) throw new AppError("Use a PDF, DOCX, or TXT file.", 422);
    const documentId = newId();
    const fileName = safeName(input.name);
    if (!fileName) throw new AppError("Use a file name with letters or numbers.", 422);
    const storagePath = privateStoragePath(session.userId, documentId, fileName);
    await db().unsafe(
      "INSERT INTO document_uploads (id, user_id, original_name, mime_type, byte_size, storage_path, use_for_context, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '2 hours')",
      [documentId, session.userId, fileName, input.mimeType, input.byteSize, storagePath, input.useForContext]
    );
    try {
      const signedUrl = await createPrivateUploadUrl(storagePath);
      return noStore(NextResponse.json({ documentId, signedUrl }));
    } catch (error) {
      await db().unsafe("DELETE FROM document_uploads WHERE id = $1 AND user_id = $2", [documentId, session.userId]);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
