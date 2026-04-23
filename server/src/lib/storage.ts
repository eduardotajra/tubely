import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'
import { env } from '../env'

function getR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID!,
      secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY!,
    },
  })
}

export async function uploadFile(
  filePath: string,
  key: string,
  contentType = 'audio/mpeg',
): Promise<string> {
  if (env.STORAGE_MODE === 'local') {
    const uploadsDir = path.resolve(env.LOCAL_STORAGE_PATH)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    const destPath = path.join(uploadsDir, key)
    fs.copyFileSync(filePath, destPath)
    return `/uploads/${key}`
  }

  const s3 = getR2Client()
  const fileBuffer = fs.readFileSync(filePath)

  await s3.send(
    new PutObjectCommand({
      Bucket: env.CLOUDFLARE_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  )

  return `${env.CLOUDFLARE_PUBLIC_URL}/${key}`
}

export async function deleteFile(key: string): Promise<void> {
  if (env.STORAGE_MODE === 'local') {
    const filePath = path.join(path.resolve(env.LOCAL_STORAGE_PATH), key)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return
  }

  const s3 = getR2Client()
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.CLOUDFLARE_BUCKET,
      Key: key,
    }),
  )
}
