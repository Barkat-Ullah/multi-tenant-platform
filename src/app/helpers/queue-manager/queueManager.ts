
import redis from "../../../lib/redis";
import { cleanQueue } from "../cleanQueue/cleanOtpQueue";
import { mailQueue } from "../queue";
import { emailWorker } from "../worker/emailWorker";

let cleanerInterval: NodeJS.Timeout | null = null;

export const initializeQueueSystem = () => {

  if (cleanerInterval) clearInterval(cleanerInterval);

  (async function startMailCleaner() {
    try {
      await cleanQueue(mailQueue);
      console.log("✅ queue cleaned (startup)");
    } catch (err) {
      console.error("❌ queue cleaner (startup) failed:", err);
    }

    const MINUTES = 10 * 60 * 1000; // 10 minutes
    cleanerInterval = setInterval(async () => {
      try {
        await cleanQueue(mailQueue);
        console.log("✅ queue cleaned (scheduled)");
      } catch (err) {
        console.error("❌ queue cleaner (scheduled) error:", err);
      }
    }, MINUTES);
  })();

  return {
    emailWorker,
  };
};

export const getQueueStatus = async () => {
  try {
    const mailStats = await mailQueue.getJobCounts();

    return {
      mailQueue: mailStats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Failed to get queue status:", error);
    throw error;
  }
};


export const setupGracefulShutdown = () => {
  const shutdown = async (signal: any) => {
    console.log(`🚨 Received ${signal}. Shutting down gracefully...`);

    if (cleanerInterval) clearInterval(cleanerInterval);

    try {

      await Promise.all([
        mailQueue.close(),
        // notificationQueue.close(),
      ]);
      console.log("✅ All queues closed successfully.");
      
      await redis.quit();
      console.log("✅ Redis connection closed gracefully.");
      
    } catch (err: any) {
      console.error(`❌ Error during graceful shutdown: ${err.message}`);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};