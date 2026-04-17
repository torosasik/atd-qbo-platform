import { describe, it, expect, beforeEach } from 'vitest';
import { getCached, setCache, invalidate, invalidateAll } from './dataCache';

// jsdom provides localStorage; reset before each test.
beforeEach(() => {
  localStorage.clear();
});

describe('dataCache', () => {
  it('round-trips data via setCache/getCached', () => {
    setCache('k1', { hello: 'world' });
    expect(getCached('k1')).toEqual({ hello: 'world' });
  });

  it('returns null for missing keys', () => {
    expect(getCached('nope')).toBeNull();
  });

  it('expires entries past TTL', () => {
    setCache('k2', 'value', -1); // immediately expired
    expect(getCached('k2')).toBeNull();
  });

  it('invalidate removes a single key', () => {
    setCache('k3', 1);
    setCache('k4', 2);
    invalidate('k3');
    expect(getCached('k3')).toBeNull();
    expect(getCached('k4')).toBe(2);
  });

  it('invalidateAll clears all prefixed keys', () => {
    setCache('a', 1);
    setCache('b', 2);
    localStorage.setItem('other_key', 'keep');
    invalidateAll();
    expect(getCached('a')).toBeNull();
    expect(getCached('b')).toBeNull();
    expect(localStorage.getItem('other_key')).toBe('keep');
  });
});
