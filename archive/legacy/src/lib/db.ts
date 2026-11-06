import { PrismaClient } from '@prisma/client'
import path from 'node:path'

// Keep relative SQLite URLs stable in both the source app and the standalone bundle.
const configuredUrl = process.env.DATABASE_URL
const datasourceUrl = configuredUrl?.startsWith('file:') && !path.isAbsolute(configuredUrl.slice(5))
  ? `file:${path.resolve(process.cwd(), 'prisma', configuredUrl.slice(5)).replaceAll('\\', '/')}`
  : configuredUrl

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
