'use client';
import React, { useState, useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { fetchSharedJson, TTL } from '../../lib/apiCache';
import { V3Page, Icon } from '@/app/v3/ui/components';
import './orderItemsV3.css';

export default function OrderModelSelector({ value, onChange, placeholder = 'חיפוש דגם או קוד', inputId, hasActiveItems = false }) {
  const [query, setQuery] = useState('');
  const [models, setModels] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId().replace(/:/g, '') + '-models';
  // Chrome/Firefox fall back to an input's `id` (this one is a fixed, reused string
  // like "item-model") to key their own "previously typed values" suggestion list when
  // there's no `name` - autoComplete="off"/"new-password" alone didn't suppress that for
  // this field (unlike the phone field, whose fix was a `type` change - here `type` was
  // already "text"). A random per-mount `name` means the browser never has a stable key
  // to accumulate or match history against.
  const autofillGuardNameRef = useRef(null);
  if (!autofillGuardNameRef.current) {
    autofillGuardNameRef.current = `no-autofill-${Math.random().toString(36).slice(2)}`;
  }

  const hasSelection = Boolean(value?.name);
  // Elegant fix: when dropdown is open and input still shows the selected value's name,
  // treat search as empty to fetch full list instead of filtered one.
  const effectiveQuery = isOpen && value?.name && query === value.name ? '' : query;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && wrapperRef.current.contains(event.target)) {
        return;
      }
      if (dropdownRef.current && dropdownRef.current.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update position for portal dropdown
  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true); // true = capture phase to catch scroll events from any scrollable parent
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  // Fetch models when effective query changes (debounced 300ms via fetchSharedJson)
  useEffect(() => {
    let cancelled = false;
    const fetchModels = async () => {
      setIsLoading(true);
      try {
        // מטמון משותף — אותם חיפושי דגמים חוזרים על עצמם שוב ושוב בזמן קליטת הזמנה
        const data = await fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(effectiveQuery)}${hasActiveItems ? '&hasActiveItems=true' : ''}`, { ttl: TTL.REFERENCE });
        if (!cancelled) setModels(data.models || []);
      } catch (err) {
        console.error('Failed to fetch models', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchModels, 300);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [effectiveQuery, hasActiveItems]);

  // Sync text if value changes from outside (e.g., reset)
  useEffect(() => {
    if (value && value.name !== undefined) {
      setQuery(value.name);
    } else if (!value || !value.name) {
      setQuery('');
    }
  }, [value?.name]);

  // 9000aab4 (נווה יעקב): כמה דגמים ישנים נשמרו עם השם הזמני "ללא שם" (יובאו בלי שם
  // תיאורי אמיתי) - עדיף להציג את קוד הדגם, כמו שכבר קורה בעמדת הלקוחות ובפריטי הזמנה.
  const displayModelName = (model) => {
    const name = (model?.name || '').trim();
    if (name.startsWith('ללא שם') && model?.barcodePrefix) return String(model.barcodePrefix);
    return name;
  };

  const handleSelect = (model) => {
    setQuery(displayModelName(model));
    onChange(model);
    setIsOpen(false);
  };

  // 3 - הקלדה + Enter בלי לחיצה על הרשימה הנפתחת: אם יש התאמה מדויקת (שם או קוד/ברקוד,
  // לא רגיש לרישיות/רווחים) - בוחרים אותה ישירות. אם אין - הודעת שגיאה במקום לבחור בשקט
  // דגם קרוב/שגוי או להשאיר את השדה במצב לא-ברור.
  const resolveTypedValue = async () => {
    const typed = query.trim();
    if (!typed) return;
    if (value?.name && typed.toLowerCase() === value.name.trim().toLowerCase()) return; // כבר נבחר, אין מה לפתור

    const findExact = (list) => (list || []).find(m =>
      (m.name && m.name.trim().toLowerCase() === typed.toLowerCase()) ||
      (m.barcodePrefix && String(m.barcodePrefix).trim().toLowerCase() === typed.toLowerCase())
    );

    let match = findExact(models);
    if (!match) {
      try {
        const data = await fetchSharedJson(`/api/inventory/models?q=${encodeURIComponent(typed)}${hasActiveItems ? '&hasActiveItems=true' : ''}`, { ttl: TTL.REFERENCE });
        match = findExact(data.models);
      } catch (err) {
        console.error('Failed to resolve typed model', err);
      }
    }

    if (match) {
      handleSelect(match);
    } else {
      alert(`לא נמצא דגם או קוד "${typed}". בחרו דגם מהרשימה שנפתחת.`);
    }
  };

  const handleClear = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setQuery('');
    setIsOpen(true);
    // spec: call onChange(null or empty) — null is the canonical "no selection" signal
    // (parents like advFilters already handle `m ? m.name : ''`; others treat null as cleared)
    onChange(null);
    // focus input elegantly after clear
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const dropdownContent = isOpen && models.length > 0 && (
    <div
      ref={dropdownRef}
      data-v3=""
      dir="rtl"
      role="listbox"
      id={listId}
      className="oi-drop"
      // הרשימה נפתחת ב-portal ומוצבת מול מלבן שנמדד ב-JS (getBoundingClientRect הוא תמיד left/top פיזי,
      // בלי קשר לכיוון העמוד) — לכן top/left פיזיים בכוונה ולא inset-inline.
      style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
    >
      {models.map((m) => (
        <div
          data-agy-id="order_model_selector_dropdown_item"
          key={m.id}
          role="option"
          aria-selected={value?.id === m.id}
          className="v3-combo__o"
          onClick={() => handleSelect(m)}
        >
          <span className="v3-combo__oi"><Icon name="tag" size="sm" /></span>
          <span className="v3-combo__ox">
            <b>{displayModelName(m)}</b>
            {m.barcodePrefix && <small>קוד <bdi>{m.barcodePrefix}</bdi></small>}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <V3Page page={false} sprite={false} className="oi-root oi-root--inline">
      <div ref={wrapperRef} className="oi-model">
        <div className="oi-model__in">
          {isLoading ? <span className="v3-spin" aria-hidden="true" /> : <Icon name="search" size="sm" />}
          <input
            ref={inputRef}
            id={inputId}
            data-agy-id="order_model_selector_input"
            className={`v3-input${hasSelection ? ' has-clear' : ''}`}
            type="text"
            role="combobox"
            aria-expanded={isOpen && models.length > 0}
            aria-controls={listId}
            aria-label={placeholder}
            name={autofillGuardNameRef.current}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                resolveTypedValue();
              }
            }}
            placeholder={placeholder}
          />
          {hasSelection && (
            <button
              type="button"
              aria-label="ניקוי הדגם שנבחר"
              data-agy-id="order_model_selector_clear"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="oi-model__clear"
            >
              <Icon name="x" size="sm" />
            </button>
          )}
        </div>
      </div>

      {mounted && createPortal(dropdownContent, document.body)}
    </V3Page>
  );
}
