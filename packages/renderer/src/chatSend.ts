import { getChatControls, setChatControls } from './chatControls';
import { getRouteParams } from './dataFetch';

export type ChatWriteDeps = {
  endpoint: string;
  method?: string;
  authHeader: string;
  absolutize?: (path: string) => string;
  onError: (message: string) => void;
  onInfo?: (message: string) => void;
  onSuccess?: () => void;
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

function target(): Record<string, unknown> | null {
  const chat = getChatControls();
  if (chat.thread_id !== '') return { thread_id: Number(chat.thread_id) };
  if (chat.space_slug !== '') return { space_slug: chat.space_slug };
  if (chat.intent_user_id !== '') return { intent_id: Number(chat.intent_user_id) };

  // Only the route bag survives a screen restored outside chat.open (deep link, simulator picker).
  const route = getRouteParams();
  const threadId = route.thread_id;
  if (typeof threadId === 'number' || (typeof threadId === 'string' && threadId !== '')) {
    return { thread_id: Number(threadId) };
  }
  const spaceSlug = route.space_slug;
  if (typeof spaceSlug === 'string' && spaceSlug !== '') return { space_slug: spaceSlug };

  return null;
}

export type ChatSendDeps = ChatWriteDeps & {
  // FC creates the thread and posts the first message in one call.
  createThreadEndpoint?: string;
  onThreadCreated?: (threadId: number) => void;
};

export async function sendChatMessage(deps: ChatSendDeps): Promise<void> {
  const chat = getChatControls();
  const abs = deps.absolutize ?? ((p: string) => p);

  if (!deps.authHeader) {
    deps.onError('Please sign in to send messages.');
    return;
  }

  const text = chat.draft.trim();
  if (text === '' && chat.attachments.length === 0) return;

  const to = target();
  if (!to) {
    deps.onError('No conversation is open.');
    return;
  }

  // FC's createIntendedThread appends to an existing 1:1 thread, so this is safe either way; body uses `message`, no attachments.
  const creating = chat.thread_id === '' && chat.space_slug === '' && chat.intent_user_id !== '';
  if (creating) {
    const endpoint = deps.createThreadEndpoint;
    if (!endpoint) {
      deps.onError('This conversation cannot be started yet.');
      return;
    }
    const restoreDraft = { draft: chat.draft, attachments: chat.attachments };
    setChatControls({ draft: '', attachments: [] });
    try {
      const res = await fetch(abs(endpoint), {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: deps.authHeader,
        },
        body: JSON.stringify({
          message: text,
          intent_id: Number(chat.intent_user_id),
          intent_type: 'user',
        }),
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!ok(res, json)) {
        setChatControls(restoreDraft);
        deps.onError(messageFrom(json, res.status, 'The conversation could not be started.'));
        return;
      }
      const item = (json as { item?: { id?: unknown } } | null)?.item;
      const newId = item && (typeof item.id === 'number' || typeof item.id === 'string')
        ? Number(item.id)
        : 0;
      if (Number.isFinite(newId) && newId > 0) {
        deps.onThreadCreated?.(newId);
      }
      deps.onSuccess?.();
    } catch (err) {
      setChatControls(restoreDraft);
      deps.onError(err instanceof Error ? err.message : String(err));
    }
    return;
  }

  const body: Record<string, unknown> = { ...to, text };
  if (chat.attachments.length > 0) body.media = chat.attachments;
  if (chat.reply_to_id !== '') {
    body.reply_to = Number(chat.reply_to_id);
    // FC stores the quoted text verbatim rather than re-reading the replied-to message.
    body.reply_text = chat.reply_to_text;
  }

  // Clear optimistically; a failed send restores it.
  const restore = {
    draft: chat.draft,
    attachments: chat.attachments,
    reply_to_id: chat.reply_to_id,
    reply_to_name: chat.reply_to_name,
    reply_to_text: chat.reply_to_text,
  };
  setChatControls({
    draft: '',
    attachments: [],
    reply_to_id: '',
    reply_to_name: '',
    reply_to_text: '',
  });

  try {
    const res = await fetch(abs(deps.endpoint), {
      method: (deps.method ?? 'POST').toUpperCase(),
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: deps.authHeader,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    if (!ok(res, json)) {
      setChatControls(restore);
      deps.onError(messageFrom(json, res.status, 'The message could not be sent.'));
      return;
    }
    deps.onSuccess?.();
  } catch (err) {
    setChatControls(restore);
    deps.onError(err instanceof Error ? err.message : String(err));
  }
}

export async function deleteChatMessage(
  messageId: string | number,
  deps: ChatWriteDeps & { toast?: string },
): Promise<void> {
  const abs = deps.absolutize ?? ((p: string) => p);
  const id = Number(messageId);

  if (!deps.authHeader) {
    deps.onError('Please sign in to delete messages.');
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    deps.onError('That message could not be identified.');
    return;
  }

  try {
    const res = await fetch(abs(deps.endpoint), {
      method: (deps.method ?? 'POST').toUpperCase(),
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: deps.authHeader,
      },
      body: JSON.stringify({ message_id: id }),
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    if (!ok(res, json)) {
      deps.onError(messageFrom(json, res.status, 'The message could not be deleted.'));
      return;
    }
    if (deps.toast) deps.onInfo?.(deps.toast);
    deps.onSuccess?.();
  } catch (err) {
    deps.onError(err instanceof Error ? err.message : String(err));
  }
}

// FC creates the Media row at upload time, so a dropped pick must be deleted server-side.
export async function discardChatAttachment(
  url: string,
  deps: ChatWriteDeps,
): Promise<void> {
  setChatControls({
    attachments: getChatControls().attachments.filter((u) => u !== url),
  });

  if (!deps.authHeader || url === '') return;
  const abs = deps.absolutize ?? ((p: string) => p);

  try {
    const res = await fetch(abs(deps.endpoint), {
      method: (deps.method ?? 'POST').toUpperCase(),
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: deps.authHeader,
      },
      body: JSON.stringify({ url }),
    });
    const json = (await res.json().catch(() => null)) as Envelope | null;
    if (!ok(res, json)) {
      // Quiet on purpose: the scheduled sweep takes the file.
      // eslint-disable-next-line no-console
      console.warn('[appza] discarding the attachment failed:', messageFrom(json, res.status, ''));
    }
  } catch {
    // Same — never surface this.
  }
}

// FC has nothing to attach a Media row to until the message exists; the send re-resolves each URL.
export function pickAndUploadChatImage(deps: ChatWriteDeps & { accept?: string }): void {
  if (typeof document === 'undefined') return;
  if (!deps.authHeader) {
    deps.onError('Please sign in to attach images.');
    return;
  }
  const to = target();
  if (!to) {
    deps.onError('No conversation is open.');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = deps.accept ?? 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  const cleanup = () => {
    input.remove();
  };

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      cleanup();
      return;
    }
    void (async () => {
      const abs = deps.absolutize ?? ((p: string) => p);
      const form = new FormData();
      for (const [k, v] of Object.entries(to)) form.append(k, String(v));
      form.append('file', file);

      setChatControls({ uploading: true });
      try {
        const res = await fetch(abs(deps.endpoint), {
          method: (deps.method ?? 'POST').toUpperCase(),
          credentials: 'omit',
          // No Content-Type: the browser must set the multipart boundary.
          headers: { Accept: 'application/json', Authorization: deps.authHeader },
          body: form,
        });
        const json = (await res.json().catch(() => null)) as Envelope | null;
        const url =
          json && typeof json.data === 'object' && json.data !== null
            ? (json.data as Record<string, unknown>).url
            : undefined;
        if (!ok(res, json) || typeof url !== 'string' || url === '') {
          deps.onError(messageFrom(json, res.status, 'The image could not be uploaded.'));
          return;
        }
        setChatControls({ attachments: [...getChatControls().attachments, url] });
      } catch (err) {
        deps.onError(err instanceof Error ? err.message : String(err));
      } finally {
        setChatControls({ uploading: false });
        cleanup();
      }
    })();
  });

  input.click();
}
