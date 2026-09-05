import { db } from "../../db";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationOutbox
} from "@prisma/client";
import { SmsProvider, EmailProvider, MockNotificationProvider, AfricasTalkingSmsProvider } from "./providers";

export interface RunnerOptions {
  batchSize?: number;
  smsProvider?: SmsProvider;
  emailProvider?: EmailProvider;
  crashReclaimMinutes?: number;
  branchId?: string;
}

export interface ProcessBatchResult {
  claimedCount: number;
  sentCount: number;
  failedCount: number;
  cancelledCount: number;
  retriedCount: number;
  processedIds: string[];
}

export class NotificationRunner {
  private smsProvider: SmsProvider;
  private emailProvider: EmailProvider;
  private batchSize: number;
  private crashReclaimMinutes: number;
  private branchId?: string;

  constructor(options?: RunnerOptions) {
    this.batchSize = options?.batchSize || 25;
    this.crashReclaimMinutes = options?.crashReclaimMinutes || 5;
    this.branchId = options?.branchId;

    // Use injected providers or default providers
    if (options?.smsProvider) {
      this.smsProvider = options.smsProvider;
    } else if (process.env.NODE_ENV === "test") {
      this.smsProvider = new MockNotificationProvider();
    } else {
      this.smsProvider = new AfricasTalkingSmsProvider();
    }

    if (options?.emailProvider) {
      this.emailProvider = options.emailProvider;
    } else {
      this.emailProvider = new MockNotificationProvider();
    }
  }

  /**
   * Phase 1: Atomic Claim with PostgreSQL FOR UPDATE SKIP LOCKED.
   * Runs in a short, dedicated transaction and commits immediately.
   * ZERO locks or database transactions are held during external API calls.
   * Recovers crashed workers by reclaiming PROCESSING records older than crashReclaimMinutes.
   */
  async claimPendingBatch(limit: number = this.batchSize, branchFilter?: string): Promise<NotificationOutbox[]> {
    const reclaimInterval = `${this.crashReclaimMinutes} minutes`;
    const targetBranch = branchFilter || this.branchId;

    let claimed: NotificationOutbox[];
    if (targetBranch) {
      claimed = await db.$queryRaw`
        WITH claimable AS (
          SELECT id
          FROM "NotificationOutbox"
          WHERE "branchId" = ${targetBranch}
          AND (
            (status = 'PENDING'::"NotificationDeliveryStatus" AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= timezone('UTC', now())))
            OR
            (status = 'PROCESSING'::"NotificationDeliveryStatus" AND "lastAttempt" <= timezone('UTC', now()) - (${reclaimInterval})::INTERVAL)
          )
          ORDER BY "createdAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "NotificationOutbox" AS outbox
        SET
          status = 'PROCESSING'::"NotificationDeliveryStatus",
          "lastAttempt" = timezone('UTC', now()),
          "updatedAt" = timezone('UTC', now())
        FROM claimable
        WHERE outbox.id = claimable.id
        RETURNING outbox.*;
      `;
    } else {
      claimed = await db.$queryRaw`
        WITH claimable AS (
          SELECT id
          FROM "NotificationOutbox"
          WHERE (
            (status = 'PENDING'::"NotificationDeliveryStatus" AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= timezone('UTC', now())))
            OR
            (status = 'PROCESSING'::"NotificationDeliveryStatus" AND "lastAttempt" <= timezone('UTC', now()) - (${reclaimInterval})::INTERVAL)
          )
          ORDER BY "createdAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "NotificationOutbox" AS outbox
        SET
          status = 'PROCESSING'::"NotificationDeliveryStatus",
          "lastAttempt" = timezone('UTC', now()),
          "updatedAt" = timezone('UTC', now())
        FROM claimable
        WHERE outbox.id = claimable.id
        RETURNING outbox.*;
      `;
    }

    return claimed;
  }

  /**
   * Dispatches a single claimed record without holding any open database transactions.
   */
  async dispatchRecord(record: NotificationOutbox): Promise<{ status: NotificationDeliveryStatus; error?: string }> {
    // 1. Recipient Preference Check (Emergency messages bypass preferences)
    if (record.recipientId && !record.isEmergency) {
      const isAllowed = await this.checkRecipientPreference(record);
      if (!isAllowed) {
        await db.notificationOutbox.update({
          where: { id: record.id },
          data: {
            status: NotificationDeliveryStatus.CANCELLED,
            errorMessage: "Cancelled: Recipient notification preference disabled for this channel."
          }
        });
        return { status: NotificationDeliveryStatus.CANCELLED };
      }
    }

    // 2. Dispatch to external provider
    let result: { success: boolean; providerMessageId?: string; error?: string };

    try {
      if (record.channel === NotificationChannel.SMS) {
        result = await this.smsProvider.sendSms(record.recipient, record.message, record.idempotencyKey || undefined);
      } else if (record.channel === NotificationChannel.EMAIL) {
        result = await this.emailProvider.sendEmail(
          record.recipient,
          record.subject || "Nova School Notification",
          record.message,
          record.idempotencyKey || undefined
        );
      } else {
        // WhatsApp / Push / In-App fallback
        result = { success: true, providerMessageId: `portal-internal-${Date.now()}` };
      }
    } catch (err: unknown) {
      result = { success: false, error: (err instanceof Error ? err.message : "Unknown provider exception") };
    }

    // 3. Phase 3: Atomic Settle
    const currentAttempt = record.attemptCount + 1;

    if (result.success) {
      await db.notificationOutbox.update({
        where: { id: record.id },
        data: {
          status: NotificationDeliveryStatus.SENT,
          sentAt: new Date(),
          attemptCount: currentAttempt,
          errorMessage: null
        }
      });
      return { status: NotificationDeliveryStatus.SENT };
    }

    // Delivery Failed: Evaluate Backoff vs Terminal Failure
    const isTerminal = currentAttempt >= 3;

    if (isTerminal) {
      await db.notificationOutbox.update({
        where: { id: record.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          attemptCount: currentAttempt,
          errorMessage: result.error || "Exceeded maximum delivery attempts (3)."
        }
      });
      return { status: NotificationDeliveryStatus.FAILED, error: result.error };
    }

    // Retry backoff: attempt 1 -> 1m, attempt 2 -> 5m, attempt 3 -> 15m
    const backoffMinutes = currentAttempt === 1 ? 1 : currentAttempt === 2 ? 5 : 15;
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await db.notificationOutbox.update({
      where: { id: record.id },
      data: {
        status: NotificationDeliveryStatus.PENDING,
        attemptCount: currentAttempt,
        nextRetryAt,
        errorMessage: result.error || "Delivery failed, scheduled for retry."
      }
    });

    return { status: NotificationDeliveryStatus.PENDING, error: result.error };
  }

  /**
   * Evaluates if recipient has enabled notifications on this channel.
   */
  private async checkRecipientPreference(record: NotificationOutbox): Promise<boolean> {
    if (!record.recipientId) return true;

    // Check guardian preferences
    const guardianPref = await db.notificationPreference.findUnique({
      where: { guardianId: record.recipientId }
    });

    if (guardianPref) {
      if (record.channel === NotificationChannel.SMS && !guardianPref.smsEnabled) return false;
      if (record.channel === NotificationChannel.EMAIL && !guardianPref.emailEnabled) return false;
      if (record.channel === NotificationChannel.WHATSAPP && !guardianPref.whatsappEnabled) return false;
      return true;
    }

    // Check student preferences
    const studentPref = await db.notificationPreference.findUnique({
      where: { studentId: record.recipientId }
    });

    if (studentPref) {
      if (record.channel === NotificationChannel.SMS && !studentPref.smsEnabled) return false;
      if (record.channel === NotificationChannel.EMAIL && !studentPref.emailEnabled) return false;
      if (record.channel === NotificationChannel.WHATSAPP && !studentPref.whatsappEnabled) return false;
      return true;
    }

    return true;
  }

  /**
   * Processes a single batch of claimed outbox records.
   */
  async processBatch(limit: number = this.batchSize): Promise<ProcessBatchResult> {
    const claimed = await this.claimPendingBatch(limit);
    const result: ProcessBatchResult = {
      claimedCount: claimed.length,
      sentCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      retriedCount: 0,
      processedIds: []
    };

    for (const record of claimed) {
      const outcome = await this.dispatchRecord(record);
      result.processedIds.push(record.id);

      if (outcome.status === NotificationDeliveryStatus.SENT) result.sentCount++;
      else if (outcome.status === NotificationDeliveryStatus.FAILED) result.failedCount++;
      else if (outcome.status === NotificationDeliveryStatus.CANCELLED) result.cancelledCount++;
      else if (outcome.status === NotificationDeliveryStatus.PENDING) result.retriedCount++;
    }

    return result;
  }
}
