import { db } from "../db";
import { TenantContext } from "./tenant-context";
import { GuardianRelationship } from "@prisma/client";
import { AdmissionSequenceDAO } from "./admissions-sequence.dao";
import { AuditService } from "../services/audit.service";
import { normalizePhone } from "../security/kyc-crypto";

/**
 * Migration & Backfill helper for legacy Parent users.
 * STRICT INVARIANT: Never silently marks migrated guardians as verified (always isVerified: false).
 */
export async function backfillLegacyParentUsers(ctx: TenantContext): Promise<{ migratedCount: number; skippedCount: number }> {
  if (!ctx.branchId) throw new Error("Branch scope required.");

  // Find users with userType PARENT in the system
  const parentUsers = await db.user.findMany({
    where: {
      userType: 'PARENT'
    }
  });

  let migratedCount = 0;
  let skippedCount = 0;

  for (const user of parentUsers) {
    // Check if guardian already exists for this email/phone in this branch
    const phone = user.phone ? normalizePhone(user.phone) : "+256700000000";
    const existing = await db.guardian.findFirst({
      where: {
        branchId: ctx.branchId,
        OR: [
          ...(user.email ? [{ email: user.email }] : []),
          { phonePrimary: phone }
        ]
      }
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    const guardianCode = await AdmissionSequenceDAO.getNextSequence(ctx.branchId, 'GRD');

    await db.guardian.create({
      data: {
        branchId: ctx.branchId,
        guardianCode,
        firstName: user.firstName,
        lastName: user.lastName,
        phonePrimary: phone,
        email: user.email || null,
        relationshipType: GuardianRelationship.LEGAL_GUARDIAN,
        provenance: 'LEGACY_USER_MIGRATION',
        isVerified: false, // STRICT COMPLIANCE: Never silently marked verified
      }
    });

    migratedCount++;
  }

  await AuditService.log(
    ctx,
    'identity.backfilled',
    'Guardian',
    ctx.branchId,
    `Backfilled ${migratedCount} legacy parent users into provisional unverified guardians (skipped ${skippedCount})`
  );

  return { migratedCount, skippedCount };
}
