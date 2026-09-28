import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import type { PostDraftDocument } from './postDraft';

// Documents take the whole post: FC resolves one content_type and its document filter runs last.

export type DocumentRowLabels = {
  renameIcon: string;
  deleteIcon: string;
  fileIcon: string;
  downloadIcon: string;
  renamePrompt: string;
};

function DocIcon({ name }: { name: string }) {
  const icon = resolveIcon(name);
  return icon ? (
    <IonIcon className="appza-doc-row-glyph" icon={icon} aria-hidden="true" />
  ) : null;
}

export function AppzaDraftDocumentList({
  documents,
  labels,
  onRename,
  onRemove,
}: {
  documents: PostDraftDocument[];
  labels: DocumentRowLabels;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}) {
  const busy = useDocumentBusy();
  // Inline rename: prompt() is unavailable in some Android Capacitor WebViews.
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Close the rename field if its row disappears.
  useEffect(() => {
    if (editing && !documents.some((d) => d.id === editing)) setEditing(null);
  }, [documents, editing]);

  const commit = (id: string) => {
    const trimmed = value.trim();
    setEditing(null);
    if (trimmed === '') return;
    const current = documents.find((d) => d.id === id);
    if (!current || current.title === trimmed) return;
    onRename(id, trimmed);
  };

  return (
    <span className="appza-doc-list">
      {documents.map((doc) => {
        const isEditing = editing === doc.id;
        return (
          <span
            key={doc.id}
            className="appza-doc-row"
            data-busy={busy === doc.id ? 'yes' : 'no'}
          >
            <DocIcon name={labels.fileIcon} />
            {isEditing ? (
              <input
                ref={inputRef}
                className="appza-doc-row-rename"
                value={value}
                aria-label={labels.renamePrompt}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => commit(doc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(doc.id);
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <span className="appza-doc-row-name" title={doc.title}>
                {doc.title}
              </span>
            )}
            <button
              type="button"
              className="appza-doc-row-btn"
              aria-label={labels.renamePrompt}
              onClick={() => {
                setValue(doc.title);
                setEditing(doc.id);
              }}
            >
              <DocIcon name={labels.renameIcon} />
            </button>
            <button
              type="button"
              className="appza-doc-row-btn"
              aria-label="Remove file"
              onClick={() => onRemove(doc.id)}
            >
              <DocIcon name={labels.deleteIcon} />
            </button>
          </span>
        );
      })}
    </span>
  );
}

export function AppzaDocumentsPreview({
  documents,
  heading,
  fileIcon,
  downloadIcon,
  showHeading,
}: {
  documents: PostDraftDocument[];
  heading: string;
  fileIcon: string;
  downloadIcon: string;
  showHeading: boolean;
}) {
  return (
    <span className="appza-doc-preview">
      {showHeading && <span className="appza-doc-preview-heading">{heading}</span>}
      <span className="appza-doc-preview-list">
        {documents.map((doc) => (
          <span key={doc.id} className="appza-doc-preview-row">
            <DocIcon name={fileIcon} />
            <span className="appza-doc-preview-name" title={doc.title}>
              {doc.title}
            </span>
            <DocIcon name={downloadIcon} />
          </span>
        ))}
      </span>
    </span>
  );
}

const RENAME_EVENT = 'appza:request-document-rename';
const REMOVE_EVENT = 'appza:request-document-remove';

export function requestDocumentRename(id: string, title: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RENAME_EVENT, { detail: { id, title } }));
}

export function requestDocumentRemove(id: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REMOVE_EVENT, { detail: { id } }));
}

/** Stops a second tap firing a second delete for an already-removed file. */
const BUSY_EVENT = 'appza:document-busy-change';
let busyId = '';

export function setDocumentBusy(id: string): void {
  if (busyId === id) return;
  busyId = id;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: id }));
  }
}

export function useDocumentBusy(): string {
  const [state, setState] = useState(busyId);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(busyId);
    window.addEventListener(BUSY_EVENT, onChange);
    return () => window.removeEventListener(BUSY_EVENT, onChange);
  }, []);
  return state;
}

export function onDocumentRequests(handlers: {
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};
  const rename = (e: Event) => {
    const d = (e as CustomEvent<{ id: string; title: string }>).detail;
    if (d) handlers.onRename(d.id, d.title);
  };
  const remove = (e: Event) => {
    const d = (e as CustomEvent<{ id: string }>).detail;
    if (d) handlers.onRemove(d.id);
  };
  window.addEventListener(RENAME_EVENT, rename);
  window.addEventListener(REMOVE_EVENT, remove);
  return () => {
    window.removeEventListener(RENAME_EVENT, rename);
    window.removeEventListener(REMOVE_EVENT, remove);
  };
}

type Envelope = {
  response?: { status?: number; message?: string };
  data?: unknown;
  items?: unknown;
  file?: unknown;
  message?: string;
};

function ok(res: Response, json: Envelope | null): boolean {
  if (!res.ok) return false;
  const status = json?.response?.status;
  return status === undefined || (status >= 200 && status < 300);
}

function messageFrom(json: Envelope | null, status: number, fallback: string): string {
  const inner = json?.response;
  if (inner && typeof inner.message === 'string' && inner.message !== '') return inner.message;
  if (json && typeof json.message === 'string' && json.message !== '') return json.message;
  return `${fallback} (HTTP ${status})`;
}

function s(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

function toDocument(raw: unknown): PostDraftDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const mediaKey = s(rec.media_key);
  if (mediaKey === '') return null;
  return {
    id: s(rec.id),
    media_key: mediaKey,
    title: s(rec.title),
    url: s(rec.url),
    type: s(rec.type),
  };
}

/** No Content-Type (the browser sets the boundary); credentials omitted since WP cookies 401 before app passwords. */
export async function uploadDraftDocument(
  file: File,
  spaceSlug: string,
  endpoint: string,
  authHeader: string,
): Promise<{ doc: PostDraftDocument | null; error: string }> {
  const form = new FormData();
  form.append('space_slug', spaceSlug);
  form.append('file', file, file.name);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers,
      body: form,
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    if (!ok(res, json)) {
      return { doc: null, error: messageFrom(json, res.status, `Could not upload ${file.name}`) };
    }
    // Accept ours (`data`), fcom-mobile's (`items`) and FC Pro's (`file`) envelopes.
    const doc = toDocument(json?.data) ?? toDocument(json?.items) ?? toDocument(json?.file);
    if (!doc) return { doc: null, error: `Upload of ${file.name} returned no file.` };
    return { doc, error: '' };
  } catch (err) {
    return { doc: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renameDraftDocument(
  id: string,
  title: string,
  endpoint: string,
  authHeader: string,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (authHeader) headers.Authorization = authHeader;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers,
      body: JSON.stringify({ id, title }),
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    return ok(res, json) ? '' : messageFrom(json, res.status, 'Could not rename the file');
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** FC permits deleting an unattached space_document owned by the user, so this is a real delete. */
export async function deleteDraftDocument(
  id: string,
  endpoint: string,
  authHeader: string,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (authHeader) headers.Authorization = authHeader;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      headers,
      body: JSON.stringify({ id }),
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    return ok(res, json) ? '' : messageFrom(json, res.status, 'Could not remove the file');
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
