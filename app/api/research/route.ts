import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { AppError, assertSameOrigin, errorResponse, jsonArray, newId, noStore } from "@/lib/core";
import { db } from "@/lib/db";
import { findResearchers } from "@/lib/openalex";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const runId = newId();
  let userId: string | undefined;
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    userId = session.userId;
    const sql = db();
    await enforceRateLimit("research", session.userId, { limit: 4, windowSeconds: 60 * 60, message: "You have reached the hourly research limit. Please try again later." });
    const profiles = await sql.unsafe(
      "SELECT full_name, institution, current_position, disciplines, specialisation, purpose, background, onboarding_complete FROM profiles WHERE user_id = $1",
      [session.userId]
    );
    const profile = profiles[0];
    if (!profile?.onboarding_complete) {
      throw new AppError("Complete your outreach profile before finding professors.", 422);
    }

    await sql.begin(async (transaction) => {
      const lock = await transaction.unsafe("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked", ["research:" + session.userId]);
      if (!lock[0]?.locked) throw new AppError("A professor search is already starting. Please wait for it to finish.", 409);
      await transaction.unsafe(
        "UPDATE research_runs SET status = 'failed', stage = 'Professor matching paused', error_message = 'This run took too long to finish.', completed_at = NOW() WHERE user_id = $1 AND status = 'running' AND created_at < NOW() - INTERVAL '5 minutes'",
        [session.userId]
      );
      const active = await transaction.unsafe("SELECT id FROM research_runs WHERE user_id = $1 AND status = 'running' LIMIT 1", [session.userId]);
      if (active.length) throw new AppError("A professor search is already running. Please wait for it to finish.", 409);
      await transaction.unsafe(
        "INSERT INTO research_runs (id, user_id, status, stage) VALUES ($1, $2, 'running', 'Finding relevant professors')",
        [runId, session.userId]
      );
    });

    const result = await findResearchers({
      disciplines: jsonArray<string>(profile.disciplines),
      specialisation: profile.specialisation || "",
      purpose: profile.purpose || ""
    });

    await sql.begin(async (transaction) => {
      for (const candidate of result.candidates) {
        const prospectId = newId();
        await transaction.unsafe(
          "INSERT INTO prospects (id, user_id, research_run_id, full_name, role, institution, openalex_author_url, official_profile_url, source_urls, works, research_summary, why_match, collected_at) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, NOW())",
          [
            prospectId,
            session.userId,
            runId,
            candidate.fullName,
            candidate.institution,
            candidate.openAlexAuthorUrl,
            candidate.officialProfileUrl || null,
            JSON.stringify(candidate.sourceUrls),
            JSON.stringify(candidate.works),
            candidate.researchSummary,
            candidate.whyMatch
          ]
        );
        await transaction.unsafe(
          "INSERT INTO draft_jobs (id, user_id, prospect_id, status) VALUES ($1, $2, $3, 'queued')",
          [newId(), session.userId, prospectId]
        );
      }
      await transaction.unsafe(
        "UPDATE research_runs SET status = 'complete', stage = 'Preparing your professor matches', profiles_checked = $1, papers_reviewed = $2, candidates_found = $3, completed_at = NOW() WHERE id = $4 AND user_id = $5",
        [result.profilesChecked, result.papersReviewed, result.candidates.length, runId, session.userId]
      );
    });

    return noStore(NextResponse.json({
      runId,
      profilesChecked: result.profilesChecked,
      papersReviewed: result.papersReviewed,
      candidatesFound: result.candidates.length
    }));
  } catch (error) {
    if (userId) {
      try {
        await db().unsafe(
          "UPDATE research_runs SET status = 'failed', stage = 'Professor matching paused', error_message = $1, completed_at = NOW() WHERE id = $2 AND user_id = $3",
          [error instanceof Error ? error.message.slice(0, 300) : "Professor matching failed", runId, userId]
        );
      } catch {
        // The original error is more useful to the user.
      }
    }
    return errorResponse(error);
  }
}
