import { readDataPath } from './dataFetch';
import type { ActionInvocation } from './actionContext';
import { openReportSheet, announceReportResult, type ReportReason } from './ReportSheet';

export type StoredAuthLike = { username: string; token: string };

export type PostMenuDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
};

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
    // FC gives a comment no URL; the proxy builds the post URL + #comment-<id>.
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

    // Every fcom-mobile comment route also needs the post's id, via `parent_body_key`.
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
      // Optimistic so a reopened menu shows the new state before the refetch lands.
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

    case 'comment.like': {
      const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
      const method =
        typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
      const bodyKey =
        typeof argRec.body_key === 'string' && argRec.body_key
          ? argRec.body_key
          : 'comment_id';
      const feedIdPath =
        typeof argRec.feed_id_path === 'string' ? argRec.feed_id_path : 'data.id';
      const stateBodyKey =
        typeof argRec.state_body_key === 'string' && argRec.state_body_key
          ? argRec.state_body_key
          : 'state';
      const currentStatePath =
        typeof argRec.current_state_path === 'string'
          ? argRec.current_state_path
          : 'data.liked';
      if (!endpoint) {
        onError('comment.like is missing its endpoint.');
        return true;
      }
      if (!auth) {
        onError('Please sign in to like a comment.');
        return true;
      }
      const commentId = resolveFeedId(feedIdPath, itemRec);
      if (commentId === null) {
        onError('Could not identify which comment to like.');
        return true;
      }
      // FC's toggleReaction removes the reaction when `state` is absent, so always send it.
      const rawLiked = readDataPath(effectiveItem, currentStatePath);
      const currentOn =
        rawLiked === 1 || rawLiked === '1' || rawLiked === true || rawLiked === 'yes';
      const body: Record<string, unknown> = {
        [bodyKey]: commentId,
        [stateBodyKey]: currentOn ? 0 : 1,
      };
      const parentBodyKey =
        typeof argRec.parent_body_key === 'string' && argRec.parent_body_key
          ? argRec.parent_body_key
          : 'feed_id';
      const parentPath =
        typeof argRec.parent_id_path === 'string' ? argRec.parent_id_path : 'data.post_id';
      const parentId = resolveFeedId(parentPath, itemRec);
      if (parentId === null) {
        // fcom-mobile 400s without it; fail here with a reason instead.
        onError('Could not identify which post this comment belongs to.');
        return true;
      }
      body[parentBodyKey] = parentId;
      void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
        if (result.ok) {
          dispatchRefreshFeed();
        } else {
          onError(result.error);
          dispatchRefreshFeed();
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
      if (argRec.presentation === 'sheet') {
        const errorMsg =
          typeof argRec.error_message === 'string' && argRec.error_message
            ? argRec.error_message
            : "Couldn't submit your report. Please try again.";
        if (argRec.from_report_sheet !== true) {
          const reasonsEndpoint =
            typeof argRec.reasons_endpoint === 'string' ? argRec.reasons_endpoint : '';
          const open = (reasons: ReportReason[]) =>
            openReportSheet({ reasons, item: effectiveItem, actionSlug: action_slug, args: argRec });
          const fallback = fallbackReasons.map((r) => ({ value: r, label: r }));
          if (!reasonsEndpoint) {
            open(fallback);
            return true;
          }
          void fetch(reasonsEndpoint, {
            credentials: 'omit',
            headers: { Accept: 'application/json', Authorization: authHeader(auth) },
          })
            .then((r) => r.json())
            .then((json: unknown) => {
              const items = isPlainObject(json) && isPlainObject(json.items) ? json.items : null;
              const reasons = items
                ? Object.entries(items).map(([value, label]) => ({ value, label: String(label) }))
                : [];
              open(reasons.length > 0 ? reasons : fallback);
            })
            .catch(() => open(fallback));
          return true;
        }
        const body: Record<string, unknown> = {
          [bodyKey]: feedId,
          content_type: contentType,
          [reasonBodyKey]: String(argRec.reason ?? ''),
        };
        if (typeof argRec.parent_body_key === 'string' && argRec.parent_body_key) {
          const parentId = resolveFeedId(
            typeof argRec.parent_id_path === 'string' ? argRec.parent_id_path : 'data.post_id',
            itemRec,
          );
          if (parentId !== null) body[argRec.parent_body_key] = parentId;
        }
        const explanation = typeof argRec.explanation === 'string' ? argRec.explanation.trim() : '';
        if (explanation) body[explanationBodyKey] = explanation;
        void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
          if (result.ok) {
            announceReportResult(true, '');
            onInfo(toastMsg);
          } else {
            announceReportResult(false, result.error || errorMsg);
          }
        });
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

/** fcom-mobile reports status inside a 200 envelope, so res.ok alone is not success. */
export async function sendJson(
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
  // navigator.clipboard is unavailable on insecure http origins; fall back to execCommand.
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

function applyOptimisticMutation(
  itemRec: Record<string, unknown> | null,
  currentStatePath: string | null,
  nextValue: number,
  actionSlug: string,
): () => void {
  if (!itemRec || !currentStatePath || !currentStatePath.startsWith('data.')) {
    return () => {};
  }
  const rel = currentStatePath.slice(5);
  const segs = rel.split('.');
  if (segs.length === 0) return () => {};

  // comments_disabled mirrors FC's 'yes'/'no' (visible_when compares 'yes'); the others are ints.
  const nextRepr =
    actionSlug === 'post.disable_comments' ? (nextValue ? 'yes' : 'no') : nextValue;

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
