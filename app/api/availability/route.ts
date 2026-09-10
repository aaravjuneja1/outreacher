import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, noStore } from "@/lib/core";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await db().unsafe("SELECT seats_taken FROM launch_state WHERE id = 1");
    const taken = Number(rows[0]?.seats_taken || 0);
    return noStore(NextResponse.json({ seatsTaken: taken, seatsRemaining: Math.max(0, 20 - taken) }));
  } catch (error) {
    return errorResponse(error);
  }
}
