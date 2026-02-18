import { NextResponse } from "next/server";
import { getAllInvitations, createInvitation } from "@/lib/actions/invitations";

export async function GET() {
  const invitations = await getAllInvitations();
  return NextResponse.json(invitations);
}

export async function POST(request: Request) {
  const { garageName } = await request.json();
  if (!garageName || typeof garageName !== "string") {
    return NextResponse.json({ error: "garageName requis" }, { status: 400 });
  }

  const result = await createInvitation(garageName);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.invitation);
}
