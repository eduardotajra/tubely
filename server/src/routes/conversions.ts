import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  createConversion,
  listConversions,
  getConversion,
  deleteConversion,
  QUALITY_OPTIONS,
} from '../services/conversions'
import { HttpError } from '../utils/errors'

export const conversionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/conversions',
    {
      schema: {
        body: z.object({
          youtubeUrl: z.string().url('URL inválida'),
          quality: z.enum(QUALITY_OPTIONS).default('192'),
        }),
        response: {
          201: z.object({
            id: z.string(),
            youtubeUrl: z.string(),
            videoId: z.string(),
            status: z.string(),
            createdAt: z.date(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { youtubeUrl, quality } = request.body
      const conversion = await createConversion(youtubeUrl, quality)
      return reply.status(201).send(conversion)
    },
  )

  app.get(
    '/conversions',
    {
      schema: {
        response: {
          200: z.object({
            conversions: z.array(
              z.object({
                id: z.string(),
                youtubeUrl: z.string(),
                videoId: z.string(),
                title: z.string().nullable(),
                author: z.string().nullable(),
                thumbnailUrl: z.string().nullable(),
                duration: z.number().nullable(),
                quality: z.string(),
                status: z.string(),
                fileUrl: z.string().nullable(),
                errorMsg: z.string().nullable(),
                createdAt: z.date(),
                expiresAt: z.date().nullable(),
              }),
            ),
          }),
        },
      },
    },
    async () => {
      const list = await listConversions()
      return { conversions: list }
    },
  )

  app.get(
    '/conversions/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
      },
    },
    async (request) => {
      return getConversion(request.params.id)
    },
  )

  app.delete(
    '/conversions/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: { 204: z.void() },
      },
    },
    async (request, reply) => {
      await deleteConversion(request.params.id)
      return reply.status(204).send()
    },
  )
}
