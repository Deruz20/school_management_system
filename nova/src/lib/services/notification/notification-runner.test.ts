import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../db";
import { NotificationRunner } from "./notification-runner";
import { MockNotificationProvider } from "./providers";
import { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";
import { NotificationPreferenceDAO } from "../../dao/notification-preference.dao";

describe("Phase 3.2C: NotificationRunner Durable Outbox Worker", () => {
  let branchId: string;
  let mockSms: MockNotificationProvider;
  let mockEmail: MockNotificationProvider;
  let runner: NotificationRunner;

  beforeEach(async () => {
    await db.notificationOutbox.deleteMany({});
    mockSms = new MockNotificationProvider();
    mockEmail = new MockNotificationProvider();

    const org = await db.organization.create({
      data: { name: `Outbox_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Outbox Academy", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Central Branch", schoolId: school.id }
    });
    branchId = branch.id;

    runner = new NotificationRunner({
      branchId,
      batchSize: 10,
      smsProvider: mockSms,
      emailProvider: mockEmail,
      crashReclaimMinutes: 5
    });
  });

  it("1. Durable Claim: claimPendingBatch transitions PENDING records to PROCESSING", async () => {
    const item = await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      channel: NotificationChannel.SMS,
      recipient: "+256701111001",
      message: "Test message 1"
    });

    const claimed = await runner.claimPendingBatch(5);
    expect(claimed.some((c) => c.id === item.id)).toBe(true);

    const inDb = await db.notificationOutbox.findUnique({ where: { id: item.id } });
    expect(inDb?.status).toBe(NotificationDeliveryStatus.PROCESSING);
    expect(inDb?.lastAttempt).not.toBeNull();
  });

  it("2. PostgreSQL SKIP LOCKED: Concurrent workers claim disjoint subsets with zero duplicate claims", async () => {
    // Queue 20 messages
    const created = await Promise.all(
      Array.from({ length: 20 }).map((_, i) =>
        NotificationPreferenceDAO.queueOutboxNotification({
          branchId,
          channel: NotificationChannel.SMS,
          recipient: `+256701111${100 + i}`,
          message: `Batch concurrent message ${i}`
        })
      )
    );
    const createdIds = new Set(created.map((c) => c.id));

    // Two workers claim concurrently with batchSize 10
    const worker1 = new NotificationRunner({ branchId, batchSize: 10, smsProvider: mockSms });
    const worker2 = new NotificationRunner({ branchId, batchSize: 10, smsProvider: mockSms });

    const [batch1, batch2] = await Promise.all([
      worker1.claimPendingBatch(10),
      worker2.claimPendingBatch(10)
    ]);

    const ids1 = new Set(batch1.map((b) => b.id));
    const ids2 = new Set(batch2.map((b) => b.id));

    // Intersection must be empty (ZERO overlap / zero duplicate claim)
    for (const id of ids1) {
      expect(ids2.has(id)).toBe(false);
    }

    // Both batches claimed from created set
    for (const id of ids1) expect(createdIds.has(id)).toBe(true);
    for (const id of ids2) expect(createdIds.has(id)).toBe(true);
  });

  it("3. Crash Tolerance & Retry: Stuck PROCESSING records older than 5m are reclaimed and retried", async () => {
    // Insert an orphaned PROCESSING record simulating a crashed worker 6 minutes ago
    const stuckTime = new Date(Date.now() - 6 * 60 * 1000);
    const stuckItem = await db.notificationOutbox.create({
      data: {
        branchId,
        channel: NotificationChannel.SMS,
        recipient: "+256701111002",
        message: "Message from crashed worker",
        status: NotificationDeliveryStatus.PROCESSING,
        lastAttempt: stuckTime
      }
    });

    const claimed = await runner.claimPendingBatch(5);
    expect(claimed.some((c) => c.id === stuckItem.id)).toBe(true);

    // Dispatching succeeds
    const outcome = await runner.dispatchRecord(claimed.find((c) => c.id === stuckItem.id)!);
    expect(outcome.status).toBe(NotificationDeliveryStatus.SENT);

    const inDb = await db.notificationOutbox.findUnique({ where: { id: stuckItem.id } });
    expect(inDb?.status).toBe(NotificationDeliveryStatus.SENT);
  });

  it("4. Idempotency: Duplicate queue with same idempotencyKey returns existing record", async () => {
    const key = `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const first = await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      channel: NotificationChannel.SMS,
      recipient: "+256701111003",
      message: "Idempotent payment notification",
      idempotencyKey: key
    });

    const second = await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      channel: NotificationChannel.SMS,
      recipient: "+256701111003",
      message: "Idempotent payment notification",
      idempotencyKey: key
    });

    expect(first.id).toBe(second.id);
    const count = await db.notificationOutbox.count({ where: { idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it("5. Delivery Success: Successfully sent records are updated to SENT with sentAt", async () => {
    const item = await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      channel: NotificationChannel.SMS,
      recipient: "+256701111004",
      message: "Fee receipt notification"
    });

    const claimed = await runner.claimPendingBatch(5);
    const target = claimed.find((c) => c.id === item.id)!;
    const outcome = await runner.dispatchRecord(target);

    expect(outcome.status).toBe(NotificationDeliveryStatus.SENT);
    expect(mockSms.sentSms.some((s) => s.to === "+256701111004")).toBe(true);

    const inDb = await db.notificationOutbox.findUnique({ where: { id: item.id } });
    expect(inDb?.status).toBe(NotificationDeliveryStatus.SENT);
    expect(inDb?.sentAt).not.toBeNull();
    expect(inDb?.attemptCount).toBe(1);
    expect(inDb?.errorMessage).toBeNull();
  });

  it("6. Retry Backoff Schedule: 1m for 1st retry, 5m for 2nd retry", async () => {
    mockSms.shouldFail = true;

    const item = await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      channel: NotificationChannel.SMS,
      recipient: "+256701111005",
      message: "Failing message 1"
    });

    // Attempt 1: Backoff to 1 minute
    let claimed = await runner.claimPendingBatch(5);
    let target = claimed.find((c) => c.id === item.id)!;
    let outcome = await runner.dispatchRecord(target);
    expect(outcome.status).toBe(NotificationDeliveryStatus.PENDING);

    let inDb = await db.notificationOutbox.findUnique({ where: { id: item.id } });
    expect(inDb?.attemptCount).toBe(1);
    expect(inDb?.status).toBe(NotificationDeliveryStatus.PENDING);
    const diff1 = inDb!.nextRetryAt!.getTime() - Date.now();
    expect(diff1).toBeGreaterThan(45 * 1000);
    expect(diff1).toBeLessThanOrEqual(60 * 1000);

    // Simulate time passing: set nextRetryAt in past to claim for Attempt 2
    await db.notificationOutbox.update({
      where: { id: item.id },
      data: { nextRetryAt: new Date(Date.now() - 1000) }
    });

    // Attempt 2: Backoff to 5 minutes
    claimed = await runner.claimPendingBatch(5);
    target = claimed.find((c) => c.id === item.id)!;
    outcome = await runner.dispatchRecord(target);
    expect(outcome.status).toBe(NotificationDeliveryStatus.PENDING);

    inDb = await db.notificationOutbox.findUnique({ where: { id: item.id } });
    expect(inDb?.attemptCount).toBe(2);
    const diff2 = inDb!.nextRetryAt!.getTime() - Date.now();
    expect(diff2).toBeGreaterThan(4 * 60 * 1000);
    expect(diff2).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it("7. Terminal Failure: Record transitions to FAILED after 3 attempts", async () => {
    mockSms.shouldFail = true;

    const item = await db.notificationOutbox.create({
      data: {
        branchId,
        channel: NotificationChannel.SMS,
        recipient: "+256701111006",
        message: "Message at attempt 2",
        status: NotificationDeliveryStatus.PENDING,
        attemptCount: 2,
        nextRetryAt: new Date()
      }
    });

    const claimed = await runner.claimPendingBatch(5);
    const target = claimed.find((c) => c.id === item.id)!;
    const outcome = await runner.dispatchRecord(target);

    expect(outcome.status).toBe(NotificationDeliveryStatus.FAILED);
    const inDb = await db.notificationOutbox.findUnique({ where: { id: item.id } });
    expect(inDb?.status).toBe(NotificationDeliveryStatus.FAILED);
    expect(inDb?.attemptCount).toBe(3);
    expect(inDb?.errorMessage).toContain("Simulated provider delivery failure");
  });

  it("8. Preference Cancellation: If recipient disabled channel, status is CANCELLED", async () => {
    const guardian = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-PREF-${Date.now().toString().slice(-4)}`,
        firstName: "Sarah",
        lastName: "Namubiru",
        phonePrimary: "+256701111007",
        email: `sarah_${Date.now()}@test.com`
      }
    });

    // Guardian opted OUT of SMS
    await NotificationPreferenceDAO.upsertGuardianPreferences(branchId, guardian.id, {
      smsEnabled: false
    });

    const item = await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      recipientId: guardian.id,
      channel: NotificationChannel.SMS,
      recipient: guardian.phonePrimary,
      message: "Non-emergency marketing update",
      isEmergency: false
    });

    const claimed = await runner.claimPendingBatch(5);
    const target = claimed.find((c) => c.id === item.id)!;
    const outcome = await runner.dispatchRecord(target);

    expect(outcome.status).toBe(NotificationDeliveryStatus.CANCELLED);
    expect(mockSms.sentSms.some((s) => s.to === guardian.phonePrimary)).toBe(false);

    const inDb = await db.notificationOutbox.findUnique({ where: { id: item.id } });
    expect(inDb?.status).toBe(NotificationDeliveryStatus.CANCELLED);
    expect(inDb?.errorMessage).toContain("Recipient notification preference disabled");
  });

  it("9. Emergency Override: isEmergency bypasses disabled channel preference", async () => {
    const guardian = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-EMERG-${Date.now().toString().slice(-4)}`,
        firstName: "David",
        lastName: "Kigozi",
        phonePrimary: "+256701111008",
        email: `david_${Date.now()}@test.com`
      }
    });

    // Guardian opted OUT of SMS
    await NotificationPreferenceDAO.upsertGuardianPreferences(branchId, guardian.id, {
      smsEnabled: false
    });

    // Critical Emergency Broadcast / Security OTP
    const item = await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      recipientId: guardian.id,
      channel: NotificationChannel.SMS,
      recipient: guardian.phonePrimary,
      message: "EMERGENCY: Urgent school evacuation notice.",
      isEmergency: true
    });

    const claimed = await runner.claimPendingBatch(5);
    const target = claimed.find((c) => c.id === item.id)!;
    const outcome = await runner.dispatchRecord(target);

    // Emergency overrides preference: must be dispatched and marked SENT!
    expect(outcome.status).toBe(NotificationDeliveryStatus.SENT);
    expect(mockSms.sentSms.some((s) => s.to === guardian.phonePrimary)).toBe(true);

    const inDb = await db.notificationOutbox.findUnique({ where: { id: item.id } });
    expect(inDb?.status).toBe(NotificationDeliveryStatus.SENT);
  });
});
