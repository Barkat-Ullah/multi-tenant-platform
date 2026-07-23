import { PrismaClient } from '@prisma/client';

// Single PrismaClient instance — no omit clauses.
// All queries that need sensitive fields (password, otp) must use explicit `select`.
// This eliminates the duplicate connection pool and memory overhead of two clients.
const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['error', 'warn']
    : ['error'],
});

export const prisma = prismaClient;

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Prisma disconnected due to application termination (SIGINT).');
  process.exit(0);
});

export default prisma;
