import { useEffect, useState } from 'react';

// Add-document draft — the state behind the space-document-add screen.
//
// Same event-backed store shape as spacesControls / spaceDetailControls,
// with one deliberate difference: NOTHING here is persisted. The draft
// holds File handles, which don't survive JSON, and a half-written upload
// restored days later would be worse than a clean form. It is reset when
// the screen is opened.
//
// The picked File objects live in a module-level map rather than in the
// state object, so the state stays a plain serialisable record that React
// can compare cheaply and the shells can log without dumping binaries.

export type DraftFileStatus = 'pending' | 'uploading' | 'done' | 'error';

export type DraftFile = {
  /** Local identity — survives rename, unlike the filename. */
  key: string;
  /** Display name; editable before upload (the design's pencil). */
  name: string;
  /** Name the file arrived with, so a rename can be detected. */
  original_name: string;
  type: string;
  /** 'image' | 'document' — picks the row glyph, same as the list card. */
  kind: string;
  size: number;
  status: DraftFileStatus;
  error?: string;
  /** Set once the file is committed: the media object the server returned. */
  media?: Record<string, unknown>;
};

export type DocumentDraft = {
  space_slug: string;
  title: string;
  message: string;
  files: DraftFile[];
  topic_ids: number[];
  publish: boolean;
  /** ISO-ish 'YYYY-MM-DD HH:MM:SS'. Empty = post immediately. */
  scheduled_at: string;
  submitting: boolean;
  error: string;
};

const EVENT = 'appza:document-draft-change';

const EMPTY: DocumentDraft = {
  space_slug: '',
  title: '',
  message: '',
  files: [],
  topic_ids: [],
  publish: false,
  scheduled_at: '',
  submitting: false,
  error: '',
};

let current: DocumentDraft = { ...EMPTY };

/** key -> File. Kept out of the state record; see the note above. */
const fileHandles = new Map<string, File>();

let keySeed = 0;

export function getDocumentDraft(): DocumentDraft {
  return current;
}

export function getDraftFileHandle(key: string): File | undefined {
  return fileHandles.get(key);
}

function emit(next: DocumentDraft): void {
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function setDocumentDraft(patch: Partial<DocumentDraft>): void {
  emit({ ...current, ...patch });
}

/**
 * Start a fresh draft for a space. Called when the add screen mounts —
 * without it, the previous visit's files would still be listed.
 */
export function resetDocumentDraft(spaceSlug: string): void {
  fileHandles.clear();
  emit({ ...EMPTY, space_slug: spaceSlug });
}

export function addDraftFiles(files: ArrayLike<File>): void {
  const added: DraftFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const key = `f${++keySeed}`;
    fileHandles.set(key, file);
    added.push({
      key,
      name: file.name,
      original_name: file.name,
      type: file.type,
      kind: kindFor(file.type, file.name),
      size: file.size,
      status: 'pending',
    });
  }
  if (added.length === 0) return;
  emit({ ...current, files: [...current.files, ...added], error: '' });
}

export function removeDraftFile(key: string): void {
  fileHandles.delete(key);
  emit({ ...current, files: current.files.filter((f) => f.key !== key) });
}

export function renameDraftFile(key: string, name: string): void {
  const trimmed = name.trim();
  if (trimmed === '') return;
  emit({
    ...current,
    files: current.files.map((f) => (f.key === key ? { ...f, name: trimmed } : f)),
  });
}

export function patchDraftFile(key: string, patch: Partial<DraftFile>): void {
  emit({
    ...current,
    files: current.files.map((f) => (f.key === key ? { ...f, ...patch } : f)),
  });
}

/** Chips are multi-select: tapping a selected topic clears it. */
export function toggleDraftTopic(topicId: number): void {
  const has = current.topic_ids.includes(topicId);
  emit({
    ...current,
    topic_ids: has
      ? current.topic_ids.filter((id) => id !== topicId)
      : [...current.topic_ids, topicId],
  });
}

/**
 * Same rule the list card's glyph uses, so a file looks identical before
 * and after it is committed.
 */
export function kindFor(mime: string, name: string): string {
  if (mime.startsWith('image/')) return 'image';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext)
    ? 'image'
    : 'document';
}

export function useDocumentDraft(): DocumentDraft {
  const [state, setState] = useState<DocumentDraft>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}
