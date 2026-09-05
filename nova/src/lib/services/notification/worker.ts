import { NotificationRunner } from "./notification-runner";

async function runWorker() {
  const isOnce = process.argv.includes("--once");
  const pollIntervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 3000);
  const runner = new NotificationRunner();

  console.log(`[NotificationWorker] Starting outbox runner (mode: ${isOnce ? "run-once" : "daemon"})...`);

  let isRunning = true;

  const shutdown = () => {
    console.log("[NotificationWorker] Gracefully shutting down worker...");
    isRunning = false;
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    do {
      try {
        const result = await runner.processBatch();
        if (result.claimedCount > 0) {
          console.log(
            `[NotificationWorker] Processed batch: claimed=${result.claimedCount}, sent=${result.sentCount}, retried=${result.retriedCount}, failed=${result.failedCount}, cancelled=${result.cancelledCount}`
          );
        }
      } catch (err: unknown) {
        console.error("[NotificationWorker] Error processing outbox batch:", err instanceof Error ? err.message : String(err));
      }

      if (isOnce) break;
      if (!isRunning) break;

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } while (isRunning);

    console.log("[NotificationWorker] Worker stopped.");
  } catch (err: unknown) {
    console.error("[NotificationWorker] Fatal error in worker:", err);
    process.exit(1);
  }
}

if (require.main === module || !process.env.VITEST) {
  runWorker().catch((err) => {
    console.error("[NotificationWorker] Startup error:", err);
    process.exit(1);
  });
}

export { runWorker };
