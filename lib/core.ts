import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function newId() {
  return randomUUID();
}

export function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\- ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

export function shortText(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function hashForLog(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return noStore(NextResponse.json({ error: error.message }, { status: error.status }));
  }

  if (error instanceof ZodError) {
    const message = error.issues[0]?.message || "Please check the form and try again.";
    return noStore(NextResponse.json({ error: message }, { status: 422 }));
  }

  console.error("Unhandled request error", error instanceof Error ? error.message : "Unknown error");
  return noStore(NextResponse.json(
    { error: "Something went wrong. Please try again shortly." },
    { status: 500 }
  ));
}

export function assertSameOrigin(request: NextRequest) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new AppError("The app is not configured yet.", 503);
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(appUrl).origin;
  } catch {
    throw new AppError("The app is not configured yet.", 503);
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== expectedOrigin) {
    throw new AppError("This request did not come from the app.", 403);
  }
}

export function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
