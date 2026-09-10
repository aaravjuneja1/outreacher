import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { googleConnectUrl } from "@/lib/gmail";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    await enforceRateLimit("gmail-connect", session.userId, { limit: 5, windowSeconds: 60 * 60 });
    return noStore(NextResponse.json({ url: googleConnectUrl(session.userId) }));
  } catch (error) {
    return errorResponse(error);
  }
}
