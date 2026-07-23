import { Queue, QueueOptions } from "bullmq";
import { bullMQRedisOptions } from "../../../lib/redis";

export const createQueue = (name: string, options?: QueueOptions) => {
  return new Queue(name, {
    connection: bullMQRedisOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 50,
      removeOnFail: 25,
    },
    ...options,
  });
};
