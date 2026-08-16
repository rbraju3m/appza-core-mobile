import {
  getDocumentDraft,
  getDraftFileHandle,
  patchDraftFile,
  setDocumentDraft,
} from './documentDraft';

/**
 * The add-document write: N multipart uploads, then one create call.
 *
 * Lives here rather than in each shell's dispatcher because both shells
 * need exactly this sequence, and a props/payload mapping duplicated
 * across the two shells is precisely how the modal controls ended up
 * half-wired (P69). The shells supply only what differs: how to build an
 * auth header, how to absolutize a path, and what to do on success.
 */

export type DocumentSubmitDeps = {
  /** From the action's param_schema — never hardcoded in the shell. */
  uploadEndpoint: string;
  createEndpoint: string;
  /** e.g. `Basic <base64>`. Empty means "not signed in". */
  authHeader: string;
  /** Site-absolute in the mobile app; identity in the WP simulator. */
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
    // 1. Upload every file that hasn't been committed yet. Sequential,
    //    not parallel: FC writes a Media row per call and the failure
    //    story is far clearer when one file at a time can be blamed.
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
      // Only sent when the user renamed the row — the server skips the
      // rename round-trip when it matches what was uploaded.
      if (file.name !== file.original_name) {
        form.append('title', file.name);
      }

      const res = await fetch(abs(deps.uploadEndpoint), {
        method: 'POST',
        // Same reason as every other write here: a same-origin fetch
        // would carry WP admin cookies, and WP's cookie path demands an
        // X-WP-Nonce we don't have — it 401s before Application
        // Passwords is ever consulted. Note there is no Content-Type
        // header: the browser has to set the multipart boundary itself.
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
        // The server may have kept the original name if the rename
        // failed; show what actually landed.
        name: typeof uploaded.title === 'string' && uploaded.title ? uploaded.title : file.name,
      });
      media.push(uploaded);
    }

    // 2. Create the post. Re-read the draft: the text fields and switches
    //    may have changed while the uploads were in flight.
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
    // The uploaded files keep their `media` so a retry doesn't upload
    // them twice — only the create call is repeated.
    setDocumentDraft({ submitting: false, error: message });
    deps.onError(message);
  }
}


export type DocumentEditDeps = {
  /** From the action's args — never hardcoded in the shell. */
  uploadEndpoint: string;
  renameEndpoint: string;
  authHeader: string;
  absolutize?: (path: string) => string;
};

/**
 * Prepares an edited document post's files and returns the final
 * `document_ids` list for the feed update.
 *
 * Adding and removing need no endpoint of their own: FluentCommunity's
 * feed update takes the whole desired list and works out the difference —
 * media keys missing from it are detached, new ones (uploaded but not yet
 * attached) are claimed. So the only calls here are the ones that list
 * cannot express: uploading a newly picked file, and renaming one that is
 * already attached (the title lives on the Media row, not in the list).
 *
 * Throws with a human message; the caller decides how to surface it.
 */
export async function prepareDocumentEdit(
  deps: DocumentEditDeps,
): Promise<Array<Record<string, unknown>>> {
  const draft = getDocumentDraft();
  const abs = deps.absolutize ?? ((p: string) => p);
  const media: Array<Record<string, unknown>> = [];

  for (const file of draft.files) {
    // Already attached: keep it in the list, and push a rename through if
    // the row was edited.
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

    // Newly picked: upload it, then include what came back.
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
