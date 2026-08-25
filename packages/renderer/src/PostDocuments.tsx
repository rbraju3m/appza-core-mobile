import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import type { PostDraftDocument } from './postDraft';

/**
 * Attached documents — Noor's designs 30 and 31.
 *
 * Two surfaces of one attachment, together for the same reason the poll's
 * three are: the composer's row and the preview's row differ only in
 * which affordance rides on the right (rename + delete vs download), and
 * a file that looked different in the preview would defeat the preview.
 *
 * **Documents take the whole post.** FluentCommunity resolves exactly one
 * `content_type` and its document filter runs last, so a draft carrying
 * documents plus a poll would post as a document and write the survey to
 * meta where nothing draws it. Design 30 shows the consequence directly:
 * once a file is attached the attach bar has a paperclip and nothing
 * else. The gating is in the catalog (`state.post_draft.has_documents`),
 * not in here — this file only draws.
 *
 * Rename and delete both go to the SERVER first. Unlike an image or an
 * audio file, a document that has been uploaded but not yet posted can
 * genuinely be removed: `/documents/delete` resolves an upload with no
 * `feed_id` and permits it as long as the media belongs to the asking
 * user. So the trash icon really deletes rather than leaving an orphan,
 * and the row stays put if the call fails.
 */

export type DocumentRowLabels = {
  renameIcon: string;
  deleteIcon: string;
  fileIcon: string;
  downloadIcon: string;
  /** Prompt shown by the rename affordance. */
  renamePrompt: string;
};

function DocIcon({ name }: { name: string }) {
  const icon = resolveIcon(name);
  return icon ? (
    <IonIcon className="appza-doc-row-glyph" icon={icon} aria-hidden="true" />
  ) : null;
}

/**
 * The composer's list — design 30.
 *
 * A row per file: glyph, name, rename, delete. The name truncates with an
 * ellipsis rather than wrapping, which is what the design draws and what
 * keeps a long upload from pushing the attach bar off the card.
 */
export function AppzaDraftDocumentList({
  documents,
  labels,
  onRename,
  onRemove,
}: {
  documents: PostDraftDocument[];
  labels: DocumentRowLabels;
  /** Resolves once the server has agreed. */
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}) {
  // Read rather than passed: the shell owns the request lifecycle and
  // this component is rendered by the primitive renderer, which has no
  // way to thread it through.
  const busy = useDocumentBusy();
  // The row being renamed inline. A prompt() would be simpler and is what
  // the shells use elsewhere, but it is unavailable in a Capacitor
  // WebView on some Android builds — and an inline field is what the
  // design's pencil implies anyway.
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // A row that disappears mid-rename (deleted from elsewhere, or the
  // draft reset) must not leave the field open over the next one.
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

/**
 * The preview's card — design 31.
 *
 * A bordered box with a centred heading and one row per file, each
 * carrying a download glyph. Nothing here is tappable: the post does not
 * exist yet, so there is no attachment to download. The glyph is drawn
 * because the design draws it and because the preview's job is to show
 * what the post will look like.
 */
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

/* ------------------------- the request channel ------------------------- */

const RENAME_EVENT = 'appza:request-document-rename';
const REMOVE_EVENT = 'appza:request-document-remove';

/**
 * Ask the shell to rename / remove a document.
 *
 * Same shape as the poll strip's "Edit", and for the same reason: both
 * calls need the resolved endpoints and the auth header, which live in
 * the shell, and the rows are drawn inside a primitive that has no child
 * index of its own to hang an action on. The draft is only updated once
 * the server has agreed, so a failed call leaves the row where it was
 * rather than silently losing the user's file.
 */
export function requestDocumentRename(id: string, title: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RENAME_EVENT, { detail: { id, title } }));
}

export function requestDocumentRemove(id: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REMOVE_EVENT, { detail: { id } }));
}

/**
 * Which row has a call in flight.
 *
 * A store rather than a prop because only the SHELL knows when a request
 * finishes, and only the LIST draws rows — and neither can see the other
 * without threading state through the primitive renderer. Kept here so
 * the two halves of one fact live in one file.
 *
 * It matters: without it a second tap on the bin fires a second delete
 * for a file the first one already removed, and the user gets an error
 * toast about their own successful action.
 */
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

/** Shell side of the two above. Returns its own unsubscribe. */
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

/* ---------------------------- the HTTP half ---------------------------- */

type Envelope = {
  response?: { status?: number; message?: string };
  /** Our own `/spaces/documents/upload` puts the file here. */
  data?: unknown;
  /** fcom-mobile's proxies put it here. */
  items?: unknown;
  /** FC Pro's own controller, if a route is ever hit directly. */
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

/**
 * Turn one upload response into a draft document.
 *
 * The shape is `Media::getPrivateFileMeta()` — id, url, media_key, title,
 * type — but which envelope key carries it differs between the upload
 * (`data`) and the rename (`file`), so both are accepted.
 */
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

/**
 * Upload one document into a space.
 *
 * Sequential from the caller, not parallel: FluentCommunity writes a
 * Media row per call, and one file at a time is the only version of this
 * whose failure can be attributed. Same reason `submitDocumentDraft`
 * does it that way.
 *
 * `credentials: 'omit'` and no Content-Type — the browser sets the
 * multipart boundary itself, and a same-origin fetch would carry WP admin
 * cookies that 401 before Application Passwords is consulted.
 */
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
    // Three envelopes for one file: ours nests it under `data`,
    // fcom-mobile's proxies under `items`, FC Pro's own controller under
    // `file`. Accepting all three means the endpoint can be repointed in
    // the catalog without a code change.
    const doc = toDocument(json?.data) ?? toDocument(json?.items) ?? toDocument(json?.file);
    if (!doc) return { doc: null, error: `Upload of ${file.name} returned no file.` };
    return { doc, error: '' };
  } catch (err) {
    return { doc: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Rename one document. Returns the server's message on failure. */
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

/**
 * Delete one document.
 *
 * Works on an upload that is not attached to anything yet — which is what
 * makes the composer's trash icon a real delete rather than a local drop
 * that leaves a file on the server forever. `resolveDcoumentSource`
 * permits a `space_document` media with no `feed_id` when it belongs to
 * the asking user.
 */
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
