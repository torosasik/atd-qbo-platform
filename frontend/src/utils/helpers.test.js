import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateId,
  formatCurrency,
  formatDateTime,
  isToday,
  getTodayDate,
  debounce,
} from './helpers';

describe('helpers', () => {
  describe('generateId', () => {
    it('should generate a string ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate valid UUID format when crypto.randomUUID is available', () => {
      // crypto.randomUUID exists in modern browsers and Node.js 16.7+
      const id = generateId();
      // UUID format: 8-4-4-4-12 (36 chars including hyphens)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate non-empty string IDs', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format a number as USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format a string number', () => {
      expect(formatCurrency('1234.56')).toBe('$1,234.56');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle null/undefined as zero', () => {
      expect(formatCurrency(null)).toBe('$0.00');
      expect(formatCurrency(undefined)).toBe('$0.00');
    });

    it('should handle NaN as zero', () => {
      expect(formatCurrency(NaN)).toBe('$0.00');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-100)).toBe('-$100.00');
    });

    it('should round to two decimal places', () => {
      expect(formatCurrency(10.999)).toBe('$11.00');
    });
  });

  describe('formatDateTime', () => {
    it('should format a valid timestamp', () => {
      const date = new Date('2024-03-15T14:30:00');
      const result = formatDateTime(date.getTime());
      expect(result).toMatch(/Mar/);
      expect(result).toMatch(/15/);
    });

    it('should format a Date object', () => {
      const date = new Date('2024-03-15T14:30:00');
      const result = formatDateTime(date);
      expect(result).toMatch(/Mar/);
      expect(result).toMatch(/15/);
    });

    it('should format an ISO string', () => {
      const result = formatDateTime('2024-03-15T14:30:00');
      expect(result).toMatch(/Mar/);
      expect(result).toMatch(/15/);
    });

    it('should return dash for null', () => {
      expect(formatDateTime(null)).toBe('-');
    });

    it('should return dash for undefined', () => {
      expect(formatDateTime(undefined)).toBe('-');
    });

    it('should return dash for empty string', () => {
      expect(formatDateTime('')).toBe('-');
    });

    it('should return "Invalid Date" for invalid date string', () => {
      // When Date constructor receives 'invalid-date', it creates an Invalid Date
      // and toLocaleString returns 'Invalid Date'
      expect(formatDateTime('invalid-date')).toBe('Invalid Date');
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      const now = new Date();
      expect(isToday(now)).toBe(true);
    });

    it('should return true for today timestamp', () => {
      const now = new Date();
      expect(isToday(now.getTime())).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isToday(tomorrow)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isToday(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isToday(undefined)).toBe(false);
    });

    it('should return false for invalid date', () => {
      expect(isToday('invalid')).toBe(false);
    });
  });

  describe('getTodayDate', () => {
    it('should return a date string in YYYY-MM-DD format', () => {
      const result = getTodayDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return today\'s date', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(getTodayDate()).toBe(today);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay the function call', () => {
      const func = vi.fn();
      const debouncedFn = debounce(func, 100);

      debouncedFn();
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should only call function once for multiple rapid calls', () => {
      const func = vi.fn();
      const debouncedFn = debounce(func, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the debounced function', () => {
      const func = vi.fn();
      const debouncedFn = debounce(func, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should reset the timer on each call', () => {
      const func = vi.fn();
      const debouncedFn = debounce(func, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn();
      vi.advanceTimersByTime(50);
      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(func).toHaveBeenCalledTimes(1);
    });
  });
});
