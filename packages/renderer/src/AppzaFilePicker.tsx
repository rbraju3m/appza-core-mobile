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

/**
 * True in the builder's Edit mode — inside the device frame, but not in
 * the App-mode canvas. Design time has no post under edit, so a block
 * gated on one would render nothing and be unselectable, which is how a
 * control becomes invisible to the person meant to style it (P73).
 */
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
    // Re-read when the mode changes. Sampling once on mount looks
    // equivalent and is not: App mode is a class toggled on an ancestor,
    // so a picker that happened to mount first stays on the design-time
    // branch for the rest of the session — which reads as "the real data
    // never arrived" rather than "this is the design-time view" (P110).
    // It had not bitten here only because this screen is reached after
    // the mode is set; the composer had the same code and it did.
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    return () => observer.disconnect();
  }, []);
  return designTime;
}

export function AppzaFilePicker({ overrides }: { overrides?: Record<string, unknown> }) {
  const draft = useDocumentDraft();
  const inputRef = useRef<HTMLInputElement | null>(null);
  // A second input for per-row replacement, plus which row asked for it.
  // Separate from the add input so a replacement never appends.
  const replaceRef = useRef<HTMLInputElement | null>(null);
  const replaceKeyRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // Which row is being renamed, and the text so far. Inline rather than
  // window.prompt(): a WebView routes prompts through the host app and
  // Capacitor does not surface them, so on a device the pencil silently
  // did nothing. An inline field also matches the portal.
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
  // Edit-post use: the block belongs on the screen only when the post
  // being edited is a document. Gating in the component rather than at
  // placement level because placements can read state but not the item
  // under edit.
  const requiresEditContext =
    overrides?.require_edit_context === true ||
    readString(overrides, 'require_edit_context') === 'true';
  // The dropzone, separately from the list.
  //
  // A post can carry files in a space whose Document Library switch has
  // since been turned off, and those files must still be listed — but
  // FluentCommunity Pro's own upload guards on exactly that switch
  // (`$space->verifyUserPermisson($user, 'can_upload_documents')`), so a
  // dropzone there is a control the server will refuse. Rename and
  // removal are not guarded that way and stay available.
  //
  // Defaults TRUE, so the add-document screen — where the picker IS the
  // upload — is untouched.
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
    // Leave rename state BEFORE the chooser opens. Otherwise the field's
    // blur commits its stale text over the name the replacement brings.
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
        // Clipped rather than display:none — a WebView will refuse to open
        // its file chooser for an input that isn't laid out.
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
                    // Keep focus on the rename field: a blur would unmount
                    // this button before its click could land.
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
