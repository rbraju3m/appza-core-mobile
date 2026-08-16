import { useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';

import {
  addDraftFiles,
  removeDraftFile,
  renameDraftFile,
  useDocumentDraft,
} from './documentDraft';
import { resolveIcon } from './PrimitiveRenderer';

/**
 * The add-document dropzone and its list of picked files.
 *
 * Bespoke rather than composed from primitives because picking a file is
 * imperative: it needs a hidden <input type="file">, drag-and-drop
 * handlers, and per-row rename/delete against local state. Same reasoning
 * as the other `appza-*` primitives (video embed, poll block).
 *
 * Every label, glyph and colour is a prop, so the whole thing stays
 * editable from the builder's Properties panel — nothing here is
 * hardcoded that the design lets an author change.
 */

export type FilePickerProps = {
  dropzone_label?: string;
  dropzone_icon?: string;
  file_icon?: string;
  image_icon?: string;
  rename_icon?: string;
  delete_icon?: string;
  accept?: string;
  /** Empty/absent = no limit. */
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

export function AppzaFilePicker({ overrides }: { overrides?: Record<string, unknown> }) {
  const draft = useDocumentDraft();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const dropzoneLabel = readString(overrides, 'dropzone_label') ?? 'Drop files here or click to upload';
  const dropzoneIcon = readString(overrides, 'dropzone_icon') ?? 'attach-outline';
  const fileIcon = readString(overrides, 'file_icon') ?? 'document-outline';
  const imageIcon = readString(overrides, 'image_icon') ?? 'image-outline';
  const renameIcon = readString(overrides, 'rename_icon') ?? 'create-outline';
  const deleteIcon = readString(overrides, 'delete_icon') ?? 'trash-outline';
  const accept = readString(overrides, 'accept');
  const renamePrompt = readString(overrides, 'rename_prompt') ?? 'File name';
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

  return (
    <div className="appza-file-picker">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="appza-file-picker-input"
        onChange={(e) => {
          accept_files(e.target.files);
          // Reset so re-picking the same file fires change again.
          e.target.value = '';
        }}
      />

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
                <span className="appza-file-picker-name">{file.name}</span>
                <button
                  type="button"
                  className="appza-file-picker-action"
                  aria-label={`Rename ${file.name}`}
                  disabled={file.status === 'uploading'}
                  onClick={(e) => {
                    e.stopPropagation();
                    // window.prompt keeps this to one primitive. A styled
                    // rename sheet would be a second overlay to place,
                    // select and theme — out of scope for the design.
                    const next = window.prompt(renamePrompt, file.name);
                    if (next !== null) renameDraftFile(file.key, next);
                  }}
                >
                  {resolveIcon(renameIcon) && <IonIcon icon={resolveIcon(renameIcon)} />}
                </button>
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
