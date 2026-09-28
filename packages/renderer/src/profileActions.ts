import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { collectSocialLinks } from './AppzaSocialLinks';
import { collectProfileFields } from './AppzaProfileFields';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import { getProfileControls } from './profileControls';
import type { ActionInvocation } from './actionContext';

// notify_subscribe and notify_unsubscribe share one route: FC's endpoint is a true toggle, so direction comes from which button the catalog shows.

export type ProfileActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
};

const HANDLED = new Set([
  'user.follow',
  'user.unfollow',
  'user.notify_subscribe',
  'user.notify_unsubscribe',
  // Blocking is level 0 in FC's followers table, so it also unfollows; the refetch shows that.
  'profile.block',
  'profile.unblock',
]);

export function tryHandleProfileAction(
  inv: ActionInvocation,
  deps: ProfileActionDeps,
): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root
    ? (readDataPath(item, binding_root) ?? item)
    : item;
  const { auth, authHeader, onError, onInfo } = deps;

  const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
  const method =
    typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
  const bodyKey =
    typeof argRec.body_key === 'string' && argRec.body_key
      ? argRec.body_key
      : 'member_id';
  const memberIdPath =
    typeof argRec.member_id_path === 'string' && argRec.member_id_path
      ? argRec.member_id_path
      : 'data.user_id';
  const toast =
    typeof argRec.toast_message === 'string' ? argRec.toast_message : 'Updated';

  if (!endpoint) {
    onError(`${action_slug} is missing its endpoint.`);
    return true;
  }
  if (!auth) {
    onError('Please sign in.');
    return true;
  }

  const memberId = resolveMemberId(readDataPath(effectiveItem, memberIdPath));
  if (memberId === null) {
    onError('Could not identify whose profile this is.');
    return true;
  }

  void sendJson(endpoint, method, { [bodyKey]: memberId }, auth, authHeader).then(
    (result) => {
      if (result.ok) {
        onInfo(toast);
        dispatchRefresh();
      } else {
        onError(result.error);
      }
    },
  );
  return true;
}

// fcom-mobile takes an id or a username.
function resolveMemberId(raw: unknown): number | string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return null;
}

function dispatchRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

// param_map names children[N].value paths; if they drift from the form, every field saves as ''. A core contract test pins them.
export type ProfileSaveDeps = ProfileActionDeps & {
  collect: (
    appzetSlug: string,
    paramMap: Record<string, unknown> | undefined,
  ) => Record<string, unknown>;
  onSaved?: () => void;
};

export function tryHandleProfileSave(
  inv: ActionInvocation,
  deps: ProfileSaveDeps,
): boolean {
  if (inv.action_slug !== 'profile.save') return false;

  const argRec = (inv.args ?? {}) as Record<string, unknown>;
  const { auth, authHeader, onError, onInfo, collect, onSaved } = deps;

  const endpoint = typeof argRec.endpoint === 'string' ? argRec.endpoint : null;
  const method =
    typeof argRec.method === 'string' ? argRec.method.toUpperCase() : 'POST';
  const formSlug =
    typeof argRec.form_appzet_slug === 'string' && argRec.form_appzet_slug
      ? argRec.form_appzet_slug
      : 'fc-basic-profile-information';
  const paramMap =
    argRec.param_map && typeof argRec.param_map === 'object'
      ? (argRec.param_map as Record<string, unknown>)
      : undefined;
  const successMessage =
    typeof argRec.success_message === 'string'
      ? argRec.success_message
      : 'Profile updated';
  const backOnSuccess = argRec.back_on_success !== false;

  if (!endpoint) {
    onError('profile.save is missing its endpoint.');
    return true;
  }
  if (!auth) {
    onError('Please sign in.');
    return true;
  }
  if (!paramMap) {
    onError('profile.save has no fields to send.');
    return true;
  }

  const memberId = getProfileControls().member_id;
  if (!memberId) {
    onError('Could not identify whose profile this is.');
    return true;
  }

  const body: Record<string, unknown> = {
    member_id: memberId,
    ...collect(formSlug, paramMap),
  };

  // Every enabled provider is sent, empty ones too: updateProfile array_filters the object, so that is how a cleared link is removed.
  if (argRec.collect_social_links === true) {
    const social = collectSocialLinks();
    if (Object.keys(social).length > 0) body.social_links = social;
  }

  // Typed values matter: FC Pro's sanitizeFieldValue blanks a non-array multiselect, a non-numeric number and a non-Y-m-d date.
  if (argRec.collect_profile_fields === true) {
    const fields = collectProfileFields();
    if (Object.keys(fields).length > 0) body.custom_fields = fields;
  }

  void sendJson(endpoint, method, body, auth, authHeader).then((result) => {
    if (result.ok) {
      onInfo(successMessage);
      dispatchRefresh();
      if (backOnSuccess) onSaved?.();
    } else {
      onError(result.error);
    }
  });
  return true;
}
