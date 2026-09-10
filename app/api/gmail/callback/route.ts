import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { AppError } from "@/lib/core";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { exchangeGoogleCode, readGoogleState } from "@/lib/gmail";

export const runtime = "nodejs";

function dashboardRedirect(status: string) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) throw new AppError("The app URL is not configured.", 503);
  return NextResponse.redirect(appUrl + "/dashboard?gmail=" + encodeURIComponent(status));
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const providerError = request.nextUrl.searchParams.get("error");
    if (providerError || !code || !state) return dashboardRedirect("not-connected");

    const userId = readGoogleState(state);
    const session = await requireSession();
    if (session.userId !== userId) throw new AppError("Your Gmail connection link is invalid. Try connecting again.", 400);
    const refreshToken = await exchangeGoogleCode(code);
    await db().unsafe(
      "INSERT INTO gmail_connections (user_id, encrypted_refresh_token, connected_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (user_id) DO UPDATE SET encrypted_refresh_token = EXCLUDED.encrypted_refresh_token, updated_at = NOW()",
      [userId, encryptToken(refreshToken)]
    );
    await db().unsafe("INSERT INTO security_events (id, user_id, event_type) VALUES ($1, $2, 'gmail_connected')", [crypto.randomUUID(), userId]);
    return dashboardRedirect("connected");
  } catch {
    return dashboardRedirect("not-connected");
  }
}
