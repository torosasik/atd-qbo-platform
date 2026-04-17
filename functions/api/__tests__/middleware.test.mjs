// ESM test (.mjs) so vitest 2.x's import works. The source module is CJS,
// so we pull it in via createRequire.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import Joi from 'joi';

const require = createRequire(import.meta.url);
const middleware = require('../middleware');

describe('middleware.validateRequest', () => {
  const schema = Joi.object({ name: Joi.string().required() });

  it('calls next() with no args on valid body', () => {
    const req = { body: { name: 'ok' } };
    const next = vi.fn();
    middleware.validateRequest(schema)(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('calls next(err) with 400 VALIDATION_ERROR on invalid body', () => {
    const next = vi.fn();
    middleware.validateRequest(schema)({ body: {} }, {}, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.status).toBe(400);
  });
});

describe('middleware.sendError / sendSuccess', () => {
  const mockRes = () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('sendError returns status + success:false shape', () => {
    const res = mockRes();
    middleware.sendError(res, new Error('boom'), 500, 'X');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'boom', code: 'X' });
  });

  it('sendSuccess returns 200 with data + message', () => {
    const res = mockRes();
    middleware.sendSuccess(res, { a: 1 }, 'ok');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { a: 1 }, message: 'ok' });
  });
});

describe('middleware.retryOperation', () => {
  it('resolves on first success', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    const result = await middleware.retryOperation(op, 3, 1);
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    let n = 0;
    const op = vi.fn().mockImplementation(() => {
      n += 1;
      if (n < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('done');
    });
    const result = await middleware.retryOperation(op, 3, 1);
    expect(result).toBe('done');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('throws last error after max retries', async () => {
    const op = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(middleware.retryOperation(op, 2, 1)).rejects.toThrow('nope');
    expect(op).toHaveBeenCalledTimes(2);
  });
});
