import { readDataPath } from './dataFetch';
import type { ActionInvocation } from './actionContext';

/**
 * Shared implementation of the five catalog-driven post-menu actions —
 * copy_link, pin_top, pin_sidebar, disable_comments, report.
 *
 * Both the Capacitor mobile shell + the WP-admin simulator's app-mode
 * dispatcher call {@link tryHandlePostMenuAction} from their post.*
 * cases; keeping the logic here means the two dispatchers never drift.
 * `post.options` (opens the popover) + `post.delete` (uses each app's
 * own confirm-modal state) stay in the app-side dispatchers because
 * they need shell-specific DOM/state helpers. `post.edit` also lives in
 * each app's dispatcher — it navigates to edit-post-page and dispatches
 * from that screen's appbar CTA with form access.
 */

export type StoredAuthLike = { username: string; token: string };

export type PostMenuDeps = {
  /** Currently signed-in user (Basic Auth). Null when no session. */
  auth: StoredAuthLike | null;
  /** Basic-auth header builder — each shell owns its own to stay isolated. */
  authHeader: (auth: StoredAuthLike) => string;
  /** Red toast for failures. */
  onError: (msg: string) => void;
  /** Green/info toast for successful operations. */
  onInfo: (msg: string) => void;
};

/**
 * Returns true when the action_slug is one of the six handled here and
 * has been dispatched. Callers should return early on `true`.
 */
export function tryHandlePostMenuAction(
  inv: ActionInvocation,
  deps: PostMenuDeps,
): boolean {
  const { action_slug, args, item, binding_root } = inv;
  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root
    ? (readDataPath(item, binding_root) ?? item)
    : item;
  const itemRec = isPlainObject(effectiveItem) ? effectiveItem : null;
  const { auth, authHeader, onError, onInfo } = deps;

  switch (action_slug) {
    // A COMMENT link is the post's URL with a #comment-<id> anchor,
    // which the preview proxy builds — FluentCommunity gives a comment no
    // URL of its own. Same code path, different default path.
    case 'comment.copy_link':
    case 'post.copy_link': {
      const urlPath =
        typeof argRec.url_path === 'string'
          ? argRec.url_path
          : typeof argRec.link_path === 'string'
            ? argRec.link_path
            : 'data.permalink';
      const toastMsg =
        typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Link copied';
      const url = readDataPath(effectiveItem, urlPath);
      if (typeof url !== 'string' || !url) {
        onError(
          action_slug === 'comment.copy_link'
            ? 'This comment has no shareable link.'
            : 'This post has no shareable link.',
        );
        return true;
      }
      void copyToClipboard(String(url), onInfo, onError, toastMsg);
      return true;
    }

    // `comment.pin` is the same request shape as the three post toggles:
    // flip a flag, send the id, refresh. It differs only in needing a
    // SECOND id — every fcom-mobile comment route wants the post's id
    // alongside the comment's — which `parent_body_key` supplies.
    case 'comment.pin':
    case 'post.pin_top':
    case 'post.pin_sidebar':
    case 'post.disable_comments': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method =
        typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key
          ? argRec.body_key
          : 'feed_id';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const patchKey = typeof argRec.patch_key === 'string' ? argRec.patch_key : null;
      const currentStatePath =
        typeof argRec.current_state_path === 'string'
          ? argRec.current_state_path
          : null;
      const toastOn =
        typeof argRec.toast_on_message === 'string'
          ? argRec.toast_on_message
          : 'Updated';
      const toastOff =
        typeof argRec.toast_off_message === 'string'
          ? argRec.toast_off_message
          : 'Updated';
      if (!endpoint || !patchKey) {
        onError(`${action_slug} is missing its endpoint or patch_key.`);
        return true;
      }
      if (!auth) {
        onError('Please sign in.');
        return true;
      }
      const feedId = resolveFeedId(feedIdPath, itemRec);
      if (feedId === null) {
        onError('Could not identify which post to update.');
        return true;
      }
      const rawState = currentStatePath
        ? readDataPath(effectiveItem, currentStatePath)
        : null;
      const currentOn =
        rawState === 'yes' ||
        rawState === 1 ||
        rawState === '1' ||
        rawState === true;
      const nextValue = currentOn ? 0 : 1;
      const body: Record<string, unknown> = {
        [bodyKey]: feedId,
        [patchKey]: nextValue,
      };
      // The parent id, when the action declares one. A comment route is
      // addressed by BOTH ids; a post route declares neither key and this
      // is a no-op.
      const parentBodyKey =
        typeof argRec.parent_body_key === 'string' && argRec.parent_body_key
          ? argRec.parent_body_key
          : null;
      if (parentBodyKey) {
        const parentPath =
          typeof argRec.parent_id_path === 'string' ? argRec.parent_id_path : 'data.post_id';
        const parentId = resolveFeedId(parentPath, itemRec);
        if (parentId === null) {
          onError('Could not identify which post this comment belongs to.');
          return true;
        }
        body[parentBodyKey] = parentId;
      }
      // Optimistically update the tapped item so if the user immediately
      // reopens the menu (before the refetch lands) the label + toggle
      // direction reflect the new state. FC stores comments_disabled as
      // 'yes'/'no' inside meta; is_sticky/priority are 0/1 top-level
      // columns — mirrorAssignFromPath handles both shapes.
      const revert = applyOptimisticMutation(itemRec, currentStatePath, nextValue, action_slug);
      void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
        if (result.ok) {
          onInfo(nextValue ? toastOn : toastOff);
          dispatchRefreshFeed();
        } else {
          revert();
          onError(result.error);
        }
      });
      return true;
    }

    case 'comment.report':
    case 'post.report': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method =
        typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key
          ? argRec.body_key
          : 'post_id';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const contentType =
        typeof argRec.content_type === 'string'
          ? argRec.content_type
          : typeof argRec.content_type_value === 'string'
            ? argRec.content_type_value
            : action_slug === 'comment.report'
              ? 'comment'
              : 'post';
      const reasonBodyKey =
        typeof argRec.reason_body_key === 'string' ? argRec.reason_body_key : 'reason';
      const explanationBodyKey =
        typeof argRec.explanation_body_key === 'string'
          ? argRec.explanation_body_key
          : 'explanation';
      const fallbackReasons = Array.isArray(argRec.reasons_fallback)
        ? (argRec.reasons_fallback as unknown[]).filter(
            (r): r is string => typeof r === 'string',
          )
        : ['spam', 'harassment', 'offensive', 'incorrect_space', 'against_community', 'other'];
      const toastMsg =
        typeof argRec.toast_message === 'string'
          ? argRec.toast_message
          : 'Report submitted';
      if (!endpoint) {
        onError(`${action_slug} is missing its endpoint.`);
        return true;
      }
      if (!auth) {
        onError('Please sign in to report.');
        return true;
      }
      const feedId = resolveFeedId(feedIdPath, itemRec);
      if (feedId === null) {
        onError('Could not identify which post to report.');
        return true;
      }
      const reasonPrompt =
        'Report reason:\n' +
        fallbackReasons.map((r, i) => `  ${i + 1}. ${r}`).join('\n') +
        '\n\nEnter the number or type the reason slug:';
      const reasonRaw = window.prompt(reasonPrompt) ?? '';
      const reasonTrimmed = reasonRaw.trim();
      if (!reasonTrimmed) return true;
      const idx = Number(reasonTrimmed);
      const reason =
        Number.isInteger(idx) && idx >= 1 && idx <= fallbackReasons.length
          ? fallbackReasons[idx - 1]
          : reasonTrimmed;
      const explanation = window.prompt('Add an explanation (optional):') ?? '';
      const body: Record<string, unknown> = {
        [bodyKey]: feedId,
        content_type: contentType,
        [reasonBodyKey]: reason,
      };
      // Reporting a COMMENT names the post it sits under as well.
      const reportParentKey =
        typeof argRec.parent_body_key === 'string' && argRec.parent_body_key
          ? argRec.parent_body_key
          : null;
      if (reportParentKey) {
        const parentId = resolveFeedId(
          typeof argRec.parent_id_path === 'string' ? argRec.parent_id_path : 'data.post_id',
          itemRec,
        );
        if (parentId !== null) body[reportParentKey] = parentId;
      }
      if (explanation.trim()) body[explanationBodyKey] = explanation.trim();
      void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
        if (result.ok) onInfo(toastMsg);
        else onError(result.error);
      });
      return true;
    }

    default:
      return false;
  }
}

// ── Local helpers ────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function resolveFeedId(
  feedIdPath: string,
  itemRec: Record<string, unknown> | null,
): number | null {
  const key = feedIdPath.startsWith('data.') ? feedIdPath.slice(5) : feedIdPath;
  const raw = itemRec ? itemRec[key] : undefined;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return null;
}

type SendResult = { ok: true; body: unknown } | { ok: false; error: string };

async function sendJson(
  endpoint: string,
  method: string,
  body: Record<string, unknown>,
  auth: StoredAuthLike,
  authHeader: (auth: StoredAuthLike) => string,
): Promise<SendResult> {
  try {
    const res = await fetch(endpoint, {
      method,
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader(auth),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    const status =
      json && typeof json === 'object' && 'response' in json
        ? ((json as Record<string, unknown>).response as
            | Record<string, unknown>
            | undefined)
        : undefined;
    const bodyOk = !status || status.status === 200;
    if (!res.ok || !bodyOk) {
      const msg =
        (status && typeof status.message === 'string' && status.message) ||
        `Request failed (HTTP ${res.status})`;
      return { ok: false, error: msg };
    }
    return { ok: true, body: json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function copyToClipboard(
  url: string,
  onInfo: (msg: string) => void,
  onError: (msg: string) => void,
  toastMsg: string,
): Promise<void> {
  // Prefer the async Clipboard API. Fall back to the execCommand textarea
  // trick on HTTP origins where navigator.clipboard is either undefined
  // or blocked by the insecure-context guard — plugin-admin in WP admin
  // is served over plain http:// on many dev installs.
  const writeViaLegacy = (): boolean => {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };
  let copied = false;
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = writeViaLegacy();
    }
  } else {
    copied = writeViaLegacy();
  }
  if (copied) onInfo(toastMsg);
  else onError('Could not copy the link — try selecting it manually.');
}

function dispatchRefreshFeed(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('appza:refresh-data'));
}

/**
 * Locally mutate the tapped item's toggle-state field so a re-open of
 * the popover before the refetch lands sees the new value. Comments
 * disabled paths walk into `data.meta.<key>` (FC stores the flag as
 * 'yes'/'no' inside the JSON meta blob); is_sticky / priority live at
 * `data.<key>` as ints. Returns a revert callback the caller uses if
 * the server rejects the change.
 */
function applyOptimisticMutation(
  itemRec: Record<string, unknown> | null,
  currentStatePath: string | null,
  nextValue: number,
  actionSlug: string,
): () => void {
  if (!itemRec || !currentStatePath || !currentStatePath.startsWith('data.')) {
    return () => {};
  }
  const rel = currentStatePath.slice(5); // drop `data.`
  const segs = rel.split('.');
  if (segs.length === 0) return () => {};

  // For comments_disabled we mirror FC's on-disk representation ('yes'/'no')
  // — the visible_when clauses in the SS compare against 'yes'. For
  // is_sticky / priority we store the int the server persists.
  const nextRepr =
    actionSlug === 'post.disable_comments' ? (nextValue ? 'yes' : 'no') : nextValue;

  // Walk to the parent, ensuring intermediate objects exist. Record the
  // previous value so we can revert on failure.
  let parent: Record<string, unknown> = itemRec;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    const next = parent[seg];
    if (typeof next !== 'object' || next === null) {
      parent[seg] = {};
    }
    parent = parent[seg] as Record<string, unknown>;
  }
  const leaf = segs[segs.length - 1]!;
  const prev = parent[leaf];
  parent[leaf] = nextRepr;

  return () => {
    parent[leaf] = prev;
  };
}
