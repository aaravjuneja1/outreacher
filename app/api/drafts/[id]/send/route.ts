import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, newId, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/token-crypto";
import { GmailDeliveryUncertainError, sendWithGmail } from "@/lib/gmail";
import { enforceRateLimit } from "@/lib/rate-limit";
import { downloadPrivateFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let prospectId: string | undefined;
  let draftId: string | undefined;
  let userId: string | undefined;
  let deliveryConfirmed = false;
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    userId = session.userId;
    await enforceRateLimit("gmail-send", session.userId, { limit: 10, windowSeconds: 60 * 60, message: "You have reached the hourly send limit. Please wait before sending another email." });
    const { id } = await context.params;
    draftId = id;
    const sql = db();
    const [connectionRows, profileRows] = await Promise.all([
      sql.unsafe("SELECT encrypted_refresh_token FROM gmail_connections WHERE user_id = $1", [session.userId]),
      sql.unsafe("SELECT live_sending FROM profiles WHERE user_id = $1", [session.userId])
    ]);
    if (!connectionRows.length) throw new AppError("Connect Gmail before sending.", 422);
    if (!profileRows[0]?.live_sending) {
      throw new AppError("Turn on Live sending once before using a right swipe to send.", 422);
    }

    const claimed = await sql.unsafe(
      "UPDATE drafts SET status = 'sending', updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'drafted' RETURNING id, prospect_id, subject, body, attachment_document_ids",
      [id, session.userId]
    );
    const draft = claimed[0];
    if (!draft) throw new AppError("That draft is already being handled.", 409);
    const claimedProspectId = String(draft.prospect_id);
    prospectId = claimedProspectId;

    const prospects = await sql.unsafe(
      "SELECT public_email, email_verified, email_source_url FROM prospects WHERE id = $1 AND user_id = $2",
      [claimedProspectId, session.userId]
    );
    const prospect = prospects[0];
    if (!prospect?.public_email || !prospect.email_verified || !prospect.email_source_url) {
      throw new AppError("Add a public email from an official source before sending.", 422);
    }

    const attachmentIds = Array.isArray(draft.attachment_document_ids) ? draft.attachment_document_ids : [];
    const documentRows: Array<{ original_name: string; mime_type: string; byte_size: number; storage_path: string }> = [];
    for (const documentId of attachmentIds) {
      const rows = await sql.unsafe(
        "SELECT original_name, mime_type, byte_size, storage_path FROM documents WHERE id = $1 AND user_id = $2",
        [documentId, session.userId]
      );
      if (!rows.length) throw new AppError("One selected attachment is no longer available.", 422);
      documentRows.push(rows[0] as unknown as { original_name: string; mime_type: string; byte_size: number; storage_path: string });
    }
    const totalBytes = documentRows.reduce((total, document) => total + Number(document.byte_size), 0);
    if (totalBytes > 18 * 1024 * 1024) {
      throw new AppError("Attachments must total less than 18 MB to leave room for email encoding.", 422);
    }
    const attachments = await Promise.all(documentRows.map(async (document) => ({
      name: document.original_name,
      mimeType: document.mime_type,
      bytes: await downloadPrivateFile(document.storage_path)
    })));

    const messageId = await sendWithGmail({
      refreshToken: decryptToken(connectionRows[0].encrypted_refresh_token),
      to: prospect.public_email,
      subject: draft.subject,
      body: draft.body,
      attachments
    });
    deliveryConfirmed = true;

    await sql.begin(async (transaction) => {
      await transaction.unsafe("UPDATE drafts SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2", [id, session.userId]);
      await transaction.unsafe("UPDATE prospects SET status = 'sent' WHERE id = $1 AND user_id = $2", [claimedProspectId, session.userId]);
      await transaction.unsafe(
        "INSERT INTO send_history (id, user_id, draft_id, prospect_id, provider_message_id, recipient_email, subject) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [newId(), session.userId, id, claimedProspectId, messageId || null, prospect.public_email, draft.subject]
      );
      await transaction.unsafe("INSERT INTO security_events (id, user_id, event_type) VALUES ($1, $2, 'gmail_message_sent')", [newId(), session.userId]);
    });

    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    if (draftId && userId && !deliveryConfirmed && !(error instanceof GmailDeliveryUncertainError)) {
      try {
        await db().unsafe("UPDATE drafts SET status = 'drafted', updated_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'sending'", [draftId, userId]);
      } catch {
        // The draft remains protected from duplicate sends until a later retry.
      }
    }
    return errorResponse(error);
  }
}
