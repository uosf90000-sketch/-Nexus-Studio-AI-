import { PrismaClient } from '@prisma/client'

// NEXUS-P1-002: Single Prisma instance for the app
// Prevents multiple instances in development

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
