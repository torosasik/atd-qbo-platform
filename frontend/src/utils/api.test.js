import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './api';

describe('api utilities', () => {
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
});
