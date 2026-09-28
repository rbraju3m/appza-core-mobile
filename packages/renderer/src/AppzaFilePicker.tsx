import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';

import {
  addDraftFiles,
  removeDraftFile,
  renameDraftFile,
  replaceDraftFile,
  useDocumentDraft,
} from './documentDraft';
import { resolveIcon } from './PrimitiveRenderer';

export type FilePickerProps = {
  dropzone_label?: string;
  dropzone_icon?: string;
  file_icon?: string;
  image_icon?: string;
  rename_icon?: string;
  delete_icon?: string;
  accept?: string;
  max_files?: number;
  rename_prompt?: string;
};

function readString(o: Record<string, unknown> | undefined, k: string): string | undefined {
  if (!o) return undefined;
  const v = o[k];
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

// Design time has no post under edit; without this a gated block would be invisible and unselectable.
function useDesignTime(): boolean {
  const [designTime, setDesignTime] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const read = () => {
      const inFrame = Boolean(document.querySelector('.appza-device-viewport'));
      const inApp = Boolean(document.querySelector('.appza-center-app-mode'));
      setDesignTime(inFrame && !inApp);
    };
    read();
    // Re-read on mode change: App mode is an ancestor class toggle, so sampling once on mount can stick on the design-time branch.
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    return () => observer.disconnect();
  }, []);
  return designTime;
}

export function AppzaFilePicker({ overrides }: { overrides?: Record<string, unknown> }) {
  const draft = useDocumentDraft();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const replaceRef = useRef<HTMLInputElement | null>(null);
  const replaceKeyRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Inline rather than window.prompt(): Capacitor doesn't surface WebView prompts.
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const designTime = useDesignTime();

  const dropzoneLabel = readString(overrides, 'dropzone_label') ?? 'Drop files here or click to upload';
  const dropzoneIcon = readString(overrides, 'dropzone_icon') ?? 'attach-outline';
  const fileIcon = readString(overrides, 'file_icon') ?? 'document-outline';
  const imageIcon = readString(overrides, 'image_icon') ?? 'image-outline';
  const renameIcon = readString(overrides, 'rename_icon') ?? 'create-outline';
  const replaceIcon = readString(overrides, 'replace_icon') ?? 'cloud-upload-outline';
  const replaceLabel = readString(overrides, 'replace_label') ?? 'Replace file';
  const deleteIcon = readString(overrides, 'delete_icon') ?? 'trash-outline';
  const accept = readString(overrides, 'accept');
  const renamePrompt = readString(overrides, 'rename_prompt') ?? 'File name';
  // Gated here because placements can't read the item under edit.
  const requiresEditContext =
    overrides?.require_edit_context === true ||
    readString(overrides, 'require_edit_context') === 'true';
  // FC Pro refuses uploads when the space's Document Library is off; existing files keep rename/remove.
  const showDropzone = !(
    overrides?.show_dropzone === false || readString(overrides, 'show_dropzone') === 'false'
  );
  const maxRaw = readString(overrides, 'max_files');
  const maxFiles = maxRaw ? Number.parseInt(maxRaw, 10) : NaN;

  const atLimit = Number.isFinite(maxFiles) && maxFiles > 0 && draft.files.length >= maxFiles;

  const accept_files = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const room = Number.isFinite(maxFiles) && maxFiles > 0 ? maxFiles - draft.files.length : list.length;
    if (room <= 0) return;
    addDraftFiles(Array.from(list).slice(0, room));
  };

  const openPicker = () => {
    if (atLimit) return;
    inputRef.current?.click();
  };

  const openReplacePicker = (key: string) => {
    // Leave rename state first, or the field's blur commits stale text over the replacement's name.
    setRenamingKey(null);
    setRenameValue('');
    replaceKeyRef.current = key;
    replaceRef.current?.click();
  };

  if (requiresEditContext && draft.edit_feed_id === null && !designTime) return null;

  const commitRename = () => {
    if (renamingKey) renameDraftFile(renamingKey, renameValue);
    setRenamingKey(null);
    setRenameValue('');
  };

  return (
    <div className="appza-file-picker">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="appza-file-picker-input"
        // Clipped, not display:none — a WebView won't open a chooser for an input that isn't laid out.
        onChange={(e) => {
          accept_files(e.target.files);
          // Reset so re-picking the same file fires change again.
          e.target.value = '';
        }}
      />

      <input
        ref={replaceRef}
        type="file"
        accept={accept}
        className="appza-file-picker-input"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          const key = replaceKeyRef.current;
          if (picked && key) replaceDraftFile(key, picked);
          replaceKeyRef.current = null;
          e.target.value = '';
        }}
      />

      {showDropzone && (
      <div
        className={`appza-file-picker-dropzone${dragging ? ' is-dragging' : ''}${atLimit ? ' is-full' : ''}`}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept_files(e.dataTransfer?.files ?? null);
        }}
      >
        {resolveIcon(dropzoneIcon) && (
          <IonIcon className="appza-file-picker-clip" icon={resolveIcon(dropzoneIcon)} />
        )}
        <span className="appza-file-picker-label">{dropzoneLabel}</span>
      </div>
      )}

      {draft.files.length > 0 && (
        <ul className="appza-file-picker-list">
          {draft.files.map((file) => {
            const glyph = file.kind === 'image' ? imageIcon : fileIcon;
            return (
              <li
                key={file.key}
                className={`appza-file-picker-row is-${file.status}`}
                title={file.error || file.name}
              >
                {resolveIcon(glyph) && (
                  <IonIcon className="appza-file-picker-row-icon" icon={resolveIcon(glyph)} />
                )}
                {renamingKey === file.key ? (
                  <input
                    className="appza-file-picker-rename"
                    value={renameValue}
                    autoFocus
                    aria-label={renamePrompt}
                    placeholder={renamePrompt}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setRenamingKey(null);
                        setRenameValue('');
                      }
                    }}
                  />
                ) : (
                  <span className="appza-file-picker-name">{file.name}</span>
                )}
                <button
                  type="button"
                  className="appza-file-picker-action"
                  aria-label={`Rename ${file.name}`}
                  disabled={file.status === 'uploading'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (renamingKey === file.key) {
                      commitRename();
                      return;
                    }
                    setRenamingKey(file.key);
                    setRenameValue(file.name);
                  }}
                >
                  {resolveIcon(renameIcon) && <IonIcon icon={resolveIcon(renameIcon)} />}
                </button>
                {renamingKey === file.key && (
                  <button
                    type="button"
                    className="appza-file-picker-action"
                    aria-label={`${replaceLabel}: ${file.name}`}
                    title={replaceLabel}
                    disabled={file.status === 'uploading'}
                    // Keep focus: a blur would unmount this button before its click lands.
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      openReplacePicker(file.key);
                    }}
                  >
                    {resolveIcon(replaceIcon) && <IonIcon icon={resolveIcon(replaceIcon)} />}
                  </button>
                )}
                <button
                  type="button"
                  className="appza-file-picker-action"
                  aria-label={`Remove ${file.name}`}
                  disabled={file.status === 'uploading'}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDraftFile(file.key);
                  }}
                >
                  {resolveIcon(deleteIcon) && <IonIcon icon={resolveIcon(deleteIcon)} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
