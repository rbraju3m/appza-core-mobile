import type { CSSProperties } from 'react';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import { fetchDataSourceOnce } from './dataFetch';
import { openOptionsSheet, type OptionsSheetSection } from './OptionsSheet';
import { optionsSheetPresentation } from './modalPresentation';
import type { ViewModeOption } from './ViewModePopover';

// A space asks for a role before the write; a course has no roles, so picking one writes straight away.

export type ProfileAddToSpaceDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  requireAuth: () => void;
  readPath: (item: unknown, path: string) => unknown;
  sheetProps: (slug: string) => Record<string, unknown>;
  sheetChildStyles: (slug: string) => Record<number, CSSProperties>;
};

type Row = { value: string; label: string; slug: string };

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function rowsOf(v: unknown): Row[] {
  return (Array.isArray(v) ? v : [])
    .map(rec)
    .map((r) => ({
      value: str(r.id) ?? (typeof r.id === 'number' ? String(r.id) : ''),
      label: str(r.title) ?? '',
      slug: str(r.slug) ?? '',
    }))
    .filter((r) => r.value && r.label);
}

function rolesOf(v: unknown): ViewModeOption[] {
  const roles = (Array.isArray(v) ? v : [])
    .map(rec)
    .map((r) => ({ value: str(r.value) ?? '', label: str(r.label) ?? '', icon: str(r.icon) }))
    .filter((r) => r.value && r.label);
  // FluentCommunity's own three, in its order.
  return roles.length
    ? (roles as ViewModeOption[])
    : [
        { value: 'member', label: 'Member' },
        { value: 'moderator', label: 'Moderator' },
        { value: 'admin', label: 'Admin' },
      ];
}

export function openProfileAddToSpace(
  args: Record<string, unknown>,
  item: unknown,
  deps: ProfileAddToSpaceDeps,
): void {
  const { auth } = deps;
  if (!auth) {
    deps.requireAuth();
    return;
  }

  const rawMember = deps.readPath(item, str(args.member_id_path) ?? 'data.user_id');
  const memberId =
    typeof rawMember === 'number' || (typeof rawMember === 'string' && rawMember !== '')
      ? rawMember
      : null;
  if (memberId === null) {
    deps.onError('Could not identify which member to add.');
    return;
  }
  const eyebrowPath = str(args.eyebrow_path);
  const eyebrowRaw = eyebrowPath ? deps.readPath(item, eyebrowPath) : undefined;
  const eyebrow = typeof eyebrowRaw === 'string' ? eyebrowRaw : undefined;

  const listSlug = str(args.sheet_appzet_slug) ?? 'fc-profile-space-sheet';
  const roleSlug = str(args.role_sheet_appzet_slug) ?? 'fc-profile-role-sheet';
  const optionsDs = str(args.options_data_source) ?? 'fc-profile-add-to-options';
  const spaceEndpoint = str(args.endpoint) ?? '/wp-json/fcom-mobile/api/v1/spaces/add-member';
  const courseEndpoint = str(args.course_endpoint) ?? '/wp-json/fcom-mobile/api/v1/courses/student/add';
  const spaceToast = str(args.toast_message) ?? 'Added to space';
  const courseToast = str(args.course_toast_message) ?? 'Added to course';
  const emptyMessage =
    str(args.empty_message) ?? 'This member is already in every space and course.';

  const write = (endpoint: string, body: Record<string, unknown>, toast: string, label: string) => {
    void sendJson(endpoint, 'POST', body, auth, deps.authHeader).then((result) => {
      if (result.ok) deps.onInfo(`${toast}: ${label}`);
      else deps.onError(result.error);
    });
  };

  const openRoles = (space: Row) => {
    openOptionsSheet({
      appzetSlug: roleSlug,
      presentation: optionsSheetPresentation(deps.sheetProps(roleSlug)),
      childStyles: deps.sheetChildStyles(roleSlug),
      eyebrow,
      options: rolesOf(args.roles),
      // An act, not a setting: no row is checked.
      stateKey: 'profile_follow_sort',
      currentValue: '',
      onPick: (role) =>
        write(spaceEndpoint, { space_slug: space.slug, user_id: memberId, role }, spaceToast, space.label),
    });
  };

  void fetchDataSourceOnce(optionsDs, { user_id: memberId }, { bypassCache: true })
    .then((json) => {
      const items = Array.isArray(json) ? json : Array.isArray(rec(json).items) ? (rec(json).items as unknown[]) : [];
      const wrapper = rec(items[0]);
      const spaces = rowsOf(wrapper.spaces).filter((r) => r.slug);
      const courses = rowsOf(wrapper.courses);
      if (spaces.length === 0 && courses.length === 0) {
        deps.onInfo(emptyMessage);
        return;
      }

      const sections: OptionsSheetSection[] = [];
      if (spaces.length) {
        const icon = str(args.space_icon);
        sections.push({
          title: str(args.spaces_heading) ?? 'SPACES',
          options: spaces.map((r) => ({ value: r.value, label: r.label, icon })),
          currentValue: '',
          onPick: (value) => {
            const space = spaces.find((r) => r.value === value);
            if (space) openRoles(space);
          },
        });
      }
      if (courses.length) {
        const icon = str(args.course_icon);
        sections.push({
          title: str(args.courses_heading) ?? 'COURSES',
          options: courses.map((r) => ({ value: r.value, label: r.label, icon })),
          currentValue: '',
          onPick: (value, label) =>
            write(courseEndpoint, { course_id: Number(value), user_id: memberId }, courseToast, label),
        });
      }

      openOptionsSheet({
        appzetSlug: listSlug,
        presentation: optionsSheetPresentation(deps.sheetProps(listSlug)),
        childStyles: deps.sheetChildStyles(listSlug),
        eyebrow,
        options: [],
        stateKey: 'profile_follow_sort',
        currentValue: '',
        sections,
      });
    })
    .catch(() => deps.onError('Could not load the spaces and courses.'));
}
