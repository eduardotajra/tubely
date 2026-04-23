export type ConversionStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type AudioQuality = '128' | '192' | '256' | '320'

export interface Conversion {
  id: string
  youtubeUrl: string
  videoId: string
  title: string | null
  author: string | null
  thumbnailUrl: string | null
  duration: number | null
  quality: AudioQuality
  status: ConversionStatus
  fileUrl: string | null
  errorMsg: string | null
  createdAt: string
  expiresAt: string | null
}
