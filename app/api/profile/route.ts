import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { ALL_DISCIPLINES } from "@/lib/disciplines";
import { assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  institution: z.string().trim().min(2).max(180),
  currentRole: z.string().trim().min(2).max(180),
  disciplines: z.array(z.string().refine((value) => ALL_DISCIPLINES.includes(value as never), "Choose a listed discipline.")).min(1).max(5),
  specialisation: z.string().trim().min(2).max(300),
  purpose: z.string().trim().min(30).max(2500),
  background: z.string().trim().min(20).max(5000),
  links: z.array(z.string().url().max(500)).max(5).default([])
});

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = profileSchema.parse(await request.json());
    await db().unsafe(
      "UPDATE profiles SET full_name = $1, institution = $2, current_role = $3, disciplines = $4::jsonb, specialisation = $5, purpose = $6, background = $7, links = $8::jsonb, onboarding_complete = TRUE, updated_at = NOW() WHERE user_id = $9",
      [
        input.fullName,
        input.institution,
        input.currentRole,
        JSON.stringify(input.disciplines),
        input.specialisation,
        input.purpose,
        input.background,
        JSON.stringify(input.links),
        session.userId
      ]
    );
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
