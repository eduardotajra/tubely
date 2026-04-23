import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { env } from '../env'

async function runMigrations() {
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  const db = drizzle(pool)

  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './src/db/migrations' })
  console.log('Migrations complete.')

  await pool.end()
  process.exit(0)
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
