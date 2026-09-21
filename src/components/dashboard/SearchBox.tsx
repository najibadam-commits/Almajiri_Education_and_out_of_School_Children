'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from '@/state/DashboardProvider';

const MAX_SUGGESTIONS = 8;
const MIN_QUERY_LENGTH = 2;

/**
 * Header search over school name, LGA and state.
 *
 * Picking a suggestion drills the dashboard down to that school; "Show all
 * matches" applies the text as a filter across every view instead.
 */
export function SearchBox() {
  const { schools, catalog, state, setQuery, focusSchool } = useDashboard();
  const [text, setText] = useState(state.q);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);

  // Keeps the box in step when the query is cleared elsewhere, such as by the
  // sidebar's reset button.
  useEffect(() => {
    setText(state.q);
  }, [state.q]);

  const suggestions = useMemo(() => {
    const needle = text.trim().toLowerCase();
    if (needle.length < MIN_QUERY_LENGTH) return [];
    const found = [];
    for (const school of schools) {
      if (school.search.includes(needle)) {
        found.push(school);
        if (found.length === MAX_SUGGESTIONS) break;
      }
    }
    return found;
  }, [text, schools]);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [open]);

  function applyQuery() {
    setQuery(text);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleChange(value: string) {
    setText(value);
    setActiveIndex(-1);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setOpen(false);
      // Emptying the box clears an applied query, as the prototype does.
      if (!value.trim() && state.q) setQuery('');
      return;
    }
    setOpen(true);
  }

  /** Suggestions plus the trailing "Show all matches" row. */
  const optionCount = suggestions.length > 0 ? suggestions.length + 1 : 0;

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (optionCount === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + step + optionCount) % optionCount);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        focusSchool(suggestions[activeIndex]);
        setOpen(false);
        setActiveIndex(-1);
      } else {
        applyQuery();
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="search" role="search" ref={wrapper}>
      <input
        id="q"
        type="search"
        placeholder="Search school or Mallam"
        autoComplete="off"
        aria-label="Search schools"
        aria-expanded={open}
        aria-controls="suggest"
        role="combobox"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
      />
      <button id="qBtn" aria-label="Search" onClick={applyQuery}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>

      <div
        className="suggest"
        id="suggest"
        role="listbox"
        style={{ display: open ? 'block' : 'none' }}
      >
        {suggestions.length === 0 ? (
          <button disabled>No sample schools match</button>
        ) : (
          <>
            {suggestions.map((school, index) => (
              <button
                key={school.id}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? 'active' : undefined}
                onClick={() => {
                  focusSchool(school);
                  setOpen(false);
                  setActiveIndex(-1);
                }}
              >
                {school.name}
                <small>
                  {school.lgaName} · {school.stateName} · {catalog.types[school.type]}
                </small>
              </button>
            ))}
            <button
              className={activeIndex === suggestions.length ? 'active' : undefined}
              onClick={applyQuery}
            >
              <b>Show all matches for “{text.trim()}”</b>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
