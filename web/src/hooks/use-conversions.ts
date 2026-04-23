import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchConversions,
  createConversion,
  deleteConversion,
} from '../lib/conversions-api'
import type { Conversion } from '../types/conversion'

const ACTIVE_STATUSES = ['pending', 'processing']

export function useConversions() {
  return useQuery({
    queryKey: ['conversions'],
    queryFn: fetchConversions,
    refetchInterval: (query) => {
      const data = query.state.data as Conversion[] | undefined
      const hasActive = data?.some((c) => ACTIVE_STATUSES.includes(c.status))
      return hasActive ? 3000 : false
    },
  })
}

export function useCreateConversion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ youtubeUrl, quality }: { youtubeUrl: string; quality: string }) =>
      createConversion(youtubeUrl, quality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversions'] })
      toast.success('Conversão iniciada! Aguarde o processamento.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Erro ao iniciar conversão')
    },
  })
}

export function useDeleteConversion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteConversion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversions'] })
      toast.success('Conversão removida.')
    },
    onError: () => {
      toast.error('Erro ao remover conversão')
    },
  })
}
