import { eq } from 'drizzle-orm'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import youtubeDlDefault, { create as createYoutubeDl } from 'youtube-dl-exec'

// On Linux (Docker) use system yt-dlp; on Windows use the bundled binary from npm
const youtubeDl = process.platform !== 'win32'
  ? createYoutubeDl('/usr/local/bin/yt-dlp')
  : youtubeDlDefault
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { db } from '../db'
import { conversions } from '../db/schema'
import { uploadFile, deleteFile } from '../lib/storage'
import { NotFoundError, BadRequestError } from '../utils/errors'

// On Linux (Docker/Railway) use system ffmpeg; on Windows use bundled ffmpeg-static
const ffmpegPath = process.platform === 'win32' ? ffmpegStatic : 'ffmpeg'
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)

export const QUALITY_OPTIONS = ['128', '192', '256', '320'] as const
export type AudioQuality = (typeof QUALITY_OPTIONS)[number]

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1)
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v')
    }
  } catch {}
  return null
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_. ]/g, '_').trim().slice(0, 80)
}

export async function createConversion(youtubeUrl: string, quality: AudioQuality = '192') {
  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) throw new BadRequestError('URL do YouTube inválida. Use o formato: https://www.youtube.com/watch?v=...')

  const id = uuidv4()

  const [conversion] = await db
    .insert(conversions)
    .values({ id, youtubeUrl, videoId, quality, status: 'pending' })
    .returning()

  processConversion(conversion.id, youtubeUrl, quality).catch((err) => {
    console.error('[conversion] Fatal error:', err)
  })

  return conversion
}

function writeCookiesFile(): string | null {
  const cookiesB64 = process.env.YOUTUBE_COOKIES_B64
  if (!cookiesB64) return null
  const cookiesPath = path.join(os.tmpdir(), 'yt-cookies.txt')
  fs.writeFileSync(cookiesPath, Buffer.from(cookiesB64, 'base64').toString('utf8'))
  return cookiesPath
}

async function processConversion(id: string, youtubeUrl: string, quality: AudioQuality) {
  const tmpDir = os.tmpdir()
  const tmpAudio = path.join(tmpDir, `tubely-${id}.%(ext)s`)
  const tmpMp3 = path.join(tmpDir, `tubely-${id}.mp3`)
  const cookiesFile = writeCookiesFile()

  try {
    await db.update(conversions).set({ status: 'processing' }).where(eq(conversions.id, id))

    const info = await youtubeDl(youtubeUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      ...(cookiesFile ? { cookies: cookiesFile } : {}),
    }) as { title: string; uploader: string; thumbnail: string; duration: number }

    const title = sanitizeFilename(info.title ?? 'Unknown')
    const author = info.uploader ?? 'Unknown'
    const thumbnail = info.thumbnail ?? null
    const duration = info.duration ?? null

    await db
      .update(conversions)
      .set({ title, author, thumbnailUrl: thumbnail, duration })
      .where(eq(conversions.id, id))

    await youtubeDl(youtubeUrl, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: `${quality}K`,
      output: tmpAudio,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpegPath ?? undefined,
      ...(cookiesFile ? { cookies: cookiesFile } : {}),
    })

    let sourceFile: string | null = null
    for (const ext of ['mp3', 'webm', 'm4a', 'opus']) {
      const candidate = path.join(tmpDir, `tubely-${id}.${ext}`)
      if (fs.existsSync(candidate)) { sourceFile = candidate; break }
    }

    if (!sourceFile) throw new Error('Arquivo de áudio não encontrado após download')

    let finalFile = sourceFile
    if (!sourceFile.endsWith('.mp3')) {
      await convertToMp3(sourceFile, tmpMp3, Number(quality))
      fs.unlinkSync(sourceFile)
      finalFile = tmpMp3
    }

    const fileKey = `${id}-${title}-${quality}kbps.mp3`
    const fileUrl = await uploadFile(finalFile, fileKey)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await db
      .update(conversions)
      .set({ status: 'completed', fileUrl, fileKey, expiresAt })
      .where(eq(conversions.id, id))
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error(`[conversion ${id}] failed:`, errorMsg)
    await db
      .update(conversions)
      .set({ status: 'failed', errorMsg })
      .where(eq(conversions.id, id))
  } finally {
    if (fs.existsSync(tmpMp3)) fs.unlinkSync(tmpMp3)
  }
}

function convertToMp3(inputPath: string, outputPath: string, bitrate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate(bitrate)
      .format('mp3')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath)
  })
}

export async function listConversions() {
  return db.query.conversions.findMany({
    orderBy: (c, { desc }) => [desc(c.createdAt)],
  })
}

export async function getConversion(id: string) {
  const conversion = await db.query.conversions.findFirst({
    where: eq(conversions.id, id),
  })
  if (!conversion) throw new NotFoundError('Conversão não encontrada')
  return conversion
}

export async function deleteConversion(id: string) {
  const conversion = await getConversion(id)
  if (conversion.fileKey) await deleteFile(conversion.fileKey).catch(console.error)
  await db.delete(conversions).where(eq(conversions.id, id))
}
