import { useEffect, useId, useRef, useState } from 'react';
import { suggestPlaces } from '../lib/geocode.js';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

/**
 * Campo de endereço com sugestões enquanto digita.
 * Escolher uma sugestão fixa as coordenadas (place); digitar de novo limpa.
 */
export default function AddressInput({
  value,
  place,
  near,
  placeholder,
  label,
  autoFocus,
  onChange,
  onSelect,
  onEnter,
  inputRef,
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const typedRef = useRef(false);

  useEffect(() => {
    if (!typedRef.current) return undefined;
    const query = value.trim();
    if (query.length < MIN_CHARS || place) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await suggestPlaces(query, { near, signal: controller.signal });
        setSuggestions(results);
        setActive(-1);
        setOpen(true);
      } catch {
        // sem sugestões: a pessoa ainda pode seguir com o texto digitado
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // near muda pouco e não deve disparar nova busca sozinho
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, place]);

  function choose(suggestion) {
    typedRef.current = false;
    onSelect(suggestion);
    setOpen(false);
    setSuggestions([]);
  }

  function handleKeyDown(event) {
    const showing = open && suggestions.length > 0;
    if (event.key === 'ArrowDown' && showing) {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && showing) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (showing && active >= 0) choose(suggestions[active]);
      else if (showing && suggestions.length === 1) choose(suggestions[0]);
      else {
        setOpen(false);
        onEnter?.();
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const expanded = open && suggestions.length > 0;

  return (
    <div className="address-input">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck="false"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        className={place ? 'is-located' : ''}
        onChange={(event) => {
          typedRef.current = true;
          onChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {place && <span className="located-hint">{place.subtitle || 'Endereço confirmado'}</span>}
      {loading && <span className="spinner" aria-hidden="true" />}
      {expanded && (
        <ul id={listId} role="listbox" className="suggestions">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat},${s.lon},${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <strong>{s.title}</strong>
              {s.subtitle && <span>{s.subtitle}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
