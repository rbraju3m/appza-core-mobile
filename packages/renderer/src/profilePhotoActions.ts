import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';
import { closeMemberRemoveConfirm, openMemberRemoveConfirm } from './MemberRemoveConfirm';

/**
 * The profile's two pictures — doc states 2 to 5.
 *
 * ---------------------------------------------------------------------
 * One endpoint, one shape, and an empty string for "remove"
 * ---------------------------------------------------------------------
 *
 * FluentCommunity takes the avatar and the cover through the same call:
 * `PUT /profile/{username}` with `data.avatar` or `data.cover_photo`,
 * which fcom-mobile forwards verbatim from `/members/photo-update`. A URL
 * sets the picture; an EMPTY STRING removes it, and patchProfile sweeps
 * the old Media row on the way out. So set and remove differ only in the
 * value, and the avatar and the cover differ only in the key — which is
 * why `field` is a parameter and there is one writer here, not four.
 *
 * ---------------------------------------------------------------------
 * Why changing a picture is two requests
 * ---------------------------------------------------------------------
 *
 * The upload alone attaches the picture to nothing. FluentCommunity
 * resolves the URL back to its Media row with `Helper::getMediaFromUrl`
 * at SAVE time and marks it active then; an uploaded-but-unsaved row is
 * inactive and gets swept. So the picker uploads, and its sink writes the
 * returned URL to the profile. Abandoning the flow half way leaves an
 * inactive row FluentCommunity cleans up itself — the same posture the
 * comment composer's attachments already take.
 *
 * The picker itself is the SHELL's: it needs a mounted file input. Each
 * shell passes its own `pickImage`, which is the only part of this that
 * could not live in the renderer.
 */

export type ProfilePhotoActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  /** The shell's file picker. Uploads, then hands back the URLs. */
  pickImage: (target: {
    endpoint: string;
    method: string;
    accept?: string;
    onStart?: () => void;
    sink?: (urls: string[]) => void;
    onFail?: () => void;
  }) => void;
};

const HANDLED = new Set([
  'profile.change_photo',
  'profile.remove_photo',
  'profile.remove_photo_confirm',
]);

const UPLOAD_ENDPOINT = '/wp-json/fcom-mobile/api/v1/feeds/media-upload';
const SAVE_ENDPOINT = '/wp-json/fcom-mobile/api/v1/members/photo-update';

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** The two keys FluentCommunity's patchProfile recognises as pictures. */
function isPhotoField(v: unknown): v is 'avatar' | 'cover_photo' {
  return v === 'avatar' || v === 'cover_photo';
}

function dispatchRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

/** Returns true when the action was one of these and has been handled. */
export function tryHandleProfilePhotoAction(
  inv: ActionInvocation,
  deps: ProfilePhotoActionDeps,
): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;

  const field = argRec.field;
  if (!isPhotoField(field)) {
    deps.onError('This picture action has no field wired.');
    return true;
  }

  const memberIdPath = str(argRec.member_id_path) ?? 'data.user_id';
  const rawId = readDataPath(effectiveItem, memberIdPath);
  const memberId =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string' && rawId !== '' && Number.isFinite(Number(rawId))
        ? Number(rawId)
        : null;

  const saveEndpoint = str(argRec.save_endpoint) ?? SAVE_ENDPOINT;
  const method = (str(argRec.method) ?? 'POST').toUpperCase();
  const noun = field === 'avatar' ? 'profile photo' : 'cover';

  /**
   * The one write. `url` is a media URL to set it, or '' to remove it.
   * `closeConfirm` is true only on the remove path, where a dialog is
   * waiting on the result.
   */
  const save = (url: string, closeConfirm: boolean): void => {
    if (memberId === null) {
      deps.onError(`Could not update this ${noun} — no member.`);
      if (closeConfirm) closeMemberRemoveConfirm();
      return;
    }
    if (!deps.auth) {
      deps.onError('Please sign in.');
      if (closeConfirm) closeMemberRemoveConfirm();
      return;
    }

    void sendJson(
      saveEndpoint,
      method,
      { member_id: memberId, [field]: url },
      deps.auth,
      deps.authHeader,
    )
      .then((result) => {
        if (!result.ok) {
          // FluentCommunity's own sentence — "Invalid media image. Please
          // upload a new one." — says more than anything here could.
          deps.onError(result.error);
          return;
        }
        deps.onInfo(
          str(argRec.toast_message) ??
            (url === '' ? `Your ${noun} has been removed` : `Your ${noun} has been updated`),
        );
        // The write bumps the viewer's preview-cache generation, so the
        // refetch reads the new picture rather than the cached one.
        dispatchRefresh();
      })
      .finally(() => {
        if (closeConfirm) closeMemberRemoveConfirm();
      });
  };

  switch (action_slug) {
    case 'profile.change_photo': {
      deps.pickImage({
        endpoint: str(argRec.upload_endpoint) ?? UPLOAD_ENDPOINT,
        method: 'POST',
        accept: str(argRec.accept) ?? 'image/*',
        // ONE picture, so only the first URL is used. The picker is
        // shared with the composer, which is multi-select; a member who
        // picks three covers gets the first and no error, which is what
        // every gallery does.
        sink: (urls: string[]) => {
          const url = urls.find((u) => typeof u === 'string' && u !== '');
          if (!url) {
            deps.onError(str(argRec.error_message) ?? 'The image could not be uploaded.');
            return;
          }
          save(url, false);
        },
        onFail: () => {
          deps.onError(str(argRec.error_message) ?? 'The image could not be uploaded.');
        },
      });
      return true;
    }

    case 'profile.remove_photo': {
      save('', true);
      return true;
    }

    case 'profile.remove_photo_confirm': {
      // Design 5: a bold question, one line under it, CANCEL and REMOVE
      // side by side. No member name — unlike the member dialogs, the
      // title IS the whole question, so `subject` carries it.
      //
      // Both buttons are drawn alike in the design, so the tone is
      // 'primary' rather than destructive. Removing a cover is undone by
      // uploading another one.
      openMemberRemoveConfirm({
        subject: str(argRec.title) ?? 'Remove cover?',
        message: str(argRec.message) ?? 'This removes your current photo.',
        cancelLabel: str(argRec.cancel_label) ?? 'CANCEL',
        confirmLabel: str(argRec.confirm_label) ?? 'REMOVE',
        busyLabel: str(argRec.busy_label) ?? 'Removing…',
        actionsLayout: 'material',
        confirmTone: 'primary',
        item: effectiveItem,
        removeActionSlug: str(argRec.remove_action_slug) ?? 'profile.remove_photo',
        // The confirm dispatches back through the shared dispatcher, so
        // everything the writer needs has to travel with it — the dialog
        // has no memory of the row it was opened from beyond `item`.
        removeArgs: {
          field,
          save_endpoint: saveEndpoint,
          method,
          member_id_path: memberIdPath,
          ...(str(argRec.toast_message) ? { toast_message: argRec.toast_message } : {}),
        },
      });
      return true;
    }
  }

  return false;
}
