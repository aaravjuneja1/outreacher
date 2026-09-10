import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { readDocumentBytes } from "@/lib/documents";
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
    const input = schema.parse(await request.json());
    const sql = db();
    const rows = await sql.unsafe(
      "SELECT id, original_name, mime_type, byte_size, storage_path, use_for_context FROM document_uploads WHERE id = $1 AND user_id = $2 AND expires_at > NOW()",
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
      await transaction.unsafe("DELETE FROM document_uploads WHERE id = $1 AND user_id = $2", [input.documentId, session.userId]);
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
