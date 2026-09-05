import { NextResponse } from "next/server";
import { NotificationRunner } from "@/lib/services/notification/notification-runner";

export async function POST(req: Request) {
  try {
    let batchSize = 25;
    try {
      const body = await req.json();
      if (body.batchSize) batchSize = Number(body.batchSize);
    } catch {
      // Body may be empty on cron/GET-like POST triggers
    }

    const runner = new NotificationRunner();
    const result = await runner.processBatch(batchSize);

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : undefined) || "Failed to process outbox" }, { status: 500 });
  }
}
