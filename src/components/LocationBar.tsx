import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { LocateFixed, Moon, RefreshCw, Search, Sun, X } from 'lucide-react';
import type { AqiStandard, CityLocation } from '../types/airwise';

interface LocationBarProps {
  activeLocation: CityLocation;
  presetCities: CityLocation[];
  standard: AqiStandard;
  theme: 'light' | 'dark';
  loading: boolean;
  geoStatusMessage: string | null;
  onSelectLocation: (city: CityLocation) => void;
  onRequestGeolocation: () => void;
  onChangeStandard: (std: AqiStandard) => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
}

export function LocationBar({
  activeLocation,
  presetCities,
  standard,
  theme,
  loading,
  geoStatusMessage,
  onSelectLocation,
  onRequestGeolocation,
  onChangeStandard,
  onRefresh,
  onToggleTheme,
}: LocationBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityLocation[]>(presetCities);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(presetCities);
      setSearchError(null);
      setHighlightedIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/cities?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('City lookup failed');
        const data = (await res.json()) as { results: CityLocation[] };
        const nextResults = data.results ?? [];
        setResults(nextResults);
        setHighlightedIndex(nextResults.length > 0 ? 0 : -1);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setSearchError('Could not search global cities right now; showing curated cities.');
        const lower = trimmed.toLowerCase();
        const fallback = presetCities.filter(
          (c) =>
            c.name.toLowerCase().includes(lower) || c.country.toLowerCase().includes(lower),
        );
        setResults(fallback);
        setHighlightedIndex(fallback.length > 0 ? 0 : -1);
      } finally {
        setSearching(false);
      }
    }, 240);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, presetCities]);

  function selectCity(city: CityLocation) {
    onSelectLocation(city);
    setOpen(false);
    setQuery('');
    setHighlightedIndex(-1);
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      setHighlightedIndex(results.length > 0 ? 0 : -1);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (results.length === 0 ? -1 : (prev + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        results.length === 0 ? -1 : (prev - 1 + results.length) % results.length,
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && results[highlightedIndex]) {
      e.preventDefault();
      selectCity(results[highlightedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }

  const activeOptionId =
    open && highlightedIndex >= 0 && results[highlightedIndex]
      ? `city-option-${results[highlightedIndex].id}`
      : undefined;

  return (
    <section
      aria-label="Location and telemetry controls"
      className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Search Combobox + Geolocation */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div ref={containerRef} className="relative w-full sm:w-80">
            <label htmlFor="city-search-input" className="sr-only">
              Search city or urban area
            </label>
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="city-search-input"
                type="text"
                role="combobox"
                value={query}
                onFocus={() => setOpen(true)}
                onKeyDown={handleSearchKeyDown}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                placeholder={`Search city (current: ${activeLocation.name})`}
                aria-expanded={open}
                aria-controls="city-search-listbox"
                aria-autocomplete="list"
                aria-activedescendant={activeOptionId}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-500 focus:border-sky-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults(presetCities);
                    setHighlightedIndex(-1);
                  }}
                  aria-label="Clear city search"
                  className="absolute right-2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {open && (
              <div
                id="city-search-listbox"
                role="listbox"
                aria-label="Matching cities"
                className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {searching
                    ? 'Searching global cities…'
                    : query.trim()
                      ? `Search results (${results.length})`
                      : 'Major Global Reference Cities'}
                </div>
                {searchError && (
                  <p className="px-3 py-1 text-xs text-amber-700 dark:text-amber-300">
                    {searchError}
                  </p>
                )}
                {results.length === 0 && !searching ? (
                  <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                    No matching cities found. Try another city name.
                  </p>
                ) : (
                  results.map((city, idx) => {
                    const isSelected =
                      city.name === activeLocation.name && city.country === activeLocation.country;
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <button
                        key={city.id}
                        id={`city-option-${city.id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => selectCity(city)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                          isHighlighted
                            ? 'bg-sky-50 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200'
                            : isSelected
                              ? 'bg-slate-50 font-medium text-sky-800 dark:bg-slate-800/70 dark:text-sky-300'
                              : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">
                          {city.name}
                          {city.region ? `, ${city.region}` : ''}
                        </span>
                        <span className="ml-2 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                          {city.country}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRequestGeolocation}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LocateFixed className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Use My Location</span>
          </button>
        </div>

        {/* Standard Segmented Control + Refresh + Theme Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <div
            role="group"
            aria-label="AQI reporting standard"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-950"
          >
            {(
              [
                { id: 'us-epa', label: 'US EPA' },
                { id: 'eu-eaqi', label: 'EU EAQI' },
                { id: 'who-2021', label: 'WHO Limits' },
              ] as const
            ).map((opt) => {
              const active = standard === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeStandard(opt.id)}
                  aria-pressed={active}
                  className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh air quality readings"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {geoStatusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto max-w-7xl border-t border-slate-100 px-4 py-2 text-xs text-slate-600 sm:px-6 dark:border-slate-800 dark:text-slate-300"
        >
          {geoStatusMessage}
        </div>
      )}
    </section>
  );
}
