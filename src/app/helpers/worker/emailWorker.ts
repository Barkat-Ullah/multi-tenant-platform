import { Job, Worker } from "bullmq";
import { createWorker } from "./workerFactory";
import emailSender from "../../utils/sendMail";

export const emailWorker: Worker = createWorker(
  "mail-queue",
  async (job: Job) => {
    const { type } = job.data;

    if (
      type === "otp-email" ||
      type === "welcome-email" ||
      type === "password-changed" ||
      type === "bulk-email"
    ) {
      const { to, html, subject } = job.data;
      await emailSender(to, html, subject);
      console.log(`✅ ${type} email sent to ${to}`);
      return { success: true, type, identifier: to };
    }

    // Support for jobs without type (legacy/backward compatible)
    const { to, html, subject } = job.data;
    if (to && html && subject) {
      await emailSender(to, html, subject);
      console.log(`✅ Email sent to ${to}`);
      return { success: true, type: "generic-email", identifier: to };
    }

    console.warn(`⚠️ Email job ${job.id} has unknown format:`, job.data);
    return { success: false, type: "unknown" };
  }
);
