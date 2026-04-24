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

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de',
  'https://iv.datura.network',
  'https://invidious.privacyredirect.com',
  'https://inv.riverside.rocks',
  'https://invidious.slipfox.xyz',
]

interface InvidiousFormat {
  type: string
  bitrate?: number
  url: string
}

interface InvidiousVideo {
  title: string
  author: string
  videoThumbnails: Array<{ quality: string; url: string }>
  lengthSeconds: number
  adaptiveFormats: InvidiousFormat[]
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

async function getInvidiousInfo(videoId: string): Promise<InvidiousVideo> {
  let lastErr: unknown
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${instance}/api/v1/videos/${videoId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) throw new Error(`Unexpected content-type: ${ct}`)
      return await res.json() as InvidiousVideo
    } catch (e) {
      console.log(`[invidious] ${instance} failed: ${e instanceof Error ? e.message : e}`)
      lastErr = e
    }
  }
  throw lastErr ?? new Error('All Invidious instances failed')
}

async function downloadViaInvidious(videoId: string, outputPath: string): Promise<{
  title: string; author: string; thumbnail: string | null; duration: number | null
}> {
  const data = await getInvidiousInfo(videoId)

  const audioFormats = (data.adaptiveFormats ?? [])
    .filter(f => f.type?.startsWith('audio/'))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))

  if (audioFormats.length === 0) throw new Error('Nenhum formato de áudio encontrado no Invidious')

  const audioUrl = audioFormats[0].url
  const res = await fetchWithTimeout(audioUrl, 120000)
  if (!res.ok) throw new Error(`Falha ao baixar áudio: HTTP ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(outputPath, buffer)

  const thumbnail = data.videoThumbnails?.find(t => t.quality === 'maxresdefault')?.url
    ?? data.videoThumbnails?.[0]?.url
    ?? null

  return {
    title: data.title ?? 'Unknown',
    author: data.author ?? 'Unknown',
    thumbnail,
    duration: data.lengthSeconds ?? null,
  }
}

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

  processConversion(conversion.id, youtubeUrl, videoId, quality).catch((err) => {
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

async function processConversion(id: string, youtubeUrl: string, videoId: string, quality: AudioQuality) {
  const tmpDir = os.tmpdir()
  const tmpAudio = path.join(tmpDir, `tubely-${id}.%(ext)s`)
  const tmpRaw = path.join(tmpDir, `tubely-${id}.raw`)
  const tmpMp3 = path.join(tmpDir, `tubely-${id}.mp3`)
  const cookiesFile = writeCookiesFile()

  try {
    await db.update(conversions).set({ status: 'processing' }).where(eq(conversions.id, id))

    let title = 'Unknown'
    let author = 'Unknown'
    let thumbnail: string | null = null
    let duration: number | null = null
    let sourceFile: string | null = null

    // --- Try yt-dlp first ---
    let ytdlFailed = false
    try {
      const nodeRuntime = process.platform !== 'win32' ? 'nodejs:/usr/local/bin/node' : 'nodejs'
      const info = await youtubeDl(youtubeUrl, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        // @ts-expect-error jsRuntimes/extractorArgs valid but missing from types
        jsRuntimes: nodeRuntime,
        ...(cookiesFile ? { cookies: cookiesFile } : {}),
      }) as { title: string; uploader: string; thumbnail: string; duration: number }

      title = sanitizeFilename(info.title ?? 'Unknown')
      author = info.uploader ?? 'Unknown'
      thumbnail = info.thumbnail ?? null
      duration = info.duration ?? null

      await db
        .update(conversions)
        .set({ title, author, thumbnailUrl: thumbnail, duration })
        .where(eq(conversions.id, id))

      await youtubeDl(youtubeUrl, {
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: Number(quality),
        output: tmpAudio,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        ffmpegLocation: ffmpegPath ?? undefined,
        // @ts-expect-error jsRuntimes valid but missing from types
        jsRuntimes: nodeRuntime,
        ...(cookiesFile ? { cookies: cookiesFile } : {}),
      })

      for (const ext of ['mp3', 'webm', 'm4a', 'opus']) {
        const candidate = path.join(tmpDir, `tubely-${id}.${ext}`)
        if (fs.existsSync(candidate)) { sourceFile = candidate; break }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Sign in to confirm') || msg.includes('bot')) {
        ytdlFailed = true
        console.log(`[conversion ${id}] yt-dlp bot check triggered, trying Invidious fallback`)
      } else {
        throw err
      }
    }

    // --- Invidious fallback ---
    if (ytdlFailed) {
      const invResult = await downloadViaInvidious(videoId, tmpRaw)
      title = sanitizeFilename(invResult.title)
      author = invResult.author
      thumbnail = invResult.thumbnail
      duration = invResult.duration
      sourceFile = tmpRaw

      await db
        .update(conversions)
        .set({ title, author, thumbnailUrl: thumbnail, duration })
        .where(eq(conversions.id, id))
    }

    if (!sourceFile || !fs.existsSync(sourceFile)) {
      throw new Error('Arquivo de áudio não encontrado após download')
    }

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
    for (const f of [tmpMp3, tmpRaw]) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
  }
}

function convertToMp3(inputPath: string, outputPath: string, bitrate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate(bitrate)
      .format('mp3')
      .on('end', () => resolve())
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
