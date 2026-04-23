import { api } from './api'
import type { Conversion } from '../types/conversion'

export async function fetchConversions(): Promise<Conversion[]> {
  const { data } = await api.get<{ conversions: Conversion[] }>('/conversions')
  return data.conversions
}

export async function fetchConversion(id: string): Promise<Conversion> {
  const { data } = await api.get<Conversion>(`/conversions/${id}`)
  return data
}

export async function createConversion(youtubeUrl: string, quality = '192'): Promise<Conversion> {
  const { data } = await api.post<Conversion>('/conversions', { youtubeUrl, quality })
  return data
}

export async function deleteConversion(id: string): Promise<void> {
  await api.delete(`/conversions/${id}`)
}
