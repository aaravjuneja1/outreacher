import { db } from "@/lib/db";

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function dashboardFor(userId: string) {
  const sql = db();
  const [profileRows, documentRows, usageRows, connectionRows, draftRows, runRows, sendRows] = await Promise.all([
    sql.unsafe("SELECT full_name, institution, current_role, disciplines, specialisation, purpose, background, links, live_sending, onboarding_complete FROM profiles WHERE user_id = $1", [userId]),
    sql.unsafe("SELECT id, original_name, mime_type, byte_size, use_for_context, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC", [userId]),
    sql.unsafe("SELECT credits_used FROM credit_usage WHERE user_id = $1", [userId]),
    sql.unsafe("SELECT account_email, connected_at FROM gmail_connections WHERE user_id = $1", [userId]),
    sql.unsafe(
      "SELECT drafts.id AS draft_id, drafts.subject, drafts.body, drafts.attachment_document_ids, drafts.status AS draft_status, drafts.validation_notes, drafts.created_at AS draft_created_at, prospects.id AS prospect_id, prospects.full_name, prospects.role, prospects.institution, prospects.public_email, prospects.email_verified, prospects.email_source_url, prospects.openalex_author_url, prospects.official_profile_url, prospects.source_urls, prospects.works, prospects.research_summary, prospects.why_match, prospects.collected_at FROM drafts JOIN prospects ON prospects.id = drafts.prospect_id WHERE drafts.user_id = $1 AND drafts.status = 'drafted' ORDER BY drafts.created_at ASC",
      [userId]
    ),
    sql.unsafe("SELECT id, status, stage, profiles_checked, papers_reviewed, candidates_found, error_message, created_at, completed_at FROM research_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId]),
    sql.unsafe("SELECT COUNT(*)::int AS sent_count FROM send_history WHERE user_id = $1", [userId])
  ]);

  const profile = profileRows[0] || {
    full_name: "",
    institution: "",
    current_role: "",
    disciplines: [],
    specialisation: "",
    purpose: "",
    background: "",
    links: [],
    live_sending: false,
    onboarding_complete: false
  };

  return {
    profile: {
      fullName: profile.full_name || "",
      institution: profile.institution || "",
      currentRole: profile.current_role || "",
      disciplines: arrayValue(profile.disciplines),
      specialisation: profile.specialisation || "",
      purpose: profile.purpose || "",
      background: profile.background || "",
      links: arrayValue(profile.links),
      liveSending: Boolean(profile.live_sending),
      onboardingComplete: Boolean(profile.onboarding_complete)
    },
    documents: documentRows.map((row) => ({
      id: row.id,
      name: row.original_name,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      useForContext: Boolean(row.use_for_context),
      createdAt: row.created_at
    })),
    usage: {
      used: Number(usageRows[0]?.credits_used || 0),
      remaining: Math.max(0, 10 - Number(usageRows[0]?.credits_used || 0))
    },
    gmail: {
      connected: Boolean(connectionRows[0]),
      accountEmail: connectionRows[0]?.account_email || null,
      connectedAt: connectionRows[0]?.connected_at || null
    },
    drafts: draftRows.map((row) => ({
      id: row.draft_id,
      subject: row.subject,
      body: row.body,
      attachmentDocumentIds: arrayValue(row.attachment_document_ids),
      validationNotes: arrayValue(row.validation_notes),
      createdAt: row.draft_created_at,
      prospect: {
        id: row.prospect_id,
        fullName: row.full_name,
        role: row.role,
        institution: row.institution,
        publicEmail: row.public_email,
        emailVerified: Boolean(row.email_verified),
        emailSourceUrl: row.email_source_url,
        openAlexAuthorUrl: row.openalex_author_url,
        officialProfileUrl: row.official_profile_url,
        sourceUrls: arrayValue(row.source_urls),
        works: arrayValue(row.works),
        researchSummary: row.research_summary,
        whyMatch: row.why_match,
        collectedAt: row.collected_at
      }
    })),
    latestResearch: runRows[0] || null,
    sentCount: Number(sendRows[0]?.sent_count || 0)
  };
}
