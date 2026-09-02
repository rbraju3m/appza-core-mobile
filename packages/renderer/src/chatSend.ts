import { getChatControls, setChatControls } from './chatControls';
import { getRouteParams } from './dataFetch';

/**
 * The conversation write path: sending a message, deleting one, and
 * attaching an image.
 *
 * Lives here rather than in each shell's dispatcher for the reason
 * documentSubmit.ts records — the same sequence duplicated across two
 * shells is exactly how half-wired controls happen (P69). The shells
 * supply only what differs: how to build an auth header, how to
 * absolutize a path, and what to say on success or failure.
 *
 * Every endpoint arrives from the action's param_schema. Nothing here
 * has a URL of its own.
 */

export type ChatWriteDeps = {
  /** From the action's args — never hardcoded in the shell. */
  endpoint: string;
  method?: string;
  /** e.g. `Basic <base64>`. Empty means "not signed in". */
  authHeader: string;
  /** Site-absolute in the mobile app; identity in the WP simulator. */
  absolutize?: (path: string) => string;
  onError: (message: string) => void;
  onInfo?: (message: string) => void;
  /** Called after a successful write, so the shell can refetch. */
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

/**
 * Which conversation the write is for.
 *
 * thread_id and space_slug are alternatives — the CHAT sub-tab only ever
 * knows a slug — and the endpoints take either, which is why nothing
 * here has to resolve one into the other first.
 */
function target(): Record<string, unknown> | null {
  const chat = getChatControls();
  if (chat.thread_id !== '') return { thread_id: Number(chat.thread_id) };
  if (chat.space_slug !== '') return { space_slug: chat.space_slug };
  // An intent is a target too, and the one case where the write CREATES
  // the conversation rather than posting to it. Handled by the caller —
  // see sendChatMessage — because it is a different endpoint and a
  // different body, not a different id.
  if (chat.intent_user_id !== '') return { intent_id: Number(chat.intent_user_id) };

  // Fall back to the route params. The two are written together by
  // chat.open, but the data sources read the route bag while the writes
  // read the slice, and only the route bag survives a screen restored
  // from outside that action — a deep link, or the simulator's screen
  // picker. Reading both means the composer cannot end up pointed at a
  // conversation the message list is not showing.
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
  /**
   * Where a DM that does not exist yet is created. FluentCommunity makes
   * the thread and posts the first message in one call, so this is a
   * different endpoint from the ordinary send — supplied by the action's
   * args like every other URL here.
   */
  createThreadEndpoint?: string;
  /**
   * Called with the id of the thread the create returned, so the shell
   * can adopt it: from the next send on, this is an ordinary
   * conversation.
   */
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

  // The create path. FluentCommunity's `createIntendedThread` looks for
  // an existing one-to-one thread first and appends to it, so this is
  // safe to call whether or not the two have spoken before — which is
  // also why the screen does not resolve a thread up front. Its body is
  // its own shape: `message`, not `text`, and no attachments (the
  // endpoint takes none).
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
    // FluentCommunity stores the quoted text verbatim rather than
    // re-reading the replied-to message, so we send back what the strip
    // was showing.
    body.reply_text = chat.reply_to_text;
  }

  // Clear optimistically. A send that fails restores the draft below —
  // leaving the text in place until the round trip lands makes a slow
  // connection look like a dead button, and the user types over it.
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

/**
 * Throw away a pending attachment, row and file.
 *
 * FluentCommunity creates the Media row at UPLOAD time, so an image the
 * user picks and then changes their mind about outlives the composer.
 * The endpoint refuses anything a sent message is already showing, so a
 * stale URL here cannot gut a conversation.
 *
 * The local list is cleared first either way: the thumbnail has to go
 * when it is tapped, and a failed sweep is the daily job's problem, not
 * something to make the user look at.
 */
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
      // Deliberately quiet: the thumbnail is already gone, the file is
      // invisible to the user, and the scheduled sweep will take it.
      // eslint-disable-next-line no-console
      console.warn('[appza] discarding the attachment failed:', messageFrom(json, res.status, ''));
    }
  } catch {
    // Same reasoning — never surface this.
  }
}

/**
 * Pick one image and upload it, holding the returned URL until the
 * message that carries it is sent.
 *
 * Two steps rather than one because FluentCommunity has nothing to
 * attach a Media row to until the message exists — the send call
 * re-resolves each URL back to its row.
 *
 * A hidden <input type="file"> rather than a native picker plugin: the
 * Android WebView routes it to the system chooser, which is the same
 * path the document picker already takes on a real device.
 */
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
          // No Content-Type: the browser has to set the multipart
          // boundary itself, and naming it here strips it.
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
