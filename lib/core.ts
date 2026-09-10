import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Unhandled request error", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json(
    { error: "Something went wrong. Please try again shortly." },
    { status: 500 }
  );
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.APP_URL;

  if (origin && appUrl && origin !== appUrl) {
    throw new AppError("This request did not come from the app.", 403);
  }
}

export function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
