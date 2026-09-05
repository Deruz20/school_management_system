import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db";
import { PortalAuthDAO } from "./portal-auth.dao";
import { UserType, UserStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

describe("Phase 3.2C: PortalAuthDAO Phone OTP & Persistent Lockout", () => {
  let branchId: string;
  let branchBId: string;
  let userId: string;
  const testPhone = "+256701999888";
  const testPhoneB = "+256701999777";

  beforeEach(async () => {
    // Clean up test phone records
    await db.session.deleteMany({ where: { user: { phone: { in: [testPhone, testPhoneB] } } } });
    await db.user.deleteMany({ where: { phone: { in: [testPhone, testPhoneB] } } });
    await db.guardian.deleteMany({ where: { phonePrimary: { in: [testPhone, testPhoneB] } } });
    await db.portalAuthOtp.deleteMany({ where: { phone: { in: [testPhone, testPhoneB] } } });
    await db.portalPhoneLockout.deleteMany({ where: { phone: { in: [testPhone, testPhoneB] } } });
    await db.notificationOutbox.deleteMany({ where: { recipient: { in: [testPhone, testPhoneB] } } });

    // Ensure Organization and Branch exist
    const org = await db.organization.create({
      data: { name: `Auth_Org_${Date.now()}_${Math.random().toString(36).slice(2)}` }
    });

    const school = await db.school.create({
      data: { name: "Nova Auth Academy", organizationId: org.id }
    });

    const branch = await db.branch.create({
      data: { name: "Branch A", schoolId: school.id }
    });
    branchId = branch.id;

    const branchB = await db.branch.create({
      data: { name: "Branch B", schoolId: school.id }
    });
    branchBId = branchB.id;

    const guardian = await db.guardian.create({
      data: {
        branchId,
        guardianCode: `GRD-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 6)}`,
        firstName: "Grace",
        lastName: "Akello",
        phonePrimary: testPhone,
        email: `grace_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`
      }
    });

    const user = await db.user.create({
      data: {
        organizationId: org.id,
        guardianId: guardian.id,
        phone: testPhone,
        email: guardian.email,
        passwordHash: "hash",
        firstName: "Grace",
        lastName: "Akello",
        userType: UserType.PARENT,
        status: UserStatus.ACTIVE
      }
    });
    userId = user.id;
  });

  it("1. Plaintext OTP is never persisted in database (HMAC-SHA256 only)", async () => {
    const res = await PortalAuthDAO.requestOtp(branchId, testPhone);
    expect(res.success).toBe(true);
    expect(res.devOtp).toBeDefined();

    const plainOtp = res.devOtp!;
    const records = await db.portalAuthOtp.findMany({ where: { phone: testPhone } });
    expect(records.length).toBe(1);

    const record = records[0];
    // Must NOT contain the plaintext OTP
    expect(record.otpHash).not.toBe(plainOtp);
    // Must match HMAC hash
    const expectedHash = PortalAuthDAO.hashOtp(plainOtp);
    expect(record.otpHash).toBe(expectedHash);
  });

  it("2. Replay prevention: Consumed OTP cannot be reused", async () => {
    const res = await PortalAuthDAO.requestOtp(branchId, testPhone);
    const plainOtp = res.devOtp!;

    // First verification succeeds
    const v1 = await PortalAuthDAO.verifyOtp(branchId, testPhone, plainOtp);
    expect(v1.success).toBe(true);
    expect(v1.session.id).toBeDefined();

    // Replay attempt fails
    await expect(PortalAuthDAO.verifyOtp(branchId, testPhone, plainOtp)).rejects.toThrow(
      "Invalid or expired OTP code."
    );
  });

  it("3. Expiry: Expired OTP is rejected", async () => {
    const res = await PortalAuthDAO.requestOtp(branchId, testPhone);
    const plainOtp = res.devOtp!;

    // Manually expire the OTP in the past
    await db.portalAuthOtp.updateMany({
      where: { phone: testPhone },
      data: { expiresAt: new Date(Date.now() - 10000) }
    });

    await expect(PortalAuthDAO.verifyOtp(branchId, testPhone, plainOtp)).rejects.toThrow(
      "Invalid or expired OTP code."
    );
  });

  it("4. 5-attempt challenge invalidation: OTP consumed after 5 failed guesses", async () => {
    const res = await PortalAuthDAO.requestOtp(branchId, testPhone);
    const correctOtp = res.devOtp!;

    // 4 wrong attempts
    for (let i = 1; i <= 4; i++) {
      await expect(PortalAuthDAO.verifyOtp(branchId, testPhone, "000000")).rejects.toThrow(
        `Invalid OTP code. ${5 - i} attempt(s) remaining.`
      );
    }

    // 5th wrong attempt invalidates the challenge
    await expect(PortalAuthDAO.verifyOtp(branchId, testPhone, "000000")).rejects.toThrow(
      "OTP challenge invalid: Maximum 5 attempts exceeded. Please request a new code."
    );

    // Even if user now presents the correct OTP, it is consumed
    await expect(PortalAuthDAO.verifyOtp(branchId, testPhone, correctOtp)).rejects.toThrow(
      "Invalid or expired OTP code."
    );
  });

  it("5. Persistent 30-minute lock after 10 consecutive failures", async () => {
    // Generate an OTP
    await PortalAuthDAO.requestOtp(branchId, testPhone);

    // Perform 9 wrong guesses
    for (let i = 0; i < 9; i++) {
      try {
        await PortalAuthDAO.verifyOtp(branchId, testPhone, "999999");
      } catch {
        // expected error
      }
    }

    // Check lockout state: not locked yet
    let lockout = await db.portalPhoneLockout.findUnique({ where: { phone: testPhone } });
    expect(lockout?.failedCount).toBe(9);
    expect(lockout?.lockedUntil).toBeNull();

    // 10th failure triggers the 30-minute lock
    await expect(PortalAuthDAO.verifyOtp(branchId, testPhone, "999999")).rejects.toThrow(
      "Phone number is temporarily locked due to excessive failed attempts. Please try again in 30 minutes."
    );

    lockout = await db.portalPhoneLockout.findUnique({ where: { phone: testPhone } });
    expect(lockout?.failedCount).toBe(10);
    expect(lockout?.lockedUntil).not.toBeNull();
    const lockDurationMs = lockout!.lockedUntil!.getTime() - Date.now();
    expect(lockDurationMs).toBeGreaterThan(28 * 60 * 1000);
    expect(lockDurationMs).toBeLessThanOrEqual(31 * 60 * 1000);

    // Requesting a new OTP during lockout is also rejected
    await expect(PortalAuthDAO.requestOtp(branchId, testPhone)).rejects.toThrow(
      "Phone number is temporarily locked"
    );
  });

  it("6. Lock survives a fresh database client / process restart simulation", async () => {
    // Establish lock
    await db.portalPhoneLockout.create({
      data: {
        phone: testPhoneB,
        failedCount: 10,
        lockedUntil: new Date(Date.now() + 25 * 60 * 1000),
        lastFailedAt: new Date()
      }
    });

    // Simulate brand new client / fresh process
    const freshDb = new PrismaClient();
    try {
      const freshLockout = await freshDb.portalPhoneLockout.findUnique({ where: { phone: testPhoneB } });
      expect(freshLockout).not.toBeNull();
      expect(freshLockout!.failedCount).toBe(10);
      expect(freshLockout!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      // Attempting request on fresh client fails
      await expect(PortalAuthDAO.requestOtp(branchId, testPhoneB)).rejects.toThrow(
        "Phone number is temporarily locked"
      );
    } finally {
      await freshDb.$disconnect();
    }
  });

  it("7. Concurrent failure increments are race-safe (atomic UPSERT)", async () => {
    // Run 10 concurrent failed verification attempts simultaneously
    await PortalAuthDAO.requestOtp(branchId, testPhone);

    const promises = Array.from({ length: 10 }).map(() =>
      PortalAuthDAO.recordFailure(testPhone)
    );

    await Promise.all(promises);

    const lockout = await db.portalPhoneLockout.findUnique({ where: { phone: testPhone } });
    expect(lockout?.failedCount).toBe(10);
    expect(lockout?.lockedUntil).not.toBeNull();
  });

  it("8. Rate limit: Maximum 3 OTP requests allowed per 15 minutes", async () => {
    await PortalAuthDAO.requestOtp(branchId, testPhone);
    await PortalAuthDAO.requestOtp(branchId, testPhone);
    await PortalAuthDAO.requestOtp(branchId, testPhone);

    // 4th request within 15 minutes rejected
    await expect(PortalAuthDAO.requestOtp(branchId, testPhone)).rejects.toThrow(
      "Rate limit exceeded: Maximum 3 OTP requests allowed per 15 minutes."
    );
  });

  it("9. Cross-branch isolation: OTP issued in Branch A cannot be verified in Branch B", async () => {
    const res = await PortalAuthDAO.requestOtp(branchId, testPhone);
    const plainOtp = res.devOtp!;

    await expect(PortalAuthDAO.verifyOtp(branchBId, testPhone, plainOtp)).rejects.toThrow(
      "Invalid or expired OTP code."
    );
  });

  it("10. Successful verification creates an active Session for User", async () => {
    const res = await PortalAuthDAO.requestOtp(branchId, testPhone);
    const plainOtp = res.devOtp!;

    const result = await PortalAuthDAO.verifyOtp(branchId, testPhone, plainOtp);
    expect(result.success).toBe(true);
    expect(result.user.id).toBe(userId);
    expect(result.session.id).toBeDefined();

    // Verify session exists in db
    const sessionInDb = await db.session.findUnique({ where: { id: result.session.id } });
    expect(sessionInDb).not.toBeNull();
    expect(sessionInDb?.userId).toBe(userId);

    // Lockout record reset
    const lockout = await db.portalPhoneLockout.findUnique({ where: { phone: testPhone } });
    expect(lockout?.failedCount).toBe(0);
    expect(lockout?.lockedUntil).toBeNull();
  });
});
