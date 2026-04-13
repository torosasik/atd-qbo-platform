import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';

const FUSE_CONFIG = {
  threshold: 0.32,
  distance: 120,
  minMatchCharLength: 1,
  ignoreLocation: true,
  keys: ['productName', 'itemName', 'sku', 'orderNumber', 'vendorName', 'lineItem'],
};

function normalize(value) {
  return String(value ?? '').toLowerCase().trim();
}

function includesAllTokens(item, tokens) {
  const haystack = normalize([
    item.productName,
    item.itemName,
    item.sku,
    item.orderNumber,
    item.vendorName,
    item.lineItem,
  ].join(' '));
  return tokens.every((token) => haystack.includes(token));
}

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

    const directIndexes = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => includesAllTokens(item, tokens))
      .map(({ index }) => index);

    const fuseResults = directIndexes.length === 0 ? fuse.search(debouncedQuery) : [];
    const fuseIndexes = fuseResults.map((entry) => entry.refIndex);
    const indexes = directIndexes.length > 0 ? directIndexes : fuseIndexes;
    const hasNoResults = indexes.length === 0;
    const hasClosestMatches = directIndexes.length === 0 && fuseResults.length > 0;

    return {
      indexes,
      resultCount: indexes.length,
      hasClosestMatches,
      hasNoResults,
      query: debouncedQuery,
    };
  }, [debouncedQuery, fuse, items]);

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
