import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { dashboardFor } from "@/lib/dashboard";
import { errorResponse, noStore } from "@/lib/core";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return noStore(NextResponse.json({
      email: session.email,
      ...(await dashboardFor(session.userId))
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
