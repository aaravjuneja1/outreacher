import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { errorResponse } from "@/lib/core";
import { googleConnectUrl } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.redirect(googleConnectUrl(session.userId));
  } catch (error) {
    return errorResponse(error);
  }
}
