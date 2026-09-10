import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, newId, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { createCheckedDraft } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

function textDocuments(rows: Array<{ original_name: string; extracted_text: string }>) {
  let remaining = 12000;
  const documents: Array<{ name: string; text: string }> = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const text = (row.extracted_text || "").slice(0, remaining);
    if (text.trim()) {
      documents.push({ name: row.original_name, text });
      remaining -= text.length;
    }
  }
  return documents;
}

export async function POST(request: NextRequest) {
  let claimed: Record<string, unknown> | undefined;
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const sql = db();
    const usage = await sql.unsafe("SELECT credits_used FROM credit_usage WHERE user_id = $1", [session.userId]);
    if (Number(usage[0]?.credits_used || 0) >= 10) {
      return noStore(NextResponse.json({ generated: false, exhausted: true }));
    }

    claimed = await sql.begin(async (transaction) => {
      const jobs = await transaction.unsafe(
        "SELECT draft_jobs.id AS job_id, prospects.id AS prospect_id, prospects.full_name, prospects.institution, prospects.research_summary, prospects.why_match, prospects.works FROM draft_jobs JOIN prospects ON prospects.id = draft_jobs.prospect_id WHERE draft_jobs.user_id = $1 AND draft_jobs.status = 'queued' AND prospects.status = 'queued' ORDER BY draft_jobs.created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1",
        [session.userId]
      );
      const job = jobs[0];
      if (!job) return undefined;
      await transaction.unsafe("UPDATE draft_jobs SET status = 'running', updated_at = NOW() WHERE id = $1", [job.job_id]);
      await transaction.unsafe("UPDATE prospects SET status = 'generating' WHERE id = $1 AND user_id = $2", [job.prospect_id, session.userId]);
      return job;
    });

    if (!claimed) {
      return noStore(NextResponse.json({ generated: false, empty: true }));
    }

    const [profileRows, documentRows] = await Promise.all([
      sql.unsafe(
        "SELECT full_name, institution, current_position, disciplines, specialisation, purpose, background, links FROM profiles WHERE user_id = $1",
        [session.userId]
      ),
      sql.unsafe(
        "SELECT original_name, extracted_text FROM documents WHERE user_id = $1 AND use_for_context = TRUE ORDER BY created_at ASC",
        [session.userId]
      )
    ]);
    const profile = profileRows[0];
    if (!profile?.full_name || !profile?.purpose) {
      throw new AppError("Complete your outreach profile before drafting.", 422);
    }

    const checked = await createCheckedDraft({
      profile: {
        fullName: profile.full_name,
        institution: profile.institution || "",
        currentRole: profile.current_position || "",
        disciplines: Array.isArray(profile.disciplines) ? profile.disciplines : [],
        specialisation: profile.specialisation || "",
        purpose: profile.purpose || "",
        background: profile.background || "",
        links: Array.isArray(profile.links) ? profile.links : []
      },
      professor: {
        fullName: String(claimed.full_name),
        institution: String(claimed.institution),
        researchSummary: String(claimed.research_summary),
        whyMatch: String(claimed.why_match),
        works: Array.isArray(claimed.works) ? claimed.works as Array<{ title: string; date: string; url: string; citedBy: number }> : []
      },
      documents: textDocuments(documentRows as unknown as Array<{ original_name: string; extracted_text: string }>)
    });

    const saved = await sql.begin(async (transaction) => {
      const credit = await transaction.unsafe(
        "UPDATE credit_usage SET credits_used = credits_used + 1, updated_at = NOW() WHERE user_id = $1 AND credits_used < 10 RETURNING credits_used",
        [session.userId]
      );
      if (!credit.length) return false;
      await transaction.unsafe(
        "INSERT INTO drafts (id, user_id, prospect_id, subject, body, validation_notes) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
        [newId(), session.userId, String(claimed?.prospect_id), checked.content.subject, checked.content.body, JSON.stringify(checked.repaired ? ["Repaired once after automated accuracy checks."] : [])]
      );
      await transaction.unsafe("UPDATE draft_jobs SET status = 'complete', updated_at = NOW() WHERE id = $1", [String(claimed?.job_id)]);
      await transaction.unsafe("UPDATE prospects SET status = 'drafted' WHERE id = $1 AND user_id = $2", [String(claimed?.prospect_id), session.userId]);
      return true;
    });

    if (!saved) {
      await sql.unsafe("UPDATE draft_jobs SET status = 'queued', updated_at = NOW() WHERE id = $1", [String(claimed.job_id)]);
      await sql.unsafe("UPDATE prospects SET status = 'queued' WHERE id = $1 AND user_id = $2", [String(claimed.prospect_id), session.userId]);
      return noStore(NextResponse.json({ generated: false, exhausted: true }));
    }

    return noStore(NextResponse.json({ generated: true, repaired: checked.repaired }));
  } catch (error) {
    if (claimed) {
      try {
        const sql = db();
        await sql.unsafe("UPDATE draft_jobs SET status = 'queued', updated_at = NOW() WHERE id = $1 AND status = 'running'", [String(claimed.job_id)]);
        await sql.unsafe("UPDATE prospects SET status = 'queued' WHERE id = $1 AND status = 'generating'", [String(claimed.prospect_id)]);
      } catch {
        // A retry can reclaim this job after the current request finishes.
      }
    }
    return errorResponse(error);
  }
}
