import { NextRequest, NextResponse } from "next/server";
import { getCurrentGarageId } from "@/lib/actions/garage";
import { updateGarageSettingsAction } from "@/lib/actions/garage";
import { z } from "zod";

const AppearanceSettingsSchema = z.object({
  footer_text: z.string().nullable().optional(),
  show_logo_on_pdf: z.boolean().optional(),
  enable_compact_mode: z.boolean().optional(),
});

const CustomSettingsSchema = z.object({
  appearance: AppearanceSettingsSchema.optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentId = await getCurrentGarageId();
    
    if (!currentId || currentId !== id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }
    
    const body = await request.json();
    const parsed = CustomSettingsSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    
    const result = await updateGarageSettingsAction(id, {
      custom_settings: parsed.data,
    });
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur API settings:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
