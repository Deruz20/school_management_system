"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { UserDAO } from "@/lib/dao/user.dao";
import { revalidatePath } from "next/cache";

export async function assignUserAction(userId: string, roleId: string) {
  const ctx = await requireAuth();
  await UserDAO.assignUserToBranch(ctx, userId, roleId);
  revalidatePath("/settings/users");
}

export async function updateUserRoleAction(userId: string, roleId: string) {
  const ctx = await requireAuth();
  await UserDAO.updateUserBranchRole(ctx, userId, roleId);
  revalidatePath("/settings/users");
}

export async function removeUserAction(userId: string) {
  const ctx = await requireAuth();
  await UserDAO.removeUserFromBranch(ctx, userId);
  revalidatePath("/settings/users");
}
