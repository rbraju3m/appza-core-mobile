import { useEffect, useState } from 'react';

// Not persisted: File handles don't survive JSON. Files live in a module map so the state stays serialisable.

export type DraftFileStatus = 'pending' | 'uploading' | 'done' | 'error';

export type DraftFile = {
  key: string;
  name: string;
  original_name: string;
  type: string;
  kind: string;
  size: number;
  status: DraftFileStatus;
  error?: string;
  media?: Record<string, unknown>;
};

export type DocumentDraft = {
  space_slug: string;
  edit_feed_id: number | null;
  /** Safety interlock: an empty document_ids deletes every file on the post, so 0 means unknown and submit omits it. */
  seeded_file_count: number;
  title: string;
  message: string;
  files: DraftFile[];
  topic_ids: number[];
  publish: boolean;
  scheduled_at: string;
  submitting: boolean;
  error: string;
};

const EVENT = 'appza:document-draft-change';

const EMPTY: DocumentDraft = {
  space_slug: '',
  edit_feed_id: null,
  seeded_file_count: 0,
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

export function resetDocumentDraft(spaceSlug: string): void {
  fileHandles.clear();
  emit({ ...EMPTY, space_slug: spaceSlug });
}

export function seedDraftForEdit(
  feedId: number,
  spaceSlug: string,
  files: Array<Record<string, unknown>>,
): void {
  fileHandles.clear();
  const seeded: DraftFile[] = files.map((f, i) => {
    const name = typeof f.title === 'string' ? f.title : `file-${i + 1}`;
    const type = typeof f.type === 'string' ? f.type : '';
    return {
      key: `e${++keySeed}`,
      name,
      original_name: name,
      type,
      kind: typeof f.kind === 'string' ? f.kind : kindFor(type, name),
      size: 0,
      status: 'done',
      media: f,
    };
  });
  emit({
    ...EMPTY,
    space_slug: spaceSlug,
    edit_feed_id: feedId,
    seeded_file_count: seeded.length,
    files: seeded,
  });
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

/** Dropping `media` makes FC's feed update detach the old file and claim the new one in one save. */
export function replaceDraftFile(key: string, file: File): void {
  fileHandles.set(key, file);
  emit({
    ...current,
    files: current.files.map((f) =>
      f.key === key
        ? {
            ...f,
            name: file.name,
            original_name: file.name,
            type: file.type,
            kind: kindFor(file.type, file.name),
            size: file.size,
            status: 'pending',
            error: undefined,
            media: undefined,
          }
        : f,
    ),
    error: '',
  });
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

export function toggleDraftTopic(topicId: number): void {
  const has = current.topic_ids.includes(topicId);
  emit({
    ...current,
    topic_ids: has
      ? current.topic_ids.filter((id) => id !== topicId)
      : [...current.topic_ids, topicId],
  });
}

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
