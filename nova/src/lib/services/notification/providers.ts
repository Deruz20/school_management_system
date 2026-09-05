export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  sendSms(to: string, message: string, idempotencyKey?: string): Promise<SendResult>;
}

export interface EmailProvider {
  name: string;
  sendEmail(to: string, subject: string, body: string, idempotencyKey?: string): Promise<SendResult>;
}

/**
 * Mock Notification Provider for testing, local development, and CI environments.
 * Supports configurable simulated failures, latency, and sent message inspection.
 */
export class MockNotificationProvider implements SmsProvider, EmailProvider {
  name = "MockNotificationProvider";
  public sentSms: Array<{ to: string; message: string; idempotencyKey?: string; timestamp: Date }> = [];
  public sentEmails: Array<{ to: string; subject: string; body: string; idempotencyKey?: string; timestamp: Date }> = [];
  public shouldFail: boolean = false;
  public failureMessage: string = "Simulated provider delivery failure";

  async sendSms(to: string, message: string, idempotencyKey?: string): Promise<SendResult> {
    if (this.shouldFail) {
      return { success: false, error: this.failureMessage };
    }
    const providerMessageId = `mock-sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sentSms.push({ to, message, idempotencyKey, timestamp: new Date() });
    return { success: true, providerMessageId };
  }

  async sendEmail(to: string, subject: string, body: string, idempotencyKey?: string): Promise<SendResult> {
    if (this.shouldFail) {
      return { success: false, error: this.failureMessage };
    }
    const providerMessageId = `mock-email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sentEmails.push({ to, subject, body, idempotencyKey, timestamp: new Date() });
    return { success: true, providerMessageId };
  }

  clear() {
    this.sentSms = [];
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

/**
 * Africa's Talking SMS Provider implementation for East Africa (Uganda/Kenya/Tanzania/Rwanda).
 */
export class AfricasTalkingSmsProvider implements SmsProvider {
  name = "AfricasTalking";
  private apiKey?: string;
  private username?: string;
  private senderId?: string;

  constructor(config?: { apiKey?: string; username?: string; senderId?: string }) {
    this.apiKey = config?.apiKey || process.env.AT_API_KEY;
    this.username = config?.username || process.env.AT_USERNAME;
    this.senderId = config?.senderId || process.env.AT_SENDER_ID;
  }

  async sendSms(to: string, message: string, _idempotencyKey?: string): Promise<SendResult> {
    void _idempotencyKey;
    if (!this.apiKey || !this.username) {
      // In non-production or unset credentials, log and return simulated success
      if (process.env.NODE_ENV !== "production") {
        return { success: true, providerMessageId: `at-simulated-${Date.now()}` };
      }
      return { success: false, error: "Africa's Talking credentials not configured." };
    }

    try {
      // Post to Africa's Talking REST API
      const endpoint = this.username === "sandbox"
        ? "https://api.sandbox.africastalking.com/version1/messaging"
        : "https://api.africastalking.com/version1/messaging";

      const params = new URLSearchParams();
      params.append("username", this.username);
      params.append("to", to);
      params.append("message", message);
      if (this.senderId) params.append("from", this.senderId);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          apiKey: this.apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Africa's Talking HTTP ${response.status}: ${text}` };
      }

      const data = await response.json();
      const recipientData = data?.SMSMessageData?.Recipients?.[0];
      if (recipientData && (recipientData.status === "Success" || recipientData.statusCode === 101)) {
        return { success: true, providerMessageId: recipientData.messageId };
      }

      return {
        success: false,
        error: recipientData?.status || "Unknown response from Africa's Talking"
      };
    } catch (err: unknown) {
      return { success: false, error: (err instanceof Error ? err.message : undefined) || "Failed to dispatch SMS via Africa's Talking" };
    }
  }
}

/**
 * Twilio SMS Provider implementation.
 */
export class TwilioSmsProvider implements SmsProvider {
  name = "Twilio";
  private accountSid?: string;
  private authToken?: string;
  private fromNumber?: string;

  constructor(config?: { accountSid?: string; authToken?: string; fromNumber?: string }) {
    this.accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = config?.fromNumber || process.env.TWILIO_FROM_NUMBER;
  }

  async sendSms(to: string, message: string, _idempotencyKey?: string): Promise<SendResult> {
    void _idempotencyKey;
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      if (process.env.NODE_ENV !== "production") {
        return { success: true, providerMessageId: `twilio-simulated-${Date.now()}` };
      }
      return { success: false, error: "Twilio credentials not configured." };
    }

    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

      const params = new URLSearchParams();
      params.append("To", to);
      params.append("From", this.fromNumber);
      params.append("Body", message);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Twilio HTTP ${response.status}: ${text}` };
      }

      const data = await response.json();
      return { success: true, providerMessageId: data.sid };
    } catch (err: unknown) {
      return { success: false, error: (err instanceof Error ? err.message : undefined) || "Failed to dispatch SMS via Twilio" };
    }
  }
}
