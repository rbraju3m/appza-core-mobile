import {
  getDocumentDraft,
  getDraftFileHandle,
  patchDraftFile,
  setDocumentDraft,
} from './documentDraft';

export type DocumentSubmitDeps = {
  uploadEndpoint: string;
  createEndpoint: string;
  authHeader: string;
  absolutize?: (path: string) => string;
  onError: (message: string) => void;
  onSuccess: () => void;
};

type Envelope = {
  response?: { status?: number; message?: string };
  data?: unknown;
  message?: string;
};

function messageFrom(json: Envelope | null, status: number, fallback: string): string {
  const inner = json?.response;
  if (inner && typeof inner.message === 'string' && inner.message !== '') return inner.message;
  if (json && typeof json.message === 'string' && json.message !== '') return json.message;
  return `${fallback} (HTTP ${status})`;
}

function ok(res: Response, json: Envelope | null): boolean {
  if (!res.ok) return false;
  const status = json?.response?.status;
  return status === undefined || (status >= 200 && status < 300);
}

export async function submitDocumentDraft(deps: DocumentSubmitDeps): Promise<void> {
  const draft = getDocumentDraft();
  const abs = deps.absolutize ?? ((p: string) => p);

  if (!deps.authHeader) {
    deps.onError('Please sign in to upload documents.');
    return;
  }
  if (!draft.space_slug) {
    deps.onError('No space to upload into.');
    return;
  }
  if (draft.files.length === 0) {
    deps.onError('Attach at least one file before uploading.');
    return;
  }
  if (draft.submitting) return;

  setDocumentDraft({ submitting: true, error: '' });

  try {
    // Sequential: FC writes a Media row per call, so a failure stays attributable.
    const media: Array<Record<string, unknown>> = [];
    for (const file of draft.files) {
      if (file.media) {
        media.push(file.media);
        continue;
      }
      const handle = getDraftFileHandle(file.key);
      if (!handle) {
        throw new Error(`${file.name} is no longer available. Remove it and pick it again.`);
      }

      patchDraftFile(file.key, { status: 'uploading', error: undefined });

      const form = new FormData();
      form.append('space_slug', draft.space_slug);
      form.append('file', handle, file.name);
      if (file.name !== file.original_name) {
        form.append('title', file.name);
      }

      const res = await fetch(abs(deps.uploadEndpoint), {
        method: 'POST',
        // No credentials (WP cookies need an X-WP-Nonce and 401 before app passwords); no Content-Type so the browser sets the boundary.
        credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: deps.authHeader },
        body: form,
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!ok(res, json)) {
        const message = messageFrom(json, res.status, `Could not upload ${file.name}`);
        patchDraftFile(file.key, { status: 'error', error: message });
        throw new Error(message);
      }

      const uploaded = (json?.data ?? null) as Record<string, unknown> | null;
      if (!uploaded || typeof uploaded.media_key !== 'string') {
        const message = `Upload of ${file.name} returned no file.`;
        patchDraftFile(file.key, { status: 'error', error: message });
        throw new Error(message);
      }

      patchDraftFile(file.key, {
        status: 'done',
        media: uploaded,
        name: typeof uploaded.title === 'string' && uploaded.title ? uploaded.title : file.name,
      });
      media.push(uploaded);
    }

    const latest = getDocumentDraft();
    const res = await fetch(abs(deps.createEndpoint), {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: deps.authHeader,
      },
      body: JSON.stringify({
        space_slug: latest.space_slug,
        title: latest.title,
        message: latest.message,
        document_ids: media,
        topic_ids: latest.topic_ids,
        publish: latest.publish,
        scheduled_at: latest.scheduled_at,
      }),
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    if (!ok(res, json)) {
      throw new Error(messageFrom(json, res.status, 'Could not create the document'));
    }

    setDocumentDraft({ submitting: false, error: '' });
    deps.onSuccess();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Keep `media` so a retry doesn't upload twice.
    setDocumentDraft({ submitting: false, error: message });
    deps.onError(message);
  }
}

export type DocumentEditDeps = {
  uploadEndpoint: string;
  renameEndpoint: string;
  authHeader: string;
  absolutize?: (path: string) => string;
};

/** FC's feed update diffs the whole document_ids list, so only uploads and renames need calls. */
export async function prepareDocumentEdit(
  deps: DocumentEditDeps,
): Promise<Array<Record<string, unknown>>> {
  const draft = getDocumentDraft();
  const abs = deps.absolutize ?? ((p: string) => p);
  const media: Array<Record<string, unknown>> = [];

  for (const file of draft.files) {
    if (file.media) {
      if (file.name !== file.original_name) {
        const mediaId = file.media.id;
        const res = await fetch(abs(deps.renameEndpoint), {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: deps.authHeader,
          },
          body: JSON.stringify({ media_id: mediaId, title: file.name }),
        });
        const json = (await res.json().catch(() => null)) as Envelope | null;
        if (!ok(res, json)) {
          throw new Error(messageFrom(json, res.status, `Could not rename ${file.original_name}`));
        }
        patchDraftFile(file.key, {
          original_name: file.name,
          media: { ...file.media, title: file.name },
        });
        media.push({ ...file.media, title: file.name });
        continue;
      }
      media.push(file.media);
      continue;
    }

    const handle = getDraftFileHandle(file.key);
    if (!handle) {
      throw new Error(`${file.name} is no longer available. Remove it and pick it again.`);
    }
    patchDraftFile(file.key, { status: 'uploading', error: undefined });

    const form = new FormData();
    form.append('space_slug', draft.space_slug);
    form.append('file', handle, file.name);
    if (file.name !== file.original_name) form.append('title', file.name);

    const res = await fetch(abs(deps.uploadEndpoint), {
      method: 'POST',
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: deps.authHeader },
      body: form,
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    if (!ok(res, json)) {
      const message = messageFrom(json, res.status, `Could not upload ${file.name}`);
      patchDraftFile(file.key, { status: 'error', error: message });
      throw new Error(message);
    }
    const uploaded = (json?.data ?? null) as Record<string, unknown> | null;
    if (!uploaded || typeof uploaded.media_key !== 'string') {
      const message = `Upload of ${file.name} returned no file.`;
      patchDraftFile(file.key, { status: 'error', error: message });
      throw new Error(message);
    }
    patchDraftFile(file.key, { status: 'done', media: uploaded });
    media.push(uploaded);
  }

  return media;
}
