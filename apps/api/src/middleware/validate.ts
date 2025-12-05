import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema, ZodError } from 'zod';
import { createChildLogger } from '../lib/logger.js';

const logger = createChildLogger('validate');

export class ValidationError extends Error {
  public statusCode = 400;
  public errors: z.ZodIssue[];

  constructor(errors: z.ZodIssue[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export const validate = <T extends ZodSchema>(schema: T) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = schema.safeParse({
        body: request.body,
        query: request.query,
        params: request.params,
      });

      if (!result.success) {
        logger.warn(
          { errors: result.error.errors, path: request.url },
          'Validation failed'
        );
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: result.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw error;
    }
  };
};

// Common validation schemas
export const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address');

export const createValidationPreHandler = <T extends ZodSchema>(schema: T) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = schema.parse({
        body: request.body,
        query: request.query,
        params: request.params,
      });

      // Merge validated data back to request
      if (validated.body) request.body = validated.body;
      if (validated.query) request.query = validated.query;
      if (validated.params) request.params = validated.params;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw error;
    }
  };
};
