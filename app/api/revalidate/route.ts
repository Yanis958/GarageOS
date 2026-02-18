import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path") || "/dashboard";

    revalidatePath(path);

    return NextResponse.json({ revalidated: true, path });
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de la revalidation" },
      { status: 500 }
    );
  }
}
