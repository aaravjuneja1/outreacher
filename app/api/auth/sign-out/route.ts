import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, errorResponse, noStore } from "@/lib/core";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(clearSessionCookie());
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
