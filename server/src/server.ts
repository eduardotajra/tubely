import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { ZodError } from 'zod'
import * as path from 'path'
import * as fs from 'fs'
import { env } from './env'
import { conversionRoutes } from './routes/conversions'
import { HttpError } from './utils/errors'

async function main() {
  const app = Fastify({ logger: true })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(cors, { origin: '*' })

  if (env.STORAGE_MODE === 'local') {
    const uploadsPath = path.resolve(env.LOCAL_STORAGE_PATH)
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true })
    }
    await app.register(fastifyStatic, {
      root: uploadsPath,
      prefix: '/uploads/',
    })
  }

  app.get('/health', async () => ({ status: 'ok' }))

  app.get('/debug/cookies', async () => {
    const val = process.env.YOUTUBE_COOKIES_B64 ?? ''
    return {
      set: val.length > 0,
      length: val.length,
      preview: val.slice(0, 40),
      valid_base64: (() => { try { Buffer.from(val, 'base64'); return true } catch { return false } })(),
    }
  })

  await app.register(conversionRoutes)

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({ message: error.message })
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: 'Validation error',
        issues: error.issues,
      })
    }

    app.log.error(error)
    return reply.status(500).send({ message: 'Internal server error' })
  })

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Tubely server running on port ${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
