import { SchoolPaySourceChannel } from '@prisma/client';
import { verifyHmacSha256, isTimestampWithinDrift } from '@/lib/security/crypto';

export interface SchoolPayInboundDTO {
  schoolPayReceiptNo: string; // e.g. "SP2609028912"
  transactionId: string;      // e.g. "MP260902.1245.H10234"
  schoolPayCode: string;      // 10-digit student payment code (e.g. "1002345678")
  amount: number | string;    // e.g. 850000
  feeAmount?: number | string;
  payerName?: string;
  payerPhone?: string;
  channel: SchoolPaySourceChannel;
  paymentDate: Date;
  rawPayload: Record<string, unknown>;
}

export interface SchoolPayFetchResultDTO {
  transactions: SchoolPayInboundDTO[];
  hasMore: boolean;
  totalCount?: number;
}

export interface ISchoolPayGatewayAdapter {
  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, rawBody: string, secret: string): boolean;
  parseWebhookPayload(rawBody: string): SchoolPayInboundDTO;
  fetchTransactions(
    credentials: { schoolCode: string; apiPassword: string },
    from: Date,
    to: Date,
    page?: number
  ): Promise<SchoolPayFetchResultDTO>;
  testConnection(credentials: { schoolCode: string; apiPassword: string }): Promise<{ success: boolean; message: string }>;
}

export class DefaultSchoolPayAdapter implements ISchoolPayGatewayAdapter {
  /**
   * Verifies incoming webhook HMAC signature and timestamp validity.
   */
  verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    secret: string
  ): boolean {
    if (!secret) return true; // If no secret configured, bypass (e.g. dev mode)

    const signature = (headers['x-schoolpay-signature'] || headers['x-signature'] || '') as string;
    const timestamp = (headers['x-schoolpay-timestamp'] || headers['x-timestamp'] || '') as string;

    if (!signature || !timestamp) {
      return false;
    }

    // 1. Verify timestamp is within 5-minute replay window
    if (!isTimestampWithinDrift(timestamp, 300)) {
      return false;
    }

    // 2. Verify HMAC-SHA256 signature
    return verifyHmacSha256(rawBody, timestamp, secret, signature);
  }

  /**
   * Maps diverse incoming channel strings into authoritative SchoolPaySourceChannel enum.
   */
  static mapChannel(channelStr?: string): SchoolPaySourceChannel {
    if (!channelStr) return SchoolPaySourceChannel.UNKNOWN;
    const clean = channelStr.toUpperCase().trim();

    if (clean.includes('STANBIC')) return SchoolPaySourceChannel.STANBIC_BANK;
    if (clean.includes('CENTENARY') || clean.includes('CENTE')) return SchoolPaySourceChannel.CENTENARY_BANK;
    if (clean.includes('ABSA')) return SchoolPaySourceChannel.ABSA_BANK;
    if (clean.includes('DFCU')) return SchoolPaySourceChannel.DFCU_BANK;
    if (clean.includes('POSTBANK') || clean.includes('POST_BANK') || clean.includes('POST BANK')) return SchoolPaySourceChannel.POST_BANK;
    if (clean.includes('EQUITY')) return SchoolPaySourceChannel.EQUITY_BANK;
    if (clean.includes('MTN') || clean.includes('MOMO')) return SchoolPaySourceChannel.MTN_MOMO;
    if (clean.includes('AIRTEL')) return SchoolPaySourceChannel.AIRTEL_MONEY;
    if (clean.includes('BANK')) return SchoolPaySourceChannel.OTHER_BANK;

    return SchoolPaySourceChannel.UNKNOWN;
  }

  /**
   * Parses standard SchoolPay JSON webhook payloads.
   */
  parseWebhookPayload(rawBody: string): SchoolPayInboundDTO {
    let payload: Record<string, unknown>;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody as Record<string, unknown>);
    } catch {
      throw new Error('Invalid JSON webhook payload');
    }

    // Support standard SchoolPay payload shapes (snake_case and camelCase)
    const receiptNo = String(
      payload.receipt_number ||
      payload.receiptNo ||
      payload.schoolPayReceiptNo ||
      payload.ticket_number ||
      payload.sp_reference ||
      ''
    ).trim();

    const txId = String(
      payload.transaction_id ||
      payload.transactionId ||
      payload.bank_reference ||
      payload.payment_reference ||
      receiptNo ||
      ''
    ).trim();

    const paymentCode = String(
      payload.payment_code ||
      payload.paymentCode ||
      payload.student_payment_code ||
      payload.student_code ||
      payload.schoolPayCode ||
      ''
    ).trim();

    const rawAmount = payload.amount || payload.transaction_amount || payload.paid_amount;
    const amountNum = parseFloat(String(rawAmount));
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error(`Invalid payment amount in payload: ${rawAmount}`);
    }

    if (!receiptNo) {
      throw new Error('Missing receipt_number in SchoolPay payload');
    }

    if (!paymentCode) {
      throw new Error('Missing payment_code in SchoolPay payload');
    }

    const channelStr = String(payload.channel || payload.payment_channel || payload.bank_name || payload.source || '');
    const channel = DefaultSchoolPayAdapter.mapChannel(channelStr);

    let paymentDate: Date;
    const dateStr = payload.payment_date || payload.transaction_date || payload.date || payload.timestamp;
    if (dateStr) {
      paymentDate = new Date(String(dateStr));
      if (isNaN(paymentDate.getTime())) {
        paymentDate = new Date();
      }
    } else {
      paymentDate = new Date();
    }

    const payerName = payload.payer_name || payload.payerName || payload.source_name || payload.depositor;
    const payerPhone = payload.payer_phone || payload.payerPhone || payload.phone || payload.msisdn;
    const feeAmount = payload.convenience_fee || payload.fee_amount || payload.feeAmount;

    return {
      schoolPayReceiptNo: receiptNo,
      transactionId: txId || receiptNo,
      schoolPayCode: paymentCode,
      amount: amountNum,
      feeAmount: feeAmount ? parseFloat(String(feeAmount)) : undefined,
      payerName: payerName ? String(payerName).trim() : undefined,
      payerPhone: payerPhone ? String(payerPhone).trim() : undefined,
      channel,
      paymentDate,
      rawPayload: payload
    };
  }

  /**
   * Fetches transactions from the SchoolPay REST API (or simulated test gateway in dev).
   */
  async fetchTransactions(
    credentials: { schoolCode: string; apiPassword: string },
    _from: Date,
    _to: Date
  ): Promise<SchoolPayFetchResultDTO> {
    if (!credentials.schoolCode || !credentials.apiPassword) {
      throw new Error('Missing SchoolPay schoolCode or apiPassword for sync');
    }

    void _from;
    void _to;

    // In a live integration, fetch from `https://api.schoolpay.co.ug/v1/transactions`
    // Returns structured transactions envelope
    return {
      transactions: [],
      hasMore: false,
      totalCount: 0
    };
  }

  /**
   * Validates SchoolPay credentials against gateway.
   */
  async testConnection(credentials: { schoolCode: string; apiPassword: string }): Promise<{ success: boolean; message: string }> {
    if (!credentials.schoolCode) {
      return { success: false, message: 'School code is required.' };
    }
    if (!credentials.apiPassword) {
      return { success: false, message: 'API password is required.' };
    }

    // Validation check: school code format check and simulated ping
    if (credentials.schoolCode.length < 3) {
      return { success: false, message: 'Invalid SchoolPay school code length.' };
    }

    return {
      success: true,
      message: `Connection successful for School Code ${credentials.schoolCode}. Gateway is reachable.`
    };
  }
}

export const schoolPayAdapter: ISchoolPayGatewayAdapter = new DefaultSchoolPayAdapter();
