import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';

const FUSE_CONFIG = {
  threshold: 0.4,
  distance: 100,
  minMatchCharLength: 2,
  keys: ['productName', 'sku', 'orderNumber', 'vendorName'],
};

export default function FuzzySearch({ items, totalCount, onResultsChange }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fuse = useMemo(() => new Fuse(items, FUSE_CONFIG), [items]);

  const searchState = useMemo(() => {
    if (!debouncedQuery) {
      return {
        indexes: null,
        resultCount: items.length,
        hasClosestMatches: false,
        hasNoResults: false,
        query: '',
      };
    }

    const tokens = debouncedQuery
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return {
        indexes: null,
        resultCount: items.length,
        hasClosestMatches: false,
        hasNoResults: false,
        query: '',
      };
    }

    const matchMap = new Map();

    tokens.forEach((token) => {
      const tokenResults = fuse.search(token);
      tokenResults.forEach((result) => {
        const existing = matchMap.get(result.refIndex);
        const score = result.score ?? 1;

        if (existing) {
          existing.tokenMatches += 1;
          existing.scoreSum += score;
          existing.maxScore = Math.max(existing.maxScore, score);
        } else {
          matchMap.set(result.refIndex, {
            tokenMatches: 1,
            scoreSum: score,
            maxScore: score,
          });
        }
      });
    });

    const ranked = [...matchMap.entries()]
      .filter(([, value]) => value.tokenMatches === tokens.length)
      .map(([index, value]) => ({
        index,
        avgScore: value.scoreSum / value.tokenMatches,
        maxScore: value.maxScore,
      }))
      .sort((a, b) => a.avgScore - b.avgScore);

    const indexes = ranked.map((entry) => entry.index);
    const hasNoResults = indexes.length === 0;
    const hasClosestMatches = ranked.some((entry) => entry.maxScore > 0.3);

    return {
      indexes,
      resultCount: indexes.length,
      hasClosestMatches,
      hasNoResults,
      query: debouncedQuery,
    };
  }, [debouncedQuery, fuse, items.length]);

  useEffect(() => {
    onResultsChange(searchState);
  }, [onResultsChange, searchState]);

  return (
    <div className="w-full md:w-auto md:min-w-[360px] space-y-2">
      <div className="relative">
        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product, SKU, order #, vendor"
          className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-atd-blue/30 focus:border-atd-blue"
        />
      </div>

      <p className="text-xs text-gray-500">
        Showing {searchState.resultCount} of {totalCount} orders
      </p>

      {searchState.hasClosestMatches && !searchState.hasNoResults && (
        <div className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2">
          Showing closest matches. Verify these are correct.
        </div>
      )}

      {searchState.hasNoResults && searchState.query && (
        <p className="text-xs text-gray-500">No results for '{searchState.query}'.</p>
      )}
    </div>
  );
}
