import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';
import { closeMemberRemoveConfirm, openMemberRemoveConfirm } from './MemberRemoveConfirm';

// An empty string removes a picture. The upload alone attaches nothing: FC activates the Media row only when the URL is saved to the profile.

export type ProfilePhotoActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
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

function isPhotoField(v: unknown): v is 'avatar' | 'cover_photo' {
  return v === 'avatar' || v === 'cover_photo';
}

function dispatchRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

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
          deps.onError(result.error);
          return;
        }
        deps.onInfo(
          str(argRec.toast_message) ??
            (url === '' ? `Your ${noun} has been removed` : `Your ${noun} has been updated`),
        );
        // The write bumps the preview-cache generation, so the refetch sees the new picture.
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
        // One picture: the shared picker is multi-select, so only the first URL is used.
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
        // The confirm re-dispatches, so everything the writer needs must travel on its args.
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
