import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, getErrorMessage } from './api';

describe('api utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getErrorMessage', () => {
    it('should return default message for null error', () => {
      const result = getErrorMessage(null);
      expect(result.message).toBe('An unexpected error occurred.');
      expect(result.fix).toBeNull();
      expect(result.code).toBeNull();
    });

    it('should return default message for undefined error', () => {
      const result = getErrorMessage(undefined);
      expect(result.message).toBe('An unexpected error occurred.');
      expect(result.fix).toBeNull();
      expect(result.code).toBeNull();
    });

    it('should return default message for falsy error', () => {
      const result = getErrorMessage(0);
      expect(result.message).toBe('An unexpected error occurred.');
    });

    it('should extract message from Error object', () => {
      const error = new Error('Test error message');
      const result = getErrorMessage(error);
      expect(result.message).toBe('Test error message');
    });

    it('should extract fix from Error object', () => {
      const error = new Error('Test error');
      error.fix = 'Try restarting the application';
      const result = getErrorMessage(error);
      expect(result.fix).toBe('Try restarting the application');
    });

    it('should extract code from Error object', () => {
      const error = new Error('Test error');
      error.code = 'AUTH_FAILED';
      const result = getErrorMessage(error);
      expect(result.code).toBe('AUTH_FAILED');
    });

    it('should handle error with message and fix properties', () => {
      const error = {
        message: 'Custom error',
        fix: 'Fix suggestion',
        code: 'ERR_001',
      };
      const result = getErrorMessage(error);
      expect(result.message).toBe('Custom error');
      expect(result.fix).toBe('Fix suggestion');
      expect(result.code).toBe('ERR_001');
    });

    it('should handle error with only message', () => {
      const error = { message: 'Simple error' };
      const result = getErrorMessage(error);
      expect(result.message).toBe('Simple error');
      expect(result.fix).toBeNull();
      expect(result.code).toBeNull();
    });

    it('should handle error without message property', () => {
      const error = { code: 'ERR_002' };
      const result = getErrorMessage(error);
      expect(result.message).toBe('An unexpected error occurred.');
      expect(result.code).toBe('ERR_002');
    });

    it('should return default for empty object', () => {
      const result = getErrorMessage({});
      expect(result.message).toBe('An unexpected error occurred.');
      expect(result.fix).toBeNull();
      expect(result.code).toBeNull();
    });

    it('should preserve all properties from complex error', () => {
      const error = new Error('Network error');
      error.status = 500;
      error.code = 'NETWORK_ERROR';
      error.fix = 'Check your internet connection';
      error.data = { url: '/api/test' };

      const result = getErrorMessage(error);
      expect(result.message).toBe('Network error');
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.fix).toBe('Check your internet connection');
    });
  });

  describe('api helper endpoints', () => {
    it('should call disconnect endpoint for disconnectQBO', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await api.disconnectQBO();

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/disconnect',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should call company info endpoint', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ CompanyInfo: { CompanyName: 'ATD' } }),
      });

      await api.getQboCompanyInfo();

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/qbo/company-info',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should send test payload for testAiConnection', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await api.testAiConnection('claude-only');

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            message: 'Health check: respond with OK.',
            context: { test: true, provider: 'claude-only' },
          }),
        })
      );
    });
  });
});
