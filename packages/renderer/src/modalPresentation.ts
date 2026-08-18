import type { CSSProperties } from 'react';
import type { LayoutStyle } from '@appza/schemas';
import { layoutStyleToCss } from './layoutStyle';
import { readOverride } from './resolveOverride';
import type { AddMemberRoleOption } from './AddMemberModal';
import type { InviteChipPalette, InviteRoleOption } from './InviteUserModal';
import type { SchedulePresentation } from './ScheduleSheet';
import type { MediaViewerPresentation } from './MediaViewer';
import type { ChatMembersPresentation } from './ChatMembersSheet';
import type { ChatUserCardPresentation } from './ChatUserCard';

// Maps an overlay AppZet's authored props (snake_case, as stored in
// default_props_override) onto the camelCase payload its component
// consumes.
//
// This lives in the renderer, not in a shell, because BOTH shells open
// these modals and each had grown its own partial copy of the mapping.
// The copies drifted: between them they carried roughly a third of the
// declared props, so the Properties panel showed 30 and 58 controls of
// which most were wired to nothing. Every colour, every size, `hidden`
// and `show_close` were authored, saved, and silently dropped on the
// floor. One mapping, used by both, is the only version of this that
// stays honest — if a prop is in the catalog it gets read here, and a
// panel control that does nothing becomes a visible omission in one
// file rather than an invisible gap across two.

/** Reads a string prop, treating '' as unset so CSS falls back. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Reads a size prop. Bare numbers get 'px'; strings pass through. */
function size(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return `${v}px`;
  return str(v);
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function roleList<T extends { value: string; label: string }>(
  raw: unknown,
  map: (r: Record<string, unknown>) => T,
): T[] {
  const list = Array.isArray(raw) ? raw : [];
  const out = list
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
    .filter((r) => typeof r.value === 'string' && typeof r.label === 'string')
    .map(map);
  if (out.length > 0) return out;
  // Sensible default if the catalog is somehow bare — matches the seeded
  // role_options on both modals.
  return [
    { value: 'member', label: 'Member' },
    { value: 'moderator', label: 'Moderator' },
    { value: 'admin', label: 'Admin' },
  ].map((r) => map(r as unknown as Record<string, unknown>));
}

/**
 * Per-child Wrapper overrides (width / height / gap / padding / border …)
 * as inline CSS, keyed by superstructure child index.
 *
 * A composed AppZet gets these from PlacementRenderer's
 * computeChildLayoutStyles. A bespoke overlay renders its own DOM, so it
 * has to be handed the same thing — otherwise the Wrapper tab saves
 * happily and the card never moves.
 */
export function childStylesFromCustomizations(
  appzetSlug: string,
  childCount: number,
  customizations: unknown,
): Record<number, CSSProperties> {
  const out: Record<number, CSSProperties> = {};
  for (let idx = 0; idx < childCount; idx++) {
    const override = readOverride(
      customizations,
      'appzet_primitive',
      `${appzetSlug}#children[${idx}]`,
      'layout',
    );
    if (override && typeof override === 'object' && !Array.isArray(override)) {
      out[idx] = layoutStyleToCss(override as LayoutStyle);
    }
  }
  return out;
}

/** Superstructure child counts — the tagging in each modal must match. */
export const ADD_MEMBER_CHILD_COUNT = 9;
export const INVITE_USER_CHILD_COUNT = 13;
export const SCHEDULE_SHEET_CHILD_COUNT = 10;
export const MEDIA_VIEWER_CHILD_COUNT = 5;

/** Weekday initials, comma-separated in the catalog so they're editable. */
function weekdayList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const out = raw.filter((d): d is string => typeof d === 'string');
    if (out.length > 0) return out;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const out = raw.split(',').map((d) => d.trim()).filter(Boolean);
    if (out.length > 0) return out;
  }
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
}

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number.parseInt(v, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function schedulePresentation(props: Record<string, unknown>): SchedulePresentation {
  return {
    eyebrow: str(props.eyebrow) ?? 'PUBLISH LATER',
    title: str(props.title) ?? 'Schedule post',
    timeLabel: str(props.time_label) ?? 'Time',
    submitLabel: str(props.submit_label) ?? 'Schedule',
    prevIcon: str(props.prev_icon) ?? 'chevron-back',
    nextIcon: str(props.next_icon) ?? 'chevron-forward',
    monthCaretIcon: str(props.month_caret_icon) ?? 'chevron-down',
    weekdays: weekdayList(props.weekday_labels),
    hidden: bool(props.hidden, false),
    showEyebrow: bool(props.show_eyebrow, true),
    showHandle: bool(props.show_handle, true),
    // FC Pro rejects anything closer than 30 minutes; the catalog can
    // raise it but not lower it past what the server will accept.
    minLeadMinutes: num(props.min_lead_minutes, 30),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    backdropColor: str(props.backdrop_color),
    eyebrowColor: str(props.eyebrow_color),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    monthColor: str(props.month_color),
    navIconColor: str(props.nav_icon_color),
    weekdayColor: str(props.weekday_color),
    dayColor: str(props.day_color),
    dayMutedColor: str(props.day_muted_color),
    selectedRingColor: str(props.selected_ring_color),
    selectedTextColor: str(props.selected_text_color),
    timeLabelColor: str(props.time_label_color),
    timeBgColor: str(props.time_bg_color),
    timeTextColor: str(props.time_text_color),
    timeRadius: size(props.time_radius),
    submitBgColor: str(props.submit_bg_color),
    submitTextColor: str(props.submit_text_color),
    submitRadius: size(props.submit_radius),
  };
}

export function mediaViewerPresentation(
  props: Record<string, unknown>,
): MediaViewerPresentation {
  return {
    closeIcon: str(props.close_icon) ?? 'close',
    downloadIcon: str(props.download_icon) ?? 'download-outline',
    downloadLabel: str(props.download_label) ?? 'Download',
    viewPostIcon: str(props.view_post_icon) ?? 'eye-outline',
    viewPostLabel: str(props.view_post_label) ?? 'View post',
    counterSeparator: str(props.counter_separator) ?? '/',
    hidden: bool(props.hidden, false),
    showCounter: bool(props.show_counter, true),
    showClose: bool(props.show_close, true),
    showDownload: bool(props.show_download, true),
    showViewPost: bool(props.show_view_post, true),
    backdropColor: str(props.backdrop_color),
    counterColor: str(props.counter_color),
    counterSize: size(props.counter_size),
    closeIconColor: str(props.close_icon_color),
    imageRadius: size(props.image_radius),
    actionTextColor: str(props.action_text_color),
    actionIconColor: str(props.action_icon_color),
    actionTextSize: size(props.action_text_size),
    actionGap: size(props.action_gap),
  };
}

export function addMemberPresentation(props: Record<string, unknown>) {
  return {
    title: str(props.modal_title) ?? 'Add Member',
    closeIcon: str(props.close_icon) ?? 'close',
    searchIcon: str(props.search_icon) ?? 'search',
    searchLabel: str(props.search_label),
    searchPlaceholder: str(props.search_placeholder),
    roleLabel: str(props.role_label),
    rolePlaceholder: str(props.role_placeholder),
    submitLabelEmpty: str(props.submit_label_empty),
    submitLabelTemplate: str(props.submit_label_template),
    roles: roleList<AddMemberRoleOption>(props.role_options, (r) => ({
      value: r.value as string,
      label: r.label as string,
      icon: typeof r.icon === 'string' ? (r.icon as string) : undefined,
    })),
    hidden: bool(props.hidden, false),
    showClose: bool(props.show_close, true),
    modalMaxWidth: size(props.modal_max_width),
    modalPadding: size(props.modal_padding),
    sectionGap: size(props.section_gap),
    modalRadius: size(props.modal_radius),
    modalBgColor: str(props.modal_bg_color),
    backdropColor: str(props.backdrop_color),
    searchBgColor: str(props.search_bg_color),
    searchBorderColor: str(props.search_border_color),
    searchTextColor: str(props.search_text_color),
    roleBgColor: str(props.role_bg_color),
    roleBorderColor: str(props.role_border_color),
    roleTextColor: str(props.role_text_color),
    chipBgColor: str(props.chip_bg_color),
    chipTextColor: str(props.chip_text_color),
    submitBgColor: str(props.submit_bg_color),
    submitTextColor: str(props.submit_text_color),
    submitRadius: size(props.submit_radius),
    submitDisabledBgColor: str(props.submit_disabled_bg_color),
  };
}

export function invitePresentation(props: Record<string, unknown>) {
  const chipPalette: InviteChipPalette = {
    // Colours stay on the AppZet keyed by the semantic tone the endpoint
    // stamps per row, so a role chip and a status chip are themed
    // independently without the endpoint knowing about colour at all.
    success: {
      bg: str(props.chip_success_bg_color),
      text: str(props.chip_success_text_color),
    },
    warning: {
      bg: str(props.chip_warning_bg_color),
      text: str(props.chip_warning_text_color),
    },
    muted: {
      bg: str(props.chip_muted_bg_color),
      text: str(props.chip_muted_text_color),
    },
  };

  return {
    title: str(props.modal_title) ?? 'Invite user',
    closeIcon: str(props.close_icon) ?? 'close',
    tabInvitationsLabel: str(props.tab_invitations_label),
    tabInviteLabel: str(props.tab_invite_label),
    showInvitationCount: bool(props.show_invitation_count, true),
    defaultTab: (props.default_tab === 'invite' ? 'invite' : 'invitations') as
      | 'invite'
      | 'invitations',
    copyLinkLabel: str(props.copy_link_label),
    copyLinkIcon: str(props.copy_link_icon),
    resendLabel: str(props.resend_label),
    deleteIcon: str(props.delete_icon),
    invitedByPrefix: str(props.invited_by_prefix),
    emptyLabel: str(props.empty_label),
    deleteConfirmTitle: str(props.delete_confirm_title),
    deleteConfirmMessage: str(props.delete_confirm_message),
    deleteCancelLabel: str(props.delete_cancel_label),
    deleteConfirmLabel: str(props.delete_confirm_label),
    emailLabel: str(props.email_label),
    emailPlaceholder: str(props.email_placeholder),
    nameLabel: str(props.name_label),
    namePlaceholder: str(props.name_placeholder),
    roleLabel: str(props.role_label),
    rolePlaceholder: str(props.role_placeholder),
    roles: roleList<InviteRoleOption>(props.role_options, (r) => ({
      value: r.value as string,
      label: r.label as string,
    })),
    helperText: str(props.helper_text),
    submitLabelEmpty: str(props.submit_label_empty),
    submitLabelTemplate: str(props.submit_label_template),
    hidden: bool(props.hidden, false),
    showClose: bool(props.show_close, true),
    modalMaxWidth: size(props.modal_max_width),
    modalPadding: size(props.modal_padding),
    sectionGap: size(props.section_gap),
    listMaxHeight: size(props.list_max_height),
    modalRadius: size(props.modal_radius),
    modalBgColor: str(props.modal_bg_color),
    backdropColor: str(props.backdrop_color),
    tabBgColor: str(props.tab_bg_color),
    tabActiveBgColor: str(props.tab_active_bg_color),
    tabActiveTextColor: str(props.tab_active_text_color),
    tabTextColor: str(props.tab_text_color),
    rowTitleColor: str(props.row_title_color),
    rowMetaColor: str(props.row_meta_color),
    copyLinkColor: str(props.copy_link_color),
    deleteColor: str(props.delete_color),
    chipPalette,
    fieldBgColor: str(props.field_bg_color),
    fieldBorderColor: str(props.field_border_color),
    fieldTextColor: str(props.field_text_color),
    fieldRadius: size(props.field_radius),
    helperTextColor: str(props.helper_text_color),
    submitBgColor: str(props.submit_bg_color),
    submitTextColor: str(props.submit_text_color),
    submitRadius: size(props.submit_radius),
    submitDisabledBgColor: str(props.submit_disabled_bg_color),
  };
}

/**
 * fc-chat-members-sheet — the 3-dot sheet on a space or group
 * conversation (design 3).
 *
 * The two role maps come out of one authored array so a customer edits
 * a single list: `[{ value, label, bg_color, text_color }]`. Splitting
 * label from colour into two props would let them fall out of step.
 */
export function chatMembersPresentation(
  props: Record<string, unknown>,
): ChatMembersPresentation {
  const roleLabels: Record<string, string> = {};
  const roleColors: Record<string, [string, string]> = {};
  const raw = Array.isArray(props.roles) ? props.roles : [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.value !== 'string' || typeof r.label !== 'string') continue;
    roleLabels[r.value] = r.label;
    roleColors[r.value] = [
      typeof r.bg_color === 'string' ? r.bg_color : '',
      typeof r.text_color === 'string' ? r.text_color : '',
    ];
  }

  return {
    membersLabel: str(props.members_label) ?? 'MEMBERS',
    viewCommunityLabel: str(props.view_community_label) ?? 'VIEW COMMUNITY',
    leaveLabel: str(props.leave_label) ?? 'Leave group',
    emptyLabel: str(props.empty_label) ?? 'No members yet',
    usernamePrefix: typeof props.username_prefix === 'string' ? props.username_prefix : '@',
    roleLabels,
    roleColors,
    showViewCommunity: bool(props.show_view_community, true),
    showLeave: bool(props.show_leave, true),
    hidden: bool(props.hidden, false),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    countColor: str(props.count_color),
    countSize: size(props.count_size),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    nameColor: str(props.name_color),
    nameSize: size(props.name_size),
    handleColor: str(props.handle_color),
    avatarSize: size(props.avatar_size),
    rowGap: size(props.row_gap),
    viewCommunityColor: str(props.view_community_color),
    viewCommunityBorderColor: str(props.view_community_border_color),
    leaveColor: str(props.leave_color),
  };
}

/**
 * fc-chat-user-card — the 3-dot card on a one-to-one conversation
 * (designs 5 and 6).
 *
 * Both activity wordings are props: the two designs differ in exactly
 * that one string, and which shows is decided by a boolean the API
 * publishes, not by anything computed here.
 */
export function chatUserCardPresentation(
  props: Record<string, unknown>,
): ChatUserCardPresentation {
  return {
    activeLabel: str(props.active_label) ?? 'Active now',
    inactiveLabel: str(props.inactive_label) ?? 'No activity information available',
    blockLabel: str(props.block_label) ?? 'BLOCK USER',
    unblockLabel: str(props.unblock_label) ?? 'UNBLOCK USER',
    deleteLabel: str(props.delete_label) ?? 'DELETE CONVERSATION',
    copiedToast: str(props.copied_toast) ?? 'Username copied',
    closeIcon: str(props.close_icon) ?? 'close',
    copyIcon: str(props.copy_icon) ?? 'copy-outline',
    infoIcon: str(props.info_icon) ?? 'information-circle',
    showBlock: bool(props.show_block, true),
    showDelete: bool(props.show_delete, true),
    hidden: bool(props.hidden, false),
    cardBgColor: str(props.card_bg_color),
    cardRadius: size(props.card_radius),
    avatarSize: size(props.avatar_size),
    nameColor: str(props.name_color),
    nameSize: size(props.name_size),
    handleBgColor: str(props.handle_bg_color),
    handleTextColor: str(props.handle_text_color),
    handleRadius: size(props.handle_radius),
    activityColor: str(props.activity_color),
    infoIconColor: str(props.info_icon_color),
    blockColor: str(props.block_color),
    blockBorderColor: str(props.block_border_color),
    deleteColor: str(props.delete_color),
    deleteBorderColor: str(props.delete_border_color),
  };
}
