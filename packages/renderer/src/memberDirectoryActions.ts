import { readDataPath, APPZA_REFRESH_EVENT } from './dataFetch';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import type { ActionInvocation } from './actionContext';
import { debounceSearch } from './searchDebounce';
import {
  getMemberDirectoryControls,
  setMemberDirectoryControls,
  type MemberDirectoryStatus,
} from './memberDirectoryControls';
import { openOptionsSheet, OPTIONS_SHEET_CHILD_COUNT } from './OptionsSheet';
import { readPickerOptions } from './ViewModePopover';
import { childStylesFromCustomizations, optionsSheetPresentation } from './modalPresentation';
import { closeMemberRemoveConfirm, openMemberRemoveConfirm } from './MemberRemoveConfirm';

// Follow/unfollow are not here: they are user.follow / user.unfollow, handled by tryHandleProfile.

export type MemberDirectoryActionDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  readAppzetProps: (slug: string) => Record<string, unknown>;
  customizations: unknown;
};

const HANDLED = new Set([
  'members.set_search',
  'members.set_tab',
  'members.set_sort',
  'member.status_confirm',
  'member.set_status',
]);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function isStatus(v: unknown): v is MemberDirectoryStatus {
  return v === 'active' || v === 'pending' || v === 'blocked' || v === 'deactivated';
}

function dispatchRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APPZA_REFRESH_EVENT));
}

export function tryHandleMemberDirectoryAction(
  inv: ActionInvocation,
  deps: MemberDirectoryActionDeps,
): boolean {
  const { action_slug, args, item, binding_root } = inv;
  if (!HANDLED.has(action_slug)) return false;

  const argRec = (args ?? {}) as Record<string, unknown>;
  const effectiveItem = binding_root ? (readDataPath(item, binding_root) ?? item) : item;
  const itemRec =
    effectiveItem && typeof effectiveItem === 'object'
      ? (effectiveItem as Record<string, unknown>)
      : null;
  // A runtime value arrives on args from some primitives and on the item from others.
  const runtimeValue =
    typeof argRec.value === 'string'
      ? argRec.value
      : itemRec && typeof itemRec.value === 'string'
        ? itemRec.value
        : null;

  switch (action_slug) {
    case 'members.set_search': {
      debounceSearch('members', runtimeValue ?? '', (search) =>
        setMemberDirectoryControls({ search }),
      );
      return true;
    }

    case 'members.set_tab': {
      // A closed set: sent to FluentCommunity as `status`, and the empty states gate on it.
      if (isStatus(runtimeValue)) setMemberDirectoryControls({ status: runtimeValue });
      return true;
    }

    case 'members.set_sort': {
      const sortOptions = readPickerOptions(argRec.options);
      const orderOptions = readPickerOptions(argRec.order_options);
      if (sortOptions.length === 0) {
        deps.onError('This control has no options wired.');
        return true;
      }
      const sheetSlug = str(argRec.sheet_appzet_slug) ?? 'fc-members-sort-sheet';
      const current = getMemberDirectoryControls();
      openOptionsSheet({
        appzetSlug: sheetSlug,
        presentation: optionsSheetPresentation(deps.readAppzetProps(sheetSlug)),
        childStyles: childStylesFromCustomizations(
          sheetSlug,
          OPTIONS_SHEET_CHILD_COUNT,
          deps.customizations,
        ),
        options: [],
        stateKey: 'member_directory_sort_by',
        currentValue: current.sort_by,
        sections: [
          {
            title: str(argRec.sort_section_title),
            options: sortOptions,
            stateKey: 'member_directory_sort_by',
            currentValue: current.sort_by,
          },
          ...(orderOptions.length > 0
            ? [
                {
                  title: str(argRec.order_section_title),
                  options: orderOptions,
                  stateKey: 'member_directory_sort_dir' as const,
                  currentValue: current.sort_dir,
                },
              ]
            : []),
        ],
      });
      return true;
    }

    case 'member.status_confirm': {
      const subjectPath = str(argRec.subject_path) ?? 'data.display_name';
      const rawSubject = readDataPath(effectiveItem, subjectPath);
      const status = str(argRec.status);
      if (!isStatus(status)) {
        deps.onError('This status change has no status wired.');
        return true;
      }
      openMemberRemoveConfirm({
        subject: typeof rawSubject === 'string' && rawSubject ? rawSubject : 'Member',
        message: str(argRec.message),
        cancelLabel: str(argRec.cancel_label),
        confirmLabel: str(argRec.confirm_label),
        busyLabel: str(argRec.busy_label),
        actionsLayout: argRec.actions_layout === 'row' || argRec.actions_layout === 'stacked'
          ? argRec.actions_layout
          : 'material',
        confirmTone: argRec.confirm_tone === 'destructive' ? 'destructive' : 'primary',
        item: effectiveItem,
        removeActionSlug: str(argRec.remove_action_slug) ?? 'member.set_status',
        removeArgs: {
          status,
          ...(str(argRec.then_tab) ? { then_tab: argRec.then_tab } : {}),
        },
      });
      return true;
    }

    case 'member.set_status': {
      const endpoint = str(argRec.endpoint);
      const method = (str(argRec.method) ?? 'POST').toUpperCase();
      const status = str(argRec.status);
      const memberIdPath = str(argRec.member_id_path) ?? 'data.user_id';
      const rawId = readDataPath(effectiveItem, memberIdPath);
      const memberId =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && rawId !== '' && Number.isFinite(Number(rawId))
            ? Number(rawId)
            : null;

      if (!endpoint || !isStatus(status) || memberId === null) {
        deps.onError('Could not change this member — missing endpoint, status or member.');
        closeMemberRemoveConfirm();
        return true;
      }
      if (!deps.auth) {
        deps.onError('Please sign in.');
        closeMemberRemoveConfirm();
        return true;
      }

      void sendJson(endpoint, method, { member_id: memberId, status }, deps.auth, deps.authHeader)
        .then((result) => {
          if (!result.ok) {
            deps.onError(result.error);
            return;
          }
          deps.onInfo(str(argRec.toast_message) ?? 'Member status has been updated');
          // The write bumps the preview-cache generation, so the refetch reads the new status.
          const thenTab = str(argRec.then_tab) ?? status;
          if (isStatus(thenTab)) setMemberDirectoryControls({ status: thenTab });
          dispatchRefresh();
        })
        .finally(() => {
          closeMemberRemoveConfirm();
        });
      return true;
    }
  }

  return false;
}
