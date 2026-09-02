import { db } from '../db';
import { TenantContext } from './tenant-context';
import { AuditService } from '../services/audit.service';
import { encryptSecret, decryptSecret } from '../security/crypto';
import { schoolPayAdapter } from '../adapters/schoolpay.adapter';

export interface SchoolPayConfigDTO {
  id?: string;
  branchId: string;
  schoolCode: string;
  enabled: boolean;
  autoPostMatched: boolean;
  allowedIps?: string | null;
  hasApiPassword: boolean;
  hasChannelKey: boolean;
  hasWebhookSecret: boolean;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpdateSchoolPayConfigInput {
  schoolCode: string;
  apiPassword?: string;
  channelKey?: string;
  webhookSecret?: string;
  enabled: boolean;
  autoPostMatched: boolean;
  allowedIps?: string | null;
}

export class SchoolPayConfigDAO {
  private static checkReadPermission(ctx: TenantContext) {
    if (!ctx.branchId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:read') ||
      perms.includes('fees:schoolpay:read') ||
      perms.includes('fees:write')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:read");
  }

  private static checkWritePermission(ctx: TenantContext) {
    if (!ctx.branchId || !ctx.userId) throw new Error("Unauthorized");
    const perms = ctx.permissions || [];
    if (
      perms.includes('all') ||
      perms.includes('fees:write') ||
      perms.includes('fees:schoolpay:write')
    ) {
      return true;
    }
    throw new Error("Missing permission: fees:schoolpay:write");
  }

  /**
   * Retrieves the SchoolPay configuration for the current branch with secrets masked.
   */
  static async getConfig(ctx: TenantContext): Promise<SchoolPayConfigDTO | null> {
    this.checkReadPermission(ctx);
    const branchId = ctx.branchId!;

    const config = await db.schoolPayConfig.findUnique({
      where: { branchId }
    });

    if (!config) return null;

    return {
      id: config.id,
      branchId: config.branchId,
      schoolCode: config.schoolCode,
      enabled: config.enabled,
      autoPostMatched: config.autoPostMatched,
      allowedIps: config.allowedIps,
      hasApiPassword: !!config.apiPasswordEnc,
      hasChannelKey: !!config.channelKeyEnc,
      hasWebhookSecret: !!config.webhookSecretEnc,
      lastSyncedAt: config.lastSyncedAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  /**
   * Internal lookup: retrieves decrypted configuration for webhook receiver by unique schoolCode.
   */
  static async getInternalConfigBySchoolCode(schoolCode: string): Promise<{
    id: string;
    branchId: string;
    schoolCode: string;
    apiPassword: string | null;
    channelKey: string | null;
    webhookSecret: string | null;
    enabled: boolean;
    autoPostMatched: boolean;
    allowedIps: string | null;
  } | null> {
    if (!schoolCode) return null;

    const config = await db.schoolPayConfig.findUnique({
      where: { schoolCode }
    });

    if (!config || !config.enabled) return null;

    return {
      id: config.id,
      branchId: config.branchId,
      schoolCode: config.schoolCode,
      apiPassword: decryptSecret(config.apiPasswordEnc),
      channelKey: decryptSecret(config.channelKeyEnc),
      webhookSecret: decryptSecret(config.webhookSecretEnc),
      enabled: config.enabled,
      autoPostMatched: config.autoPostMatched,
      allowedIps: config.allowedIps
    };
  }

  /**
   * Updates or creates the branch SchoolPay configuration. Encrypts sensitive secrets at rest.
   */
  static async updateConfig(ctx: TenantContext, input: UpdateSchoolPayConfigInput): Promise<SchoolPayConfigDTO> {
    this.checkWritePermission(ctx);
    const branchId = ctx.branchId!;

    if (!input.schoolCode || !input.schoolCode.trim()) {
      throw new Error("SchoolPay schoolCode is mandatory.");
    }

    const cleanSchoolCode = input.schoolCode.trim();

    // Verify schoolCode uniqueness across other branches
    const existingOther = await db.schoolPayConfig.findFirst({
      where: {
        schoolCode: cleanSchoolCode,
        branchId: { not: branchId }
      }
    });

    if (existingOther) {
      throw new Error(`SchoolCode "${cleanSchoolCode}" is already assigned to another branch.`);
    }

    const current = await db.schoolPayConfig.findUnique({
      where: { branchId }
    });

    // Encrypt secrets if new values provided, otherwise preserve existing
    const apiPasswordEnc = input.apiPassword && input.apiPassword.trim() !== ''
      ? encryptSecret(input.apiPassword.trim())
      : current?.apiPasswordEnc ?? null;

    const channelKeyEnc = input.channelKey && input.channelKey.trim() !== ''
      ? encryptSecret(input.channelKey.trim())
      : current?.channelKeyEnc ?? null;

    const webhookSecretEnc = input.webhookSecret && input.webhookSecret.trim() !== ''
      ? encryptSecret(input.webhookSecret.trim())
      : current?.webhookSecretEnc ?? null;

    const saved = await db.schoolPayConfig.upsert({
      where: { branchId },
      create: {
        branchId,
        schoolCode: cleanSchoolCode,
        apiPasswordEnc,
        channelKeyEnc,
        webhookSecretEnc,
        enabled: Boolean(input.enabled),
        autoPostMatched: input.autoPostMatched !== undefined ? Boolean(input.autoPostMatched) : true,
        allowedIps: input.allowedIps?.trim() || null
      },
      update: {
        schoolCode: cleanSchoolCode,
        apiPasswordEnc,
        channelKeyEnc,
        webhookSecretEnc,
        enabled: Boolean(input.enabled),
        autoPostMatched: input.autoPostMatched !== undefined ? Boolean(input.autoPostMatched) : true,
        allowedIps: input.allowedIps?.trim() || null
      }
    });

    // Audit log without sensitive credentials
    await AuditService.log(
      ctx,
      'UPDATE',
      'SchoolPayConfig',
      saved.id,
      JSON.stringify({
        schoolCode: cleanSchoolCode,
        enabled: saved.enabled,
        autoPostMatched: saved.autoPostMatched,
        hasApiPassword: !!saved.apiPasswordEnc,
        hasWebhookSecret: !!saved.webhookSecretEnc
      })
    );

    return {
      id: saved.id,
      branchId: saved.branchId,
      schoolCode: saved.schoolCode,
      enabled: saved.enabled,
      autoPostMatched: saved.autoPostMatched,
      allowedIps: saved.allowedIps,
      hasApiPassword: !!saved.apiPasswordEnc,
      hasChannelKey: !!saved.channelKeyEnc,
      hasWebhookSecret: !!saved.webhookSecretEnc,
      lastSyncedAt: saved.lastSyncedAt,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt
    };
  }

  /**
   * Tests connection with SchoolPay gateway using saved or provided credentials.
   */
  static async testConnection(
    ctx: TenantContext,
    testInput?: { schoolCode?: string; apiPassword?: string }
  ): Promise<{ success: boolean; message: string }> {
    this.checkWritePermission(ctx);
    const branchId = ctx.branchId!;

    let schoolCode = testInput?.schoolCode?.trim();
    let apiPassword = testInput?.apiPassword?.trim();

    if (!schoolCode || !apiPassword) {
      const config = await db.schoolPayConfig.findUnique({
        where: { branchId }
      });
      if (config) {
        if (!schoolCode) schoolCode = config.schoolCode;
        if (!apiPassword && config.apiPasswordEnc) {
          apiPassword = decryptSecret(config.apiPasswordEnc) || undefined;
        }
      }
    }

    if (!schoolCode || !apiPassword) {
      return {
        success: false,
        message: 'School code and API password are required to test connection.'
      };
    }

    return await schoolPayAdapter.testConnection({ schoolCode, apiPassword });
  }
}
