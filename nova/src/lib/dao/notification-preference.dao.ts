import { db } from "../db";
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationPreference,
  NotificationOutbox,
} from "@prisma/client";

export interface UpdatePreferencesInput {
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  whatsappEnabled?: boolean;
  portalEnabled?: boolean;
  preferredChannel?: NotificationChannel;
  feeAlerts?: boolean;
  academicAlerts?: boolean;
  attendanceAlerts?: boolean;
  disciplineAlerts?: boolean;
  welfareAlerts?: boolean;
}

export interface QueueOutboxInput {
  branchId: string;
  recipientId?: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  idempotencyKey?: string;
  isEmergency?: boolean;
  nextRetryAt?: Date;
}

export class NotificationPreferenceDAO {
  /**
   * Retrieves notification preferences for a guardian or returns sensible defaults.
   */
  static async getGuardianPreferences(branchId: string, guardianId: string): Promise<NotificationPreference> {
    const existing = await db.notificationPreference.findUnique({
      where: { guardianId }
    });
    if (existing) return existing;

    return db.notificationPreference.create({
      data: {
        branchId,
        guardianId,
        smsEnabled: true,
        emailEnabled: true,
        whatsappEnabled: false,
        portalEnabled: true,
        preferredChannel: NotificationChannel.PORTAL,
        feeAlerts: true,
        academicAlerts: true,
        attendanceAlerts: true,
        disciplineAlerts: true,
        welfareAlerts: true
      }
    });
  }

  /**
   * Upserts preferences for a guardian.
   */
  static async upsertGuardianPreferences(
    branchId: string,
    guardianId: string,
    input: UpdatePreferencesInput
  ): Promise<NotificationPreference> {
    return db.notificationPreference.upsert({
      where: { guardianId },
      create: {
        branchId,
        guardianId,
        smsEnabled: input.smsEnabled ?? true,
        emailEnabled: input.emailEnabled ?? true,
        whatsappEnabled: input.whatsappEnabled ?? false,
        portalEnabled: input.portalEnabled ?? true,
        preferredChannel: input.preferredChannel ?? NotificationChannel.PORTAL,
        feeAlerts: input.feeAlerts ?? true,
        academicAlerts: input.academicAlerts ?? true,
        attendanceAlerts: input.attendanceAlerts ?? true,
        disciplineAlerts: input.disciplineAlerts ?? true,
        welfareAlerts: input.welfareAlerts ?? true
      },
      update: {
        ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
        ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
        ...(input.whatsappEnabled !== undefined ? { whatsappEnabled: input.whatsappEnabled } : {}),
        ...(input.portalEnabled !== undefined ? { portalEnabled: input.portalEnabled } : {}),
        ...(input.preferredChannel !== undefined ? { preferredChannel: input.preferredChannel } : {}),
        ...(input.feeAlerts !== undefined ? { feeAlerts: input.feeAlerts } : {}),
        ...(input.academicAlerts !== undefined ? { academicAlerts: input.academicAlerts } : {}),
        ...(input.attendanceAlerts !== undefined ? { attendanceAlerts: input.attendanceAlerts } : {}),
        ...(input.disciplineAlerts !== undefined ? { disciplineAlerts: input.disciplineAlerts } : {}),
        ...(input.welfareAlerts !== undefined ? { welfareAlerts: input.welfareAlerts } : {})
      }
    });
  }

  /**
   * Retrieves notification preferences for a student or returns defaults.
   */
  static async getStudentPreferences(branchId: string, studentId: string): Promise<NotificationPreference> {
    const existing = await db.notificationPreference.findUnique({
      where: { studentId }
    });
    if (existing) return existing;

    return db.notificationPreference.create({
      data: {
        branchId,
        studentId,
        smsEnabled: true,
        emailEnabled: true,
        whatsappEnabled: false,
        portalEnabled: true,
        preferredChannel: NotificationChannel.PORTAL,
        feeAlerts: false, // by default students don't manage fee debt
        academicAlerts: true,
        attendanceAlerts: true,
        disciplineAlerts: true,
        welfareAlerts: true
      }
    });
  }

  /**
   * Upserts preferences for a student.
   */
  static async upsertStudentPreferences(
    branchId: string,
    studentId: string,
    input: UpdatePreferencesInput
  ): Promise<NotificationPreference> {
    return db.notificationPreference.upsert({
      where: { studentId },
      create: {
        branchId,
        studentId,
        smsEnabled: input.smsEnabled ?? true,
        emailEnabled: input.emailEnabled ?? true,
        whatsappEnabled: input.whatsappEnabled ?? false,
        portalEnabled: input.portalEnabled ?? true,
        preferredChannel: input.preferredChannel ?? NotificationChannel.PORTAL,
        feeAlerts: input.feeAlerts ?? false,
        academicAlerts: input.academicAlerts ?? true,
        attendanceAlerts: input.attendanceAlerts ?? true,
        disciplineAlerts: input.disciplineAlerts ?? true,
        welfareAlerts: input.welfareAlerts ?? true
      },
      update: {
        ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
        ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
        ...(input.whatsappEnabled !== undefined ? { whatsappEnabled: input.whatsappEnabled } : {}),
        ...(input.portalEnabled !== undefined ? { portalEnabled: input.portalEnabled } : {}),
        ...(input.preferredChannel !== undefined ? { preferredChannel: input.preferredChannel } : {}),
        ...(input.feeAlerts !== undefined ? { feeAlerts: input.feeAlerts } : {}),
        ...(input.academicAlerts !== undefined ? { academicAlerts: input.academicAlerts } : {}),
        ...(input.attendanceAlerts !== undefined ? { attendanceAlerts: input.attendanceAlerts } : {}),
        ...(input.disciplineAlerts !== undefined ? { disciplineAlerts: input.disciplineAlerts } : {}),
        ...(input.welfareAlerts !== undefined ? { welfareAlerts: input.welfareAlerts } : {})
      }
    });
  }

  /**
   * Queues an outbound notification into the delivery outbox.
   */
  static async queueOutboxNotification(input: QueueOutboxInput): Promise<NotificationOutbox> {
    if (input.idempotencyKey) {
      const existing = await db.notificationOutbox.findUnique({
        where: { idempotencyKey: input.idempotencyKey }
      });
      if (existing) {
        return existing;
      }
    }

    return db.notificationOutbox.create({
      data: {
        branchId: input.branchId,
        recipientId: input.recipientId,
        channel: input.channel,
        recipient: input.recipient,
        subject: input.subject,
        message: input.message,
        status: NotificationDeliveryStatus.PENDING,
        idempotencyKey: input.idempotencyKey,
        isEmergency: input.isEmergency ?? false,
        nextRetryAt: input.nextRetryAt ?? new Date()
      }
    });
  }

  /**
   * Retrieves pending outbox messages ready for delivery dispatcher.
   */
  static async getPendingOutbox(branchId: string, limit: number = 50): Promise<NotificationOutbox[]> {
    return db.notificationOutbox.findMany({
      where: {
        branchId,
        status: NotificationDeliveryStatus.PENDING
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
  }

  /**
   * Updates status of an outbox message (e.g. SENT, FAILED).
   */
  static async updateOutboxStatus(
    id: string,
    status: NotificationDeliveryStatus,
    errorMessage?: string
  ): Promise<NotificationOutbox> {
    return db.notificationOutbox.update({
      where: { id },
      data: {
        status,
        lastAttempt: new Date(),
        attemptCount: { increment: 1 },
        sentAt: status === NotificationDeliveryStatus.SENT ? new Date() : undefined,
        errorMessage: errorMessage || null
      }
    });
  }
}
