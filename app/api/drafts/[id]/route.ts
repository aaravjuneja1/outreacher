import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const editSchema = z.object({
  subject: z.string().trim().min(4).max(120).optional(),
  body: z.string().trim().min(20).max(6000).optional(),
  attachmentDocumentIds: z.array(z.string().uuid()).max(10).optional(),
  recipientEmail: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  emailSourceUrl: z.union([z.string().trim().url().max(1000), z.literal("")]).optional()
}).refine((input) => Object.keys(input).length > 0, "Add an edit first.");

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const input = editSchema.parse(await request.json());
    const sql = db();
    const rows = await sql.unsafe(
      "SELECT drafts.id, drafts.subject, drafts.body, drafts.attachment_document_ids, prospects.public_email, prospects.email_source_url FROM drafts JOIN prospects ON prospects.id = drafts.prospect_id WHERE drafts.id = $1 AND drafts.user_id = $2 AND drafts.status = 'drafted'",
      [id, session.userId]
    );
    const draft = rows[0];
    if (!draft) throw new AppError("That draft is no longer available.", 404);

    const attachmentIds = input.attachmentDocumentIds || (Array.isArray(draft.attachment_document_ids) ? draft.attachment_document_ids : []);
    if (input.attachmentDocumentIds) {
      for (const documentId of attachmentIds) {
        const owned = await sql.unsafe("SELECT id FROM documents WHERE id = $1 AND user_id = $2", [documentId, session.userId]);
        if (!owned.length) throw new AppError("One selected attachment is not available.", 422);
      }
    }

    const recipientEmail = input.recipientEmail === undefined ? (draft.public_email || "") : input.recipientEmail;
    const emailSourceUrl = input.emailSourceUrl === undefined ? (draft.email_source_url || "") : input.emailSourceUrl;
    if ((recipientEmail && !emailSourceUrl) || (!recipientEmail && emailSourceUrl)) {
      throw new AppError("Add both a public email and the official page where you found it.", 422);
    }

    await sql.unsafe(
      "UPDATE drafts SET subject = $1, body = $2, attachment_document_ids = $3::jsonb, updated_at = NOW() WHERE id = $4 AND user_id = $5",
      [
        input.subject === undefined ? draft.subject : input.subject,
        input.body === undefined ? draft.body : input.body,
        JSON.stringify(attachmentIds),
        id,
        session.userId
      ]
    );

    if (input.recipientEmail !== undefined || input.emailSourceUrl !== undefined) {
      await sql.unsafe(
        "UPDATE prospects SET public_email = $1, email_source_url = $2, email_verified = $3 WHERE id = (SELECT prospect_id FROM drafts WHERE id = $4 AND user_id = $5) AND user_id = $5",
        [recipientEmail || null, emailSourceUrl || null, Boolean(recipientEmail && emailSourceUrl), id, session.userId]
      );
    }

    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
