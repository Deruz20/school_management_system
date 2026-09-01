"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { SettingsDAO } from "@/lib/dao/settings.dao";
import { revalidatePath } from "next/cache";

export async function updateBranchSettingsAction(data: {
  activeAcademicYearId?: string | null;
  activeTermId?: string | null;
  brandingLogoUrl?: string | null;
  brandingMotto?: string | null;
}) {
  const tenantCtx = await requireAuth();

  // Validate the term belongs to the year if setting term
  if (data.activeTermId && !data.activeAcademicYearId) {
    throw new Error("Cannot set Active Term without an Active Academic Year");
  }

  await SettingsDAO.updateSettings(tenantCtx, data);
  revalidatePath("/settings");
  revalidatePath("/"); // revalidate everything to pick up active year changes
}
