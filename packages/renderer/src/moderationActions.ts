import type { ActionInvocation } from './actionContext';
import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { setModerationControls, isModerationStatus } from './moderationControls';
import { closeMemberRemoveConfirm, openMemberRemoveConfirm } from './MemberRemoveConfirm';
import {
  announceModerationDone,
  openModerationReview,
  type ModerationReviewAct,
} from './ModerationReviewSheet';
import { moderationReviewPresentation } from './modalPresentation';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';

// set_status and delete_report arrive twice: first they open the confirm, which re-dispatches with `confirmed` to write.

export type ModerationActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  readAppzetProps: (slug: string) => Record<string, unknown>;
  dispatch: (next: ActionInvocation) => void;
};

const HANDLED = new Set([
  'moderation.set_tab',
  'moderation.review',
  'moderation.set_status',
  'moderation.delete_report',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function openReview(
  argRec: Record<string, unknown>,
  itemRec: Record<string, unknown> | null,
  deps: ModerationActionDeps,
): void {
  const rec = itemRec ?? {};
  const fromReport = argRec.row_kind === 'report';
  const endpoint = str(argRec.endpoint) ?? '/wp-json/fcom-mobile/api/v1/moderation/reports';

  // FC Pro filters a post's reports by post_id and a comment's by parent_id, and answers a wrong key with every report on the site.
  const contentType = fromReport
    ? str(rec.content_type) ?? 'post'
    : str(argRec.content_type) ?? 'post';
  const idParam = fromReport
    ? contentType === 'comment' ? 'parent_id' : 'post_id'
    : str(argRec.id_param) ?? 'post_id';
  const contentId = readDataPath(
    rec,
    fromReport ? 'data.content_id' : str(argRec.id_path) ?? 'data.id',
  );
  if (typeof contentId !== 'number' && typeof contentId !== 'string') {
    deps.onError('Could not identify which content to review.');
    return;
  }

  const sheetSlug = str(argRec.sheet_appzet_slug) ?? 'fc-moderation-review';
  const presentation = moderationReviewPresentation(deps.readAppzetProps(sheetSlug));
  const xp = isRecord(rec.xprofile) ? rec.xprofile : undefined;
  const space = isRecord(rec.space) ? rec.space : undefined;

  const content = fromReport
    ? {
        title: str(rec.content_title),
        bodyHtml: str(rec.content_body_html),
        authorName: str(rec.author_name),
        authorAvatar: str(rec.author_avatar),
        spaceTitle: str(rec.space_title),
        reportedAt: str(rec.created_at_relative),
        mediaUrl: str(rec.content_media_url),
      }
    : {
        title: str(rec.title),
        bodyHtml: str(rec.message_rendered),
        authorName: xp ? str(xp.display_name) : undefined,
        authorAvatar: xp ? str(xp.avatar) : undefined,
        spaceTitle: space ? str(space.title) : undefined,
        reportedAt: str(rec.created_at),
      };

  const rawReportId = rec.id;
  const reportId =
    fromReport && (typeof rawReportId === 'number' || typeof rawReportId === 'string')
      ? rawReportId
      : undefined;

  openModerationReview({
    endpoint,
    idParam,
    contentId,
    contentType,
    content,
    presentation,
    authHeader: deps.auth ? deps.authHeader(deps.auth) : undefined,
    buttons: fromReport
      ? {
          dismiss: rec.review_can_dismiss === true,
          unpublish: rec.review_can_unpublish === true,
          publish: rec.review_can_publish === true,
          delete: rec.review_can_delete === true,
        }
      : undefined,
    reportId,
    onAct: (act: ModerationReviewAct, id) => {
      const slug = act === 'delete' ? presentation.deleteActionSlug : presentation.setStatusActionSlug;
      const copy = {
        dismiss: [presentation.dismissConfirmTitle, presentation.dismissConfirmMessage, presentation.dismissConfirmCta],
        unpublish: [presentation.unpublishConfirmTitle, presentation.unpublishConfirmMessage, presentation.unpublishConfirmCta],
        publish: [presentation.publishConfirmTitle, presentation.publishConfirmMessage, presentation.publishConfirmCta],
        delete: [presentation.deleteConfirmTitle, presentation.deleteConfirmMessage, presentation.deleteConfirmCta],
      }[act];
      // Publish sends `ignored`, same as Dismiss.
      const status = act === 'unpublish' ? 'unpublished' : act === 'delete' ? undefined : 'ignored';
      deps.dispatch({
        action_slug: slug,
        args: {
          ...(readActionDefaultsFromCatalog(slug) ?? {}),
          ...(status ? { status } : {}),
          confirm_title: copy[0],
          confirm_message: copy[1],
          confirm_cta: copy[2],
        },
        // The write resolves `data.id`, and the id it needs is the report's.
        item: { id },
      });
    },
  });
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function tryHandleModerationAction(
  inv: ActionInvocation,
  deps?: ModerationActionDeps,
): boolean {
  const { action_slug, args, item } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const itemRec = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;

  if (action_slug === 'moderation.set_tab') {
    // The tapped value arrives on args from some primitives and on the item from others.
    const runtimeValue =
      typeof argRec.value === 'string'
        ? argRec.value
        : itemRec && typeof itemRec.value === 'string'
          ? itemRec.value
          : null;
    if (isModerationStatus(runtimeValue)) setModerationControls({ status: runtimeValue });
    return true;
  }

  if (action_slug === 'moderation.review') {
    if (deps) openReview(argRec, itemRec, deps);
    return true;
  }

  const isDelete = action_slug === 'moderation.delete_report';
  const status = str(argRec.status);
  if (!isDelete && !isModerationStatus(status)) {
    deps?.onError('This moderation action has no status wired.');
    return true;
  }

  if (argRec.confirmed !== true) {
    const rest = { ...argRec };
    delete rest.confirmed;
    openMemberRemoveConfirm({
      subject: str(argRec.confirm_title) ?? (isDelete ? 'Delete Report' : 'Are you sure?'),
      message: str(argRec.confirm_message) ?? '',
      cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
      confirmLabel: str(argRec.confirm_cta) ?? (isDelete ? 'YES, DELETE' : 'YES'),
      busyLabel: str(argRec.busy_label) ?? 'Saving…',
      actionsLayout: 'material',
      confirmTone: 'primary',
      raised: true,
      item,
      removeActionSlug: action_slug,
      removeArgs: { ...rest, confirmed: true },
    });
    return true;
  }

  // The id is the report's, bound as `data.id` on a row and passed as `{ id }` by the review modal.
  const rawId = readDataPath(item, str(argRec.feed_id_path) ?? 'data.id');
  const reportId =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string' && rawId !== '' && Number.isFinite(Number(rawId))
        ? Number(rawId)
        : null;
  const endpoint = str(argRec.endpoint);
  if (!endpoint || reportId === null) {
    deps?.onError('Could not identify which report to change.');
    closeMemberRemoveConfirm();
    return true;
  }
  if (!deps?.auth) {
    deps?.onError('Please sign in to moderate.');
    closeMemberRemoveConfirm();
    return true;
  }

  const method = (str(argRec.method) ?? (isDelete ? 'DELETE' : 'POST')).toUpperCase();
  // fcom-mobile reads report_id from the JSON body even on DELETE.
  const body: Record<string, unknown> = { [str(argRec.body_key) ?? 'report_id']: reportId };
  if (!isDelete) body.status = status;

  void sendJson(endpoint, method, body, deps.auth, deps.authHeader)
    .then((result) => {
      if (!result.ok) {
        deps.onError(result.error);
        return;
      }
      announceModerationDone();
      // Forced past the preview cache: the proxy may still hold this tab's pre-write page.
      if (typeof window !== 'undefined') {
        const g = window as unknown as { __appzaForceRefreshUntil?: number };
        g.__appzaForceRefreshUntil = Date.now() + 3000;
        window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
      }
    })
    .finally(() => {
      closeMemberRemoveConfirm();
    });
  return true;
}
