import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const conversions = pgTable('conversions', {
  id: text('id').primaryKey(),
  youtubeUrl: text('youtube_url').notNull(),
  videoId: text('video_id').notNull(),
  title: text('title'),
  author: text('author'),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'),
  quality: text('quality').notNull().default('192'),
  status: text('status').notNull().default('pending'),
  fileUrl: text('file_url'),
  fileKey: text('file_key'),
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})

export type Conversion = typeof conversions.$inferSelect
export type NewConversion = typeof conversions.$inferInsert
