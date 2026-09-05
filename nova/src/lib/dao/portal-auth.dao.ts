import { db } from "../db";
import crypto from "crypto";
import { NotificationPreferenceDAO } from "./notification-preference.dao";
import { createSession } from "../auth/session";

export interface RequestOtpResult {
  success: boolean;
  message: string;
  expiresAt: Date;
  devOtp?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  session: {
    id: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
    userType: string;
    phone?: string | null;
  };
}

export class PortalAuthDAO {
  private static getSecret(): string {
    return process.env.PORTAL_OTP_SECRET || process.env.SESSION_SECRET || "portal-auth-secret-key-32b-length-at-least";
  }

  /**
   * Hashes a numeric OTP using HMAC-SHA256 with the server secret.
   * Plaintext OTP is NEVER stored in the database.
   */
  static hashOtp(otp: string): string {
    return crypto.createHmac("sha256", this.getSecret()).update(otp).digest("hex");
  }

  /**
   * Atomically increments the persistent failure counter for a phone number.
   * On reaching 10 consecutive failures, sets a 30-minute persistent lockout.
   * Survives restarts, workers, and multiple Next.js instances.
   */
  static async recordFailure(phone: string): Promise<{ failedCount: number; lockedUntil: Date | null; locked: boolean }> {
    const res = await db.$queryRaw<Array<{ failedCount: number; lockedUntil: Date | null }>>`
      INSERT INTO "PortalPhoneLockout" ("phone", "failedCount", "lastFailedAt", "lockedUntil", "createdAt", "updatedAt")
      VALUES (${phone}, 1, timezone('UTC', now()), NULL, timezone('UTC', now()), timezone('UTC', now()))
      ON CONFLICT ("phone") DO UPDATE
      SET
        "failedCount" = CASE
          WHEN "PortalPhoneLockout"."lockedUntil" IS NOT NULL AND "PortalPhoneLockout"."lockedUntil" <= timezone('UTC', now()) THEN 1
          ELSE "PortalPhoneLockout"."failedCount" + 1
        END,
        "lockedUntil" = CASE
          WHEN "PortalPhoneLockout"."lockedUntil" IS NOT NULL AND "PortalPhoneLockout"."lockedUntil" > timezone('UTC', now()) THEN "PortalPhoneLockout"."lockedUntil"
          WHEN (
            CASE
              WHEN "PortalPhoneLockout"."lockedUntil" IS NOT NULL AND "PortalPhoneLockout"."lockedUntil" <= timezone('UTC', now()) THEN 1
              ELSE "PortalPhoneLockout"."failedCount" + 1
            END
          ) >= 10 THEN timezone('UTC', now()) + INTERVAL '30 minutes'
          ELSE NULL
        END,
        "lastFailedAt" = timezone('UTC', now()),
        "updatedAt" = timezone('UTC', now())
      RETURNING "failedCount", "lockedUntil";
    `;

    const row = res[0] || { failedCount: 1, lockedUntil: null };
    const locked = row.lockedUntil !== null && new Date(row.lockedUntil) > new Date();
    return {
      failedCount: Number(row.failedCount),
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
      locked
    };
  }

  /**
   * Resets the persistent failure counter for a phone number on successful verification.
   */
  static async clearLockout(phone: string): Promise<void> {
    await db.$executeRaw`
      INSERT INTO "PortalPhoneLockout" ("phone", "failedCount", "lastFailedAt", "lockedUntil", "createdAt", "updatedAt")
      VALUES (${phone}, 0, NULL, NULL, timezone('UTC', now()), timezone('UTC', now()))
      ON CONFLICT ("phone") DO UPDATE
      SET "failedCount" = 0, "lockedUntil" = NULL, "updatedAt" = timezone('UTC', now());
    `;
  }

  /**
   * Checks whether the phone number is currently in persistent lockout.
   */
  static async checkLockout(phone: string): Promise<void> {
    const lockout = await db.portalPhoneLockout.findUnique({
      where: { phone }
    });

    if (lockout && lockout.lockedUntil && lockout.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((lockout.lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`Phone number is temporarily locked due to excessive failed attempts. Please try again in ${remainingMinutes} minute(s).`);
    }
  }

  /**
   * Requests a new 6-digit numeric OTP for phone verification.
   * Enforces 15-minute rate limit (max 3 requests) and persistent lockout checks.
   */
  static async requestOtp(branchId: string, phone: string): Promise<RequestOtpResult> {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      throw new Error("Phone number is required.");
    }

    // 1. Check persistent lockout
    await this.checkLockout(cleanPhone);

    // 2. Rate limit: max 3 requests per 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await db.portalAuthOtp.count({
      where: {
        branchId,
        phone: cleanPhone,
        createdAt: { gte: fifteenMinutesAgo }
      }
    });

    if (recentCount >= 3) {
      throw new Error("Rate limit exceeded: Maximum 3 OTP requests allowed per 15 minutes.");
    }

    // 3. Generate 6-digit numeric code
    const plainOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashOtp(plainOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // 4. Invalidate any existing active unconsumed OTPs for this phone in branch
    await db.portalAuthOtp.updateMany({
      where: {
        branchId,
        phone: cleanPhone,
        isConsumed: false
      },
      data: {
        isConsumed: true
      }
    });

    // 5. Store OTP record (HMAC hash only, NEVER plaintext)
    await db.portalAuthOtp.create({
      data: {
        branchId,
        phone: cleanPhone,
        otpHash,
        expiresAt
      }
    });

    // 6. Queue outbound SMS notification via outbox (emergency override ensures delivery regardless of preferences)
    await NotificationPreferenceDAO.queueOutboxNotification({
      branchId,
      channel: "SMS",
      recipient: cleanPhone,
      message: `Your Nova School Portal login code is ${plainOtp}. Valid for 5 minutes. Do not share this code.`,
      isEmergency: true
    });

    return {
      success: true,
      message: "OTP sent successfully.",
      expiresAt,
      devOtp: process.env.NODE_ENV !== "production" ? plainOtp : undefined
    };
  }

  /**
   * Verifies an OTP challenge against persistent lockout rules.
   * Inactivates OTP on 5 wrong attempts; locks phone for 30m on 10 consecutive failures.
   * On success, sets up user session.
   */
  static async verifyOtp(branchId: string, phone: string, inputOtp: string): Promise<VerifyOtpResult> {
    const cleanPhone = phone.trim();
    const cleanOtp = inputOtp.trim();

    if (!cleanPhone || !cleanOtp) {
      throw new Error("Phone number and OTP code are required.");
    }

    // 1. Check persistent lockout
    await this.checkLockout(cleanPhone);

    // 2. Look up latest active OTP record
    const record = await db.portalAuthOtp.findFirst({
      where: {
        branchId,
        phone: cleanPhone,
        isConsumed: false
      },
      orderBy: { createdAt: "desc" }
    });

    // If no record or expired
    if (!record || record.expiresAt <= new Date()) {
      const lock = await this.recordFailure(cleanPhone);
      if (lock.locked) {
        throw new Error("Phone number is temporarily locked due to excessive failed attempts. Please try again in 30 minutes.");
      }
      throw new Error("Invalid or expired OTP code.");
    }

    // 3. Challenge attempts check (max 5 per OTP)
    if (record.attempts >= 5) {
      await db.portalAuthOtp.update({
        where: { id: record.id },
        data: { isConsumed: true }
      });
      const lock = await this.recordFailure(cleanPhone);
      if (lock.locked) {
        throw new Error("Phone number is temporarily locked due to excessive failed attempts. Please try again in 30 minutes.");
      }
      throw new Error("OTP challenge invalid: Maximum 5 attempts exceeded. Please request a new code.");
    }

    // 4. Validate OTP hash with timing-safe comparison
    const expectedHash = this.hashOtp(cleanOtp);
    const hashMatches =
      record.otpHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(record.otpHash, "hex"), Buffer.from(expectedHash, "hex"));

    if (!hashMatches) {
      const newAttempts = record.attempts + 1;
      const willConsume = newAttempts >= 5;

      await db.portalAuthOtp.update({
        where: { id: record.id },
        data: {
          attempts: newAttempts,
          isConsumed: willConsume
        }
      });

      const lock = await this.recordFailure(cleanPhone);
      if (lock.locked) {
        throw new Error("Phone number is temporarily locked due to excessive failed attempts. Please try again in 30 minutes.");
      }

      if (willConsume) {
        throw new Error("OTP challenge invalid: Maximum 5 attempts exceeded. Please request a new code.");
      }

      throw new Error(`Invalid OTP code. ${5 - newAttempts} attempt(s) remaining.`);
    }

    // 5. Success: Consume OTP and clear lockout
    await db.portalAuthOtp.update({
      where: { id: record.id },
      data: { isConsumed: true }
    });
    await this.clearLockout(cleanPhone);

    // 6. Find corresponding user account in branch scope
    let user = await db.user.findFirst({
      where: {
        phone: cleanPhone,
        OR: [
          { branchAccess: { some: { branchId } } },
          { guardian: { branchId } },
          { student: { branchId } }
        ]
      }
    });

    if (!user) {
      // Check guardian linked to phone
      const guardian = await db.guardian.findFirst({
        where: {
          branchId,
          OR: [{ phonePrimary: cleanPhone }, { phoneSecondary: cleanPhone }]
        },
        include: { user: true }
      });
      if (guardian?.user) {
        user = guardian.user;
      }
    }

    if (!user) {
      // Check student with linked guardian phone
      const student = await db.student.findFirst({
        where: {
          branchId,
          guardians: {
            some: {
              guardian: {
                OR: [{ phonePrimary: cleanPhone }, { phoneSecondary: cleanPhone }]
              }
            }
          }
        },
        include: { user: true }
      });
      if (student?.user) {
        user = student.user;
      }
    }

    if (!user) {
      throw new Error("No user account associated with this phone number. Please contact school administration.");
    }

    if (user.status !== "ACTIVE") {
      throw new Error("User account is inactive or suspended. Access denied.");
    }

    // 7. Create authenticated session
    const session = await createSession(user.id);

    return {
      success: true,
      message: "Authentication successful.",
      session,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        phone: user.phone
      }
    };
  }
}
