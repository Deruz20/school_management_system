"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { RbacDAO } from "@/lib/dao/rbac.dao";
import { revalidatePath } from "next/cache";

export async function createRoleAction(data: { name: string; permissions: string[] }) {
  const ctx = await requireAuth();
  await RbacDAO.createRole(ctx, data);
  revalidatePath("/settings/roles");
}

export async function updateRoleAction(roleId: string, data: { name?: string; permissions?: string[] }) {
  const ctx = await requireAuth();
  await RbacDAO.updateRole(ctx, roleId, data);
  revalidatePath("/settings/roles");
}

export async function deleteRoleAction(roleId: string) {
  const ctx = await requireAuth();
  await RbacDAO.deleteRole(ctx, roleId);
  revalidatePath("/settings/roles");
}
