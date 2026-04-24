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

  app.get('/debug/download/:videoId', async (req, reply) => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)
    const os = await import('node:os')
    const fsd = await import('node:fs')
    const pathd = await import('node:path')
    const { videoId } = req.params as { videoId: string }

    const ytdlpBin = process.platform !== 'win32' ? '/usr/local/bin/yt-dlp' : 'yt-dlp'
    const url = `https://www.youtube.com/watch?v=${videoId}`

    const cookiesB64 = process.env.YOUTUBE_COOKIES_B64
    let cookiesPath: string | null = null
    if (cookiesB64) {
      cookiesPath = pathd.join(os.tmpdir(), 'debug-cookies.txt')
      fsd.writeFileSync(cookiesPath, Buffer.from(cookiesB64, 'base64').toString('utf8').replace(/\r\n/g, '\n'))
    }

    const testArgs = ['--format', '18', '--output', pathd.join(os.tmpdir(), `debug-${videoId}.mp4`), '--no-warnings', '--impersonate', 'chrome', url]
    if (cookiesPath) testArgs.push('--cookies', cookiesPath)

    try {
      const { stderr } = await execFileAsync(ytdlpBin, testArgs, { timeout: 60000 })
      const outFile = pathd.join(os.tmpdir(), `debug-${videoId}.mp4`)
      const exists = fsd.existsSync(outFile)
      if (exists) fsd.unlinkSync(outFile)
      return reply.send({ status: 'OK', stderr: stderr.slice(0, 500) })
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message?: string }
      return reply.send({ status: 'FAIL', error: (err.stderr ?? err.message ?? String(e)).slice(0, 1000) })
    }
  })

  app.get('/debug/ytdlp', async (_req, reply) => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)
    const os = await import('node:os')
    const fsd = await import('node:fs')
    const pathd = await import('node:path')

    const ytdlpBin = process.platform !== 'win32' ? '/usr/local/bin/yt-dlp' : 'yt-dlp'
    const args = ['--version']

    // Write cookies if available
    const cookiesB64 = process.env.YOUTUBE_COOKIES_B64
    let cookiesPath: string | null = null
    if (cookiesB64) {
      cookiesPath = pathd.join(os.tmpdir(), 'debug-cookies.txt')
      fsd.writeFileSync(cookiesPath, Buffer.from(cookiesB64, 'base64').toString('utf8').replace(/\r\n/g, '\n'))
    }

    const testArgs = ['--dump-single-json', '--no-warnings', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']
    if (cookiesPath) testArgs.push('--cookies', cookiesPath)

    try {
      const [versionResult, testResult] = await Promise.allSettled([
        execFileAsync(ytdlpBin, args, { timeout: 5000 }),
        execFileAsync(ytdlpBin, testArgs, { timeout: 30000 }),
      ])

      const version = versionResult.status === 'fulfilled' ? versionResult.value.stdout.trim() : String((versionResult as PromiseRejectedResult).reason)
      let testStatus: string
      if (testResult.status === 'fulfilled') {
        const parsed = JSON.parse(testResult.value.stdout)
        testStatus = `OK: title="${parsed.title}"`
      } else {
        const err = (testResult as PromiseRejectedResult).reason as NodeJS.ErrnoException & { stderr?: string; stdout?: string }
        testStatus = `FAIL: ${err.stderr ?? err.message ?? String(err)}`
      }

      return reply.send({ ytdlp_version: version, cookies_set: !!cookiesPath, test: testStatus })
    } catch (e) {
      return reply.status(500).send({ error: String(e) })
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
