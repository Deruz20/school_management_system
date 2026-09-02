import { NextRequest, NextResponse } from 'next/server';
import { SchoolPayConfigDAO } from '@/lib/dao/schoolpay-config.dao';
import { SchoolPayDAO } from '@/lib/dao/schoolpay.dao';
import { schoolPayAdapter } from '@/lib/adapters/schoolpay.adapter';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ schoolCode: string }> }
) {
  try {
    const { schoolCode } = await context.params;
    if (!schoolCode) {
      return NextResponse.json({ error: 'Missing schoolCode' }, { status: 400 });
    }

    // 1. Resolve branch configuration by schoolCode
    const config = await SchoolPayConfigDAO.getInternalConfigBySchoolCode(schoolCode);
    if (!config) {
      return NextResponse.json(
        { error: 'Unauthorized or inactive SchoolPay gateway school code' },
        { status: 404 }
      );
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 });
    }

    // 2. Validate HMAC signature if secret is configured
    if (config.webhookSecret) {
      const headersMap: Record<string, string> = {};
      req.headers.forEach((val, key) => {
        headersMap[key.toLowerCase()] = val;
      });

      const isValidSignature = schoolPayAdapter.verifyWebhookSignature(
        headersMap,
        rawBody,
        config.webhookSecret
      );

      if (!isValidSignature) {
        return NextResponse.json(
          { error: 'Invalid HMAC signature or timestamp expired' },
          { status: 401 }
        );
      }
    }

    // 3. Parse inbound payload DTO
    let inboundDTO;
    try {
      inboundDTO = schoolPayAdapter.parseWebhookPayload(rawBody);
    } catch (parseErr: unknown) {
      const parseMessage = parseErr instanceof Error ? parseErr.message : 'Payload parsing error';
      return NextResponse.json(
        { error: parseMessage },
        { status: 400 }
      );
    }

    // 4. Stage transaction durably (Staging First Architecture)
    const { transaction, isReplay } = await SchoolPayDAO.stageInboundTransaction(
      config.branchId,
      inboundDTO
    );

    // 5. Process matching and posting if not a replay
    if (!isReplay) {
      // Execute matching & auto-post asynchronously/inline
      await SchoolPayDAO.matchAndProcessTransaction(
        config.branchId,
        transaction.id,
        'SYSTEM_WEBHOOK'
      );
    }

    return NextResponse.json(
      {
        status: isReplay ? 'ALREADY_PROCESSED' : 'SUCCESS',
        isReplay,
        transactionId: transaction.id,
        schoolPayReceiptNo: transaction.schoolPayReceiptNo
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error processing webhook';
    console.error('SchoolPay webhook ingestion failed:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
