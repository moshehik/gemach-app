'use client';

import { useRef, useState } from 'react';

// Shared "אריג" file-upload component (design-system.css .upload-zone / .file-chip).
// Wraps a real <input type="file"> — callers own the actual upload/submit logic via
// onFileSelect; this component only owns the drop-zone/selected-file chrome so every
// upload spot in the app (logo, Access import, dress images, backup restore, ...)
// looks identical instead of being restyled ad hoc per page.
export default function UploadZone({
  onFileSelect,
  accept,
  multiple = false,
  label = 'גרור קובץ לכאן או לחץ לבחירה',
  hint,
  file, // { name, size } of the currently-selected file, or null
  onRemove,
  disabled = false,
  id,
}) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    onFileSelect(multiple ? Array.from(fileList) : fileList[0]);
  };

  const formatSize = (bytes) => {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (file) {
    return (
      <div className="file-chip">
        <div className="file-icon"><svg className="icon"><use href="#i-file" /></svg></div>
        <div className="file-meta">
          <span className="file-name">{file.name}</span>
          {file.size != null && <span className="file-size">{formatSize(file.size)}</span>}
        </div>
        {onRemove && (
          <button type="button" className="remove-file" onClick={onRemove} title="הסר קובץ" disabled={disabled}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="upload-zone"
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : isDragOver ? { borderColor: 'var(--primary-solid)', background: 'var(--primary-tint)' } : undefined}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      <svg className="icon"><use href="#i-upload" /></svg>
      <strong>{label}</strong>
      {hint && <span className="hint">{hint}</span>}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />
    </div>
  );
}
