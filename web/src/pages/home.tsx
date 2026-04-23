import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MusicNote, YoutubeLogo, ArrowRight } from 'phosphor-react'
import { useConversions, useCreateConversion, useDeleteConversion } from '../hooks/use-conversions'
import { ConversionCard } from '../components/conversion-card'
import { Button } from '../components/button'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3334'

const QUALITY_OPTIONS = [
  { value: '128', label: '128 kbps', description: 'Menor tamanho' },
  { value: '192', label: '192 kbps', description: 'Padrão' },
  { value: '256', label: '256 kbps', description: 'Alta qualidade' },
  { value: '320', label: '320 kbps', description: 'Máxima qualidade' },
] as const

const schema = z.object({
  youtubeUrl: z
    .string()
    .min(1, 'Informe o link do YouTube')
    .url('URL inválida')
    .refine(
      (url) => url.includes('youtube.com') || url.includes('youtu.be'),
      'Deve ser um link do YouTube',
    ),
  quality: z.enum(['128', '192', '256', '320']).default('192'),
})

type FormData = z.infer<typeof schema>

export function HomePage() {
  const { data: conversions, isLoading } = useConversions()
  const { mutate: create, isPending: creating } = useCreateConversion()
  const { mutate: remove, isPending: deleting, variables: deletingId } = useDeleteConversion()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quality: '192' },
  })

  const selectedQuality = watch('quality')

  function onSubmit(data: FormData) {
    create({ youtubeUrl: data.youtubeUrl, quality: data.quality }, { onSuccess: () => reset({ quality: selectedQuality }) })
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0f0f0f]/90 backdrop-blur-lg">
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600">
            <MusicNote size={14} weight="fill" />
          </div>
          <span className="font-bold text-base tracking-tight">Tubely</span>
          <span className="ml-auto text-[11px] text-white/30 font-medium">YouTube → MP3</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6">
        {/* Hero */}
        <div className="pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1 text-[11px] text-white/50 mb-8 font-medium">
            <YoutubeLogo size={13} weight="fill" className="text-red-500" />
            Conversor gratuito · Até 320kbps
          </div>
          <h1 className="text-[2.6rem] font-bold leading-[1.15] tracking-tight mb-4">
            Converta YouTube<br />
            <span className="text-red-500">em MP3</span>
          </h1>
          <p className="text-white/40 text-[15px] max-w-xs mx-auto leading-relaxed">
            Cole o link, escolha a qualidade e baixe o áudio. Sem cadastro.
          </p>
        </div>

        {/* Form */}
        <div className="mb-20">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* URL input */}
            <div>
              <div className="relative">
                <YoutubeLogo
                  size={18}
                  weight="fill"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
                />
                <input
                  {...register('youtubeUrl')}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.06] pl-10 pr-4 py-3.5 text-sm text-white placeholder-white/25 transition-all focus:border-red-500/40 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-red-500/15"
                />
              </div>
              {errors.youtubeUrl && (
                <p className="mt-2 text-xs text-red-400 pl-1">{errors.youtubeUrl.message}</p>
              )}
            </div>

            {/* Quality selector */}
            <div>
              <p className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-2.5">
                Qualidade do áudio
              </p>
              <div className="grid grid-cols-4 gap-2">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setValue('quality', opt.value)}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border py-3 px-2 text-center transition-all ${
                      selectedQuality === opt.value
                        ? 'border-red-500/50 bg-red-500/10 text-white'
                        : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:border-white/15 hover:text-white/60'
                    }`}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[10px] opacity-60">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" loading={creating} className="w-full">
              Converter para MP3
              {!creating && <ArrowRight size={15} weight="bold" />}
            </Button>
          </form>
        </div>

        {/* Conversions */}
        <section className="pb-20">
          {conversions && conversions.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">
                Conversões
              </span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] text-white/20">{conversions.length}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            </div>
          ) : !conversions || conversions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                <MusicNote size={24} className="text-white/15" />
              </div>
              <div className="text-center">
                <p className="text-sm text-white/30 font-medium">Nenhuma conversão ainda</p>
                <p className="text-xs text-white/15 mt-1">Cole um link acima para começar</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {conversions.map((conversion) => (
                <ConversionCard
                  key={conversion.id}
                  conversion={conversion}
                  onDelete={(id) => remove(id)}
                  deleting={deleting && deletingId === conversion.id}
                  apiUrl={API_URL}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/[0.04] py-8 text-center text-[11px] text-white/15">
        Arquivos disponíveis por 24h · Apenas para uso pessoal
      </footer>
    </div>
  )
}
