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
import type { ChatUserCardPresentation } from './ChatUserCard';
import type { LeaderboardPointsPresentation } from './LeaderboardPointsSheet';
import type { OptionsSheetPresentation } from './OptionsSheet';
import type { PostMenuSheetPresentation } from './PostOptionsPopover';
import type { PostSpaceSheetPresentation } from './PostSpaceSheet';
import type { VideoSheetPresentation } from './VideoSheet';
import type { PollSheetPresentation } from './PollSheet';
import type { ModerationReviewPresentation } from './ModerationReviewSheet';

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
/**
 * The follow sheet's frame (doc states 36-39). Same shape as every other
 * presentation helper here: the AppZet's authored props in, a typed bag
 * out, so both shells read one set of defaults rather than two.
 */
export function followSheetPresentation(
  props: Record<string, unknown>,
): FollowSheetPresentation {
  return {
    followingsLabel: str(props.followings_label) ?? 'Following',
    followersLabel: str(props.followers_label) ?? 'Followers',
    blockedLabel: str(props.blocked_label) ?? 'Blocked',
    unblockLabel: str(props.unblock_label) ?? 'Unblock',
    // One sentence per tab. An empty Blocked list is good news and should
    // not read like the other two.
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

/**
 * fc-leaderboard-points-sheet — the explainer behind the circled i on
 * the viewer's card (designs 5 and 6).
 *
 * Both paragraphs are props, not constants. FluentCommunity's own copy
 * is translated, and a site that words its gamification differently
 * should be able to say so without a build.
 */
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
    // Not size(): the design is a viewport fraction (72vh), and size()
    // would leave a bare number unitless-to-px, which is not the shape
    // this one wants.
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

/**
 * fc-options-sheet — the sort and layout bottom sheets on Saved Posts
 * (Noor's designs 5 and 3).
 *
 * One mapper for both. The two AppZets ride the same Superstructure and
 * differ only in a title and a row list, and the row list travels on the
 * action that opens the sheet rather than on the sheet itself.
 */
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
    // Not size(): a percentage of the screen, never a vh — inside the
    // simulator the device frame is a box on a much taller page and vh
    // would measure the page (P91).
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
  };
}

/**
 * fc-post-menu-sheet — the 3-dot post menu drawn as a bottom sheet
 * (design 4).
 *
 * `destructiveColor` deliberately has NO fallback. Design 4 draws Delete
 * in the same colour as every row above it, so an unset value means the
 * row inherits the label colour; a site that wants the red warning back
 * sets it in the right panel.
 */
export function postMenuSheetPresentation(
  props: Record<string, unknown>,
  /**
   * The ACTION's own `sheet_title`, when it has one, and it WINS.
   *
   * One sheet AppZet frames both the post menu and the comment menu, so
   * its authored eyebrow can only say one thing — it says POST. Design
   * 24's comment sheet says COMMENT. The action knows which menu it is
   * opening and the shared frame cannot, so the more specific value has
   * to win; reading the AppZet first just returns 'POST' forever, which
   * is what it did on the first attempt.
   */
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

/**
 * fc-profile-link-row — the "Saved posts" row under the profile header.
 *
 * A composed AppZet, not an overlay, so PlacementRenderer already binds
 * its labels and glyphs. What it cannot bind is a colour, which is what
 * this hands to the stylesheet.
 */
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

/**
 * fc-post-space-sheet — "Post to", the create-post space picker
 * (design 5).
 *
 * `public_label` / `private_label` / `secret_label` have real defaults
 * rather than falling through to the raw privacy string: FluentCommunity
 * stores 'secret', and the design writes words a member reads, not
 * database values.
 */
export function postSpaceSheetPresentation(
  props: Record<string, unknown>,
): PostSpaceSheetPresentation {
  return {
    title: str(props.title) ?? 'Post to',
    // The same sheet, opened from the edit screen's "Move to a different
    // space" chip. FluentCommunity's own edit modal words it this way.
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
    // A percentage, never a vh — inside the simulator the device frame
    // is a box on a much taller page and vh would measure the page (P91).
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

/**
 * fc-post-video-sheet — "Attach Media" (designs 15-19).
 *
 * `empty_hint` is shared by the two text tabs on purpose: the designs
 * show both reading the same generic line until something is typed, and
 * only then saying what each actually accepts.
 */
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

/**
 * "Create poll" — designs 24 to 29.
 *
 * Shares the calendar's knobs with `schedulePresentation` by name but
 * not by mapping: the two sheets have different Superstructures and
 * therefore different props rows, and folding them together would mean
 * one sheet's Properties panel silently editing the other's.
 */
/**
 * fc-moderation-review — the review modal (Noor's designs 29 to 32).
 *
 * Every string it draws, including both confirm dialogs, so designs 31
 * and 32 are catalog text rather than two copies in two shells.
 *
 * The unpublish label deliberately keeps Noor's wording rather than
 * FluentCommunity's. FC's own modal computes it from the content's state
 * — "Unpublish Post" while live, "Remove Post" once it is not, and
 * "Approve Post" in place of Dismiss — and design 29 draws one pair
 * regardless. The designs win; a builder who wants FC's phrasing can
 * type it here.
 */
export function moderationReviewPresentation(
  props: Record<string, unknown>,
): ModerationReviewPresentation {
  return {
    detailsTabLabel: str(props.details_tab_label) ?? 'Details',
    reportsTabLabel: str(props.reports_tab_label) ?? 'Reports',
    dismissLabel: str(props.dismiss_label) ?? 'DISMISS REPORTS',
    unpublishLabel: str(props.unpublish_label) ?? 'UNPUBLISHED POST',
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
    unpublishConfirmCta: str(props.unpublish_confirm_cta) ?? 'YES, UNPUBLISHED',
    setStatusActionSlug: str(props.set_status_action_slug) ?? 'moderation.set_status',
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
    // FluentCommunity's own picker greys nothing, so this is ours: a
    // poll that closed before its post existed is not a state an author
    // can mean. One switch back to the portal's behaviour.
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
