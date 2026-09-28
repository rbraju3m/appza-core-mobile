import type { CSSProperties } from 'react';
import type { LayoutStyle } from '@appza/schemas';
import { layoutStyleToCss } from './layoutStyle';
import { readOverride } from './resolveOverride';
import type { AddMemberRoleOption } from './AddMemberModal';
import type { InviteChipPalette, InviteRoleOption } from './InviteUserModal';
import type { SchedulePresentation } from './ScheduleSheet';
import type { MediaViewerPresentation } from './MediaViewer';
import type { ChatMembersPresentation } from './ChatMembersSheet';
import type { FollowSheetPresentation } from './FollowSheet';
import type { NewMessagePresentation } from './NewMessageModal';
import type { ChatUserCardPresentation } from './ChatUserCard';
import type { LeaderboardPointsPresentation } from './LeaderboardPointsSheet';
import type { OptionsSheetPresentation } from './OptionsSheet';
import type { PostMenuSheetPresentation } from './PostOptionsPopover';
import type { PostSpaceSheetPresentation } from './PostSpaceSheet';
import type { VideoSheetPresentation } from './VideoSheet';
import type { PollSheetPresentation } from './PollSheet';
import type { ModerationReviewPresentation } from './ModerationReviewSheet';

// Both shells use this one mapping; per-shell copies drifted and silently dropped props.

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

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
  return [
    { value: 'member', label: 'Member' },
    { value: 'moderator', label: 'Moderator' },
    { value: 'admin', label: 'Admin' },
  ].map((r) => map(r as unknown as Record<string, unknown>));
}

// A bespoke overlay renders its own DOM, so it must be handed the Wrapper styles PlacementRenderer gives composed AppZets.
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

export const ADD_MEMBER_CHILD_COUNT = 9;
export const INVITE_USER_CHILD_COUNT = 13;
export const SCHEDULE_SHEET_CHILD_COUNT = 10;
export const MEDIA_VIEWER_CHILD_COUNT = 5;

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
    // FC Pro rejects anything closer than 30 minutes.
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

export function followSheetPresentation(
  props: Record<string, unknown>,
): FollowSheetPresentation {
  return {
    followingsLabel: str(props.followings_label) ?? 'Following',
    followersLabel: str(props.followers_label) ?? 'Followers',
    blockedLabel: str(props.blocked_label) ?? 'Blocked',
    unblockLabel: str(props.unblock_label) ?? 'Unblock',
    emptyFollowings: str(props.empty_followings) ?? 'Not following anyone yet.',
    emptyFollowers: str(props.empty_followers) ?? 'No followers yet.',
    emptyBlocked: str(props.empty_blocked) ?? 'No blocked members.',
    usernamePrefix: str(props.username_prefix) ?? '@',
    showBlockedTab: bool(props.show_blocked_tab, true),
    hidden: bool(props.hidden, false),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    tabTrackColor: str(props.tab_track_color),
    tabActiveBgColor: str(props.tab_active_bg_color),
    tabActiveColor: str(props.tab_active_color),
    tabColor: str(props.tab_color),
    tabSize: size(props.tab_size),
    nameColor: str(props.name_color),
    nameSize: size(props.name_size),
    handleColor: str(props.handle_color),
    handleSize: size(props.handle_size),
    avatarSize: size(props.avatar_size),
    emptyColor: str(props.empty_color),
    emptySize: size(props.empty_size),
    unblockColor: str(props.unblock_color),
    unblockBorderColor: str(props.unblock_border_color),
    unblockRadius: size(props.unblock_radius),
  };
}

export function newMessagePresentation(props: Record<string, unknown>): NewMessagePresentation {
  return {
    title: str(props.title) ?? 'New Message',
    placeholder: str(props.placeholder) ?? 'Write your message....',
    cancelLabel: str(props.cancel_label) ?? 'CANCEL',
    sendLabel: str(props.send_label) ?? 'SEND MESSAGE',
    closeIcon: str(props.close_icon) ?? 'close',
    hidden: bool(props.hidden, false),
    showClose: bool(props.show_close, true),
    showRecipient: bool(props.show_recipient, true),
    modalBgColor: str(props.modal_bg_color),
    modalRadius: size(props.modal_radius),
    // A percentage of the screen, never vh: in the simulator vh measures the page, not the device frame.
    modalMinHeight: str(props.modal_min_height),
    backdropColor: str(props.backdrop_color),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    dividerColor: str(props.divider_color),
    recipientTrackColor: str(props.recipient_track_color),
    recipientBgColor: str(props.recipient_bg_color),
    recipientColor: str(props.recipient_color),
    fieldBgColor: str(props.field_bg_color),
    fieldBorderColor: str(props.field_border_color),
    fieldTextColor: str(props.field_text_color),
    fieldHeight: size(props.field_height),
    accentColor: str(props.accent_color),
    sendTextColor: str(props.send_text_color),
    buttonRadius: size(props.button_radius),
  };
}

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

export function leaderboardPointsPresentation(
  props: Record<string, unknown>,
): LeaderboardPointsPresentation {
  return {
    title: str(props.title) ?? 'Leaderboard points',
    pointsHeading: str(props.points_heading) ?? '1 Like = 1 Point',
    pointsBody:
      str(props.points_body) ??
      'You earn points when other members like your posts, articles or comments. This encourages members to produce quality content and interact with others in their community.',
    levelsHeading: str(props.levels_heading) ?? 'Levels',
    levelsBody:
      str(props.levels_body) ??
      'As you gain points you level up. Your level is shown at the bottom right of your avatar.',
    emptyLabel: str(props.empty_label) ?? 'No levels configured',
    hidden: bool(props.hidden, false),
    showHandle: bool(props.show_handle, true),
    showLevelsList: bool(props.show_levels_list, true),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    // Not size(): this one is a vh fraction.
    sheetMaxHeight: str(props.sheet_max_height),
    handleColor: str(props.handle_color),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    headingColor: str(props.heading_color),
    headingSize: size(props.heading_size),
    bodyColor: str(props.body_color),
    bodySize: size(props.body_size),
    levelTitleColor: str(props.level_title_color),
    levelTitleSize: size(props.level_title_size),
    levelPointsColor: str(props.level_points_color),
    levelPointsSize: size(props.level_points_size),
    dividerColor: str(props.divider_color),
    rowPadding: str(props.row_padding),
  };
}

export function optionsSheetPresentation(
  props: Record<string, unknown>,
): OptionsSheetPresentation {
  return {
    title: str(props.title) ?? 'Sort',
    checkIcon: str(props.check_icon) ?? 'checkmark',
    emptyLabel: str(props.empty_label) ?? 'No options',
    hidden: bool(props.hidden, false),
    showHandle: bool(props.show_handle, true),
    showTitle: bool(props.show_title, true),
    showRowIcons: bool(props.show_row_icons, true),
    showCheck: bool(props.show_check, true),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    // A percentage of the screen, never vh: in the simulator vh measures the page, not the device frame.
    sheetMaxHeight: str(props.sheet_max_height),
    backdropColor: str(props.backdrop_color),
    handleColor: str(props.handle_color),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    titleWeight: str(props.title_weight),
    rowPadding: str(props.row_padding),
    rowGap: size(props.row_gap),
    rowRadius: size(props.row_radius),
    labelColor: str(props.label_color),
    labelSize: size(props.label_size),
    iconColor: str(props.icon_color),
    iconSize: size(props.icon_size),
    selectedBgColor: str(props.selected_bg_color),
    selectedLabelColor: str(props.selected_label_color),
    selectedIconColor: str(props.selected_icon_color),
    checkColor: str(props.check_color),
    checkSize: size(props.check_size),
    dividerColor: str(props.divider_color),
    sectionTitleColor: str(props.section_title_color),
    sectionTitleSize: size(props.section_title_size),
    eyebrowColor: str(props.eyebrow_color),
    eyebrowSize: size(props.eyebrow_size),
  };
}

// `destructiveColor` has no fallback on purpose: unset inherits the label colour.
export function postMenuSheetPresentation(
  props: Record<string, unknown>,
  // The action's sheet_title wins: one shared sheet frames both the post and comment menus.
  eyebrowOverride?: string,
): PostMenuSheetPresentation {
  return {
    eyebrow: eyebrowOverride ?? str(props.eyebrow) ?? 'POST',
    hidden: bool(props.hidden, false),
    showHandle: bool(props.show_handle, true),
    showEyebrow: bool(props.show_eyebrow, true),
    showRowIcons: bool(props.show_row_icons, true),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    sheetMaxHeight: str(props.sheet_max_height),
    backdropColor: str(props.backdrop_color),
    handleColor: str(props.handle_color),
    eyebrowColor: str(props.eyebrow_color),
    eyebrowSize: size(props.eyebrow_size),
    eyebrowWeight: str(props.eyebrow_weight),
    rowPadding: str(props.row_padding),
    rowGap: size(props.row_gap),
    labelColor: str(props.label_color),
    labelSize: size(props.label_size),
    iconColor: str(props.icon_color),
    iconSize: size(props.icon_size),
    destructiveColor: str(props.destructive_color),
    dividerColor: str(props.divider_color),
    title: str(props.title) ?? '',
    showTitle: bool(props.show_title, true),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    titleWeight: str(props.title_weight),
  };
}

export function profileLinkRowVars(props: Record<string, unknown>): CSSProperties {
  return {
    ['--appza-row-bg-color' as string]: str(props.row_bg_color),
    ['--appza-row-padding' as string]: str(props.row_padding),
    ['--appza-row-gap' as string]: size(props.row_gap),
    ['--appza-label-color' as string]: str(props.label_color),
    ['--appza-label-size' as string]: size(props.label_size),
    ['--appza-label-weight' as string]: str(props.label_weight),
    ['--appza-icon-color' as string]: str(props.icon_color),
    ['--appza-icon-size' as string]: size(props.icon_size),
    ['--appza-chevron-color' as string]: str(props.chevron_color),
    ['--appza-chevron-size' as string]: size(props.chevron_size),
    ['--appza-divider-color' as string]: str(props.divider_color),
  };
}

export function postSpaceSheetPresentation(
  props: Record<string, unknown>,
): PostSpaceSheetPresentation {
  return {
    title: str(props.title) ?? 'Post to',
    moveTitle: str(props.move_title) ?? 'Select destination',
    profileLabel: str(props.profile_label) ?? 'On my profile',
    emptyLabel: str(props.empty_label) ?? 'No spaces to post in',
    publicIcon: str(props.public_icon) ?? 'globe-outline',
    privateIcon: str(props.private_icon) ?? 'lock-closed-outline',
    hidden: bool(props.hidden, false),
    showHandle: bool(props.show_handle, true),
    showTitle: bool(props.show_title, true),
    showProfileRow: bool(props.show_profile_row, true),
    showGroupHeadings: bool(props.show_group_headings, true),
    showAvatars: bool(props.show_avatars, true),
    showPrivacyLabel: bool(props.show_privacy_label, true),
    publicLabel: str(props.public_label) ?? 'Public',
    privateLabel: str(props.private_label) ?? 'Private',
    secretLabel: str(props.secret_label) ?? 'Secret',
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    // A percentage of the screen, never vh: in the simulator vh measures the page, not the device frame.
    sheetMaxHeight: str(props.sheet_max_height),
    backdropColor: str(props.backdrop_color),
    handleColor: str(props.handle_color),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    titleWeight: str(props.title_weight),
    groupColor: str(props.group_color),
    groupSize: size(props.group_size),
    groupWeight: str(props.group_weight),
    rowPadding: str(props.row_padding),
    rowGap: size(props.row_gap),
    avatarSize: size(props.avatar_size),
    avatarRadius: size(props.avatar_radius),
    iconColor: str(props.icon_color),
    iconSize: size(props.icon_size),
    labelColor: str(props.label_color),
    labelSize: size(props.label_size),
    labelWeight: str(props.label_weight),
    privacyColor: str(props.privacy_color),
    privacySize: size(props.privacy_size),
    dividerColor: str(props.divider_color),
    disabledOpacity: str(props.disabled_opacity),
  };
}

export function videoSheetPresentation(props: Record<string, unknown>): VideoSheetPresentation {
  return {
    eyebrow: str(props.eyebrow) ?? 'EMBED',
    title: str(props.title) ?? 'Attach Media',
    oembedTab: str(props.oembed_tab) ?? 'Oembed',
    htmlTab: str(props.html_tab) ?? 'HTML Code',
    uploadTab: str(props.upload_tab) ?? 'Upload Video',
    emptyHint: str(props.empty_hint) ?? 'Add video iframe code',
    oembedHint: str(props.oembed_hint) ?? 'Embed from Vimeo, YouTube, Wistia and more',
    htmlHint: str(props.html_hint) ?? 'Add video from custom HTML Code',
    urlPlaceholder: str(props.url_placeholder) ?? 'Enter video URL',
    htmlPlaceholder: str(props.html_placeholder) ?? 'Pasate an iframe code',
    attachLabel: str(props.attach_label) ?? 'Attach',
    uploadTitle: str(props.upload_title) ?? 'Upload a video',
    uploadSubtitle: str(props.upload_subtitle) ?? 'MP4, WebM or MOV',
    uploadIcon: str(props.upload_icon) ?? 'videocam-outline',
    uploadAccept: str(props.upload_accept) ?? 'video/mp4,video/webm,video/quicktime',
    lookupFailedLabel: str(props.lookup_failed_label) ?? 'No video found at that link.',
    hidden: bool(props.hidden, false),
    showHandle: bool(props.show_handle, true),
    showEyebrow: bool(props.show_eyebrow, true),
    showTitle: bool(props.show_title, true),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    sheetMaxHeight: str(props.sheet_max_height),
    backdropColor: str(props.backdrop_color),
    handleColor: str(props.handle_color),
    eyebrowColor: str(props.eyebrow_color),
    eyebrowSize: size(props.eyebrow_size),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    titleWeight: str(props.title_weight),
    tabBgColor: str(props.tab_bg_color),
    tabTextColor: str(props.tab_text_color),
    tabRadius: size(props.tab_radius),
    tabHeight: size(props.tab_height),
    activeBgColor: str(props.active_bg_color),
    activeColor: str(props.active_color),
    hintColor: str(props.hint_color),
    hintSize: size(props.hint_size),
    fieldBgColor: str(props.field_bg_color),
    fieldTextColor: str(props.field_text_color),
    fieldRadius: size(props.field_radius),
    fieldBorderColor: str(props.field_border_color),
    attachBgColor: str(props.attach_bg_color),
    attachDisabledBgColor: str(props.attach_disabled_bg_color),
    attachTextColor: str(props.attach_text_color),
    attachRadius: size(props.attach_radius),
    uploadBorderColor: str(props.upload_border_color),
    uploadRadius: size(props.upload_radius),
    iconColor: str(props.icon_color),
    iconSize: size(props.icon_size),
  };
}

export function moderationReviewPresentation(
  props: Record<string, unknown>,
): ModerationReviewPresentation {
  return {
    detailsTabLabel: str(props.details_tab_label) ?? 'Details',
    reportsTabLabel: str(props.reports_tab_label) ?? 'Reports',
    dismissLabel: str(props.dismiss_label) ?? 'DISMISS REPORTS',
    unpublishLabel: str(props.unpublish_label) ?? 'UNPUBLISHED POST',
    publishLabel: str(props.publish_label) ?? 'PUBLISHED POST',
    deleteLabel: str(props.delete_label) ?? 'DELETE REPORTS',
    autoFlagHeading: str(props.auto_flag_heading) ?? 'Flagged Automatically by the site rule',
    reportedForPrefix: str(props.reported_for_prefix) ?? 'Reported for',
    reportedAtPrefix: str(props.reported_at_prefix) ?? 'Reported at',
    postedInPrefix: str(props.posted_in_prefix) ?? 'Posted in',
    emptyLabel: str(props.empty_label) ?? 'No reports on this content.',
    loadingLabel: str(props.loading_label) ?? 'Loading…',
    dismissConfirmTitle: str(props.dismiss_confirm_title) ?? 'Dismiss Reports',
    dismissConfirmMessage:
      str(props.dismiss_confirm_message) ??
      'This will dismiss all reports and keep the content published.',
    dismissConfirmCta: str(props.dismiss_confirm_cta) ?? 'YES, DISMISS',
    unpublishConfirmTitle: str(props.unpublish_confirm_title) ?? 'Unpublished Content',
    unpublishConfirmMessage:
      str(props.unpublish_confirm_message) ?? 'This will unpublish the content from public view.',
    unpublishConfirmCta: str(props.unpublish_confirm_cta) ?? 'YES, UNPUBLISH',
    publishConfirmTitle: str(props.publish_confirm_title) ?? 'Publish Content',
    publishConfirmMessage:
      str(props.publish_confirm_message) ??
      'This will publish the content and make it visible to the community.',
    publishConfirmCta: str(props.publish_confirm_cta) ?? 'YES, PUBLISH',
    deleteConfirmTitle: str(props.delete_confirm_title) ?? 'Delete Report',
    deleteConfirmMessage:
      str(props.delete_confirm_message) ?? 'This will permanently delete this report.',
    deleteConfirmCta: str(props.delete_confirm_cta) ?? 'YES, DELETE',
    setStatusActionSlug: str(props.set_status_action_slug) ?? 'moderation.set_status',
    deleteActionSlug: str(props.delete_action_slug) ?? 'moderation.delete_report',
  };
}

export function pollSheetPresentation(props: Record<string, unknown>): PollSheetPresentation {
  return {
    eyebrow: str(props.eyebrow) ?? 'ASK THE SPACE',
    title: str(props.title) ?? 'Create poll',
    optionPlaceholder: str(props.option_placeholder) ?? 'Option',
    addOptionLabel: str(props.add_option_label) ?? 'Add option',
    singleLabel: str(props.single_label) ?? 'Single choice',
    multipleLabel: str(props.multiple_label) ?? 'Multiple choice',
    addEndDateLabel: str(props.add_end_date_label) ?? 'Add end date',
    timeLabel: str(props.time_label) ?? 'Time',
    removeLabel: str(props.remove_label) ?? 'Remove',
    doneLabel: str(props.done_label) ?? 'Done',
    addIcon: str(props.add_icon) ?? 'add',
    removeOptionIcon: str(props.remove_option_icon) ?? 'close',
    calendarIcon: str(props.calendar_icon) ?? 'calendar-outline',
    prevIcon: str(props.prev_icon) ?? 'chevron-back',
    nextIcon: str(props.next_icon) ?? 'chevron-forward',
    monthCaretIcon: str(props.month_caret_icon) ?? 'chevron-down',
    weekdays: weekdayList(props.weekday_labels),
    endDateFormat: str(props.end_date_format) ?? '{d} {mon} at {HH}:{mm}',
    hidden: bool(props.hidden, false),
    showHandle: bool(props.show_handle, true),
    showEyebrow: bool(props.show_eyebrow, true),
    showTitle: bool(props.show_title, true),
    showEndDate: bool(props.show_end_date, true),
    showRemove: bool(props.show_remove, true),
    // FC's own picker allows past dates; this is our stricter default.
    allowPastEndDate: bool(props.allow_past_end_date, false),
    sheetBgColor: str(props.sheet_bg_color),
    sheetRadius: size(props.sheet_radius),
    sheetMaxHeight: str(props.sheet_max_height),
    backdropColor: str(props.backdrop_color),
    handleColor: str(props.handle_color),
    eyebrowColor: str(props.eyebrow_color),
    eyebrowSize: size(props.eyebrow_size),
    titleColor: str(props.title_color),
    titleSize: size(props.title_size),
    titleWeight: str(props.title_weight),
    fieldBgColor: str(props.field_bg_color),
    fieldTextColor: str(props.field_text_color),
    fieldPlaceholderColor: str(props.field_placeholder_color),
    fieldBorderColor: str(props.field_border_color),
    fieldRadius: size(props.field_radius),
    fieldHeight: size(props.field_height),
    fieldGap: size(props.field_gap),
    optionRemoveColor: str(props.option_remove_color),
    optionRemoveSize: size(props.option_remove_size),
    addColor: str(props.add_color),
    addSize: size(props.add_size),
    addWeight: str(props.add_weight),
    segmentBgColor: str(props.segment_bg_color),
    segmentTextColor: str(props.segment_text_color),
    segmentBorderColor: str(props.segment_border_color),
    segmentRadius: size(props.segment_radius),
    segmentHeight: size(props.segment_height),
    segmentGap: size(props.segment_gap),
    segmentActiveBgColor: str(props.segment_active_bg_color),
    segmentActiveTextColor: str(props.segment_active_text_color),
    segmentActiveBorderColor: str(props.segment_active_border_color),
    endDateColor: str(props.end_date_color),
    endDateSize: size(props.end_date_size),
    endDateIconColor: str(props.end_date_icon_color),
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
    removeColor: str(props.remove_color),
    removeSize: size(props.remove_size),
    doneBgColor: str(props.done_bg_color),
    doneDisabledBgColor: str(props.done_disabled_bg_color),
    doneTextColor: str(props.done_text_color),
    doneRadius: size(props.done_radius),
    doneHeight: size(props.done_height),
  };
}
