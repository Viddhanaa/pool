import request from 'supertest';
import { describe, expect, test } from 'vitest';
import express from 'express';
import { errorHandler } from './errorHandler';

class CustomError extends Error {
  status = 418;
}

describe('errorHandler', () => {
  test('formats errors with status and message', async () => {
    const app = express();
    app.get('/', () => {
      throw new CustomError('teapot');
    });
    app.use(errorHandler);
    const res = await request(app).get('/');
    expect(res.status).toBe(418);
    expect(res.body.error).toBe('teapot');
    expect(res.body.correlationId).toBeDefined();
  });
});
