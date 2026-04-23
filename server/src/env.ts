import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3334),
  DATABASE_URL: z.string().url(),
  STORAGE_MODE: z.enum(['local', 'r2']).default('local'),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_BUCKET: z.string().default('tubely'),
  CLOUDFLARE_PUBLIC_URL: z.string().optional(),
})

export const env = envSchema.parse(process.env)
