import { useEffect, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';

import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { setPostDraft, type PostDraftTopic } from './postDraft';
import { fetchDataSourceOnce } from './dataFetch';
import { useBackDismiss } from './backStack';

/**
 * "Post to" — the create-post space picker (Noor's design 5).
 *
 * Its own component rather than another AppZet on fc-options-sheet
 * because the shape genuinely differs: rows are GROUPED under space-group
 * headings, each row carries an avatar-or-glyph plus a privacy subtitle,
 * and there is a standalone "On my profile" row above everything that
 * belongs to no group. An options sheet is a flat list with a check.
 *
 * Opened by event like the other sheets — there is no placement to mount
 * it from — so it opts back into the builder by hand via
 * childAttrs/appzetAttrs. The indices below MUST match the `children`
 * array of the fc-post-space-sheet superstructure.
 *
 * The rows travel on the action that opens it: the shell fetches
 * fcom-mobile's `/spaces/create-post-information-lean`, which already
 * answers with exactly this grouping. Choosing a row writes the whole
 * destination into the postDraft slice at once — its topics and its two
 * permissions included — so nothing has to be fetched again when the
 * composer redraws.
 */

export const POST_SPACE_SHEET_APPZET_SLUG = 'fc-post-space-sheet';
export const POST_SPACE_SHEET_CHILD_COUNT = 5;

export type PostSpaceRow = {
  id: string;
  title: string;
  slug: string;
  privacy: string;
  logo: string;
  emoji: string;
  can_create_post: boolean;
  can_announce: boolean;
  can_upload_documents: boolean;
  topic_required: boolean;
  topics: PostDraftTopic[];
};

export type PostSpaceGroup = {
  group_name: string;
  spaces: PostSpaceRow[];
};

export type PostSpaceSheetPresentation = {
  title: string;
  /**
   * The title in MOVE mode. The same sheet asks two questions — where a
   * new post goes, and where an existing one moves to — and "Post to" is
   * the wrong sentence for the second. FluentCommunity's own edit modal
   * calls it "Select destination".
   */
  moveTitle: string;
  profileLabel: string;
  emptyLabel: string;
  publicIcon: string;
  privateIcon: string;
  hidden: boolean;
  showHandle: boolean;
  showTitle: boolean;
  showProfileRow: boolean;
  showGroupHeadings: boolean;
  showAvatars: boolean;
  showPrivacyLabel: boolean;
  /** Privacy words, so a site can rename them without a translation file. */
  publicLabel: string;
  privateLabel: string;
  secretLabel: string;
  sheetBgColor?: string;
  sheetRadius?: string;
  sheetMaxHeight?: string;
  backdropColor?: string;
  handleColor?: string;
  titleColor?: string;
  titleSize?: string;
  titleWeight?: string;
  groupColor?: string;
  groupSize?: string;
  groupWeight?: string;
  rowPadding?: string;
  rowGap?: string;
  avatarSize?: string;
  avatarRadius?: string;
  iconColor?: string;
  iconSize?: string;
  labelColor?: string;
  labelSize?: string;
  labelWeight?: string;
  privacyColor?: string;
  privacySize?: string;
  dividerColor?: string;
  disabledOpacity?: string;
};

type OpenDetail = {
  appzetSlug?: string;
  presentation: PostSpaceSheetPresentation;
  groups: PostSpaceGroup[];
  /**
   * Settings → General → Global Post Status. The "On my profile" row
   * exists only when the site allows posts that belong to no space.
   */
  globalPostsEnabled: boolean;
  /** Global community moderator — half of the announcement-email gate. */
  viewerIsModerator: boolean;
  /**
   * Which question the sheet is asking.
   *
   *   'destination'  where does this NEW post go — the create screen's
   *                  "Post to". A pick becomes the draft's destination:
   *                  its chip, its topic chips, its two permissions.
   *   'move'         where does this EXISTING post move to — the edit
   *                  screen's checkbox. A pick writes the MOVE fields
   *                  and leaves the destination alone, because the
   *                  "Posted in:" row has to keep saying where the post
   *                  is while you choose (design 4).
   *
   * Same sheet, same rows, same presentation — one list of what a
   * space looks like, not two (item 4).
   */
  mode?: 'destination' | 'move';
  /**
   * Overrides the presentation's profile label. Move mode needs
   * FluentCommunity's second string — "On author's profile" — when the
   * viewer is not the one who wrote the post, and only the payload
   * knows which.
   */
  profileLabel?: string;
  childStyles?: Record<number, CSSProperties>;
};

const OPEN_EVENT = 'appza:open-post-space-sheet';
const CLOSE_EVENT = 'appza:close-post-space-sheet';

export function openPostSpaceSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closePostSpaceSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function PostSpaceSheet() {
  const [detail, setDetail] = useState<OpenDetail | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
    };
    const onClose = () => setDetail(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setDetail(null);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useBackDismiss(!(!detail || detail.presentation.hidden), () => setDetail(null));

  if (!detail || detail.presentation.hidden) return null;

  const p = detail.presentation;
  const slug = detail.appzetSlug ?? POST_SPACE_SHEET_APPZET_SLUG;
  const cs = detail.childStyles ?? {};

  const vars: CSSProperties = {
    ['--appza-sheet-bg-color' as string]: p.sheetBgColor,
    ['--appza-sheet-radius' as string]: p.sheetRadius,
    ['--appza-sheet-max-height' as string]: p.sheetMaxHeight,
    ['--appza-backdrop-color' as string]: p.backdropColor,
    ['--appza-handle-color' as string]: p.handleColor,
    ['--appza-title-color' as string]: p.titleColor,
    ['--appza-title-size' as string]: p.titleSize,
    ['--appza-title-weight' as string]: p.titleWeight,
    ['--appza-group-color' as string]: p.groupColor,
    ['--appza-group-size' as string]: p.groupSize,
    ['--appza-group-weight' as string]: p.groupWeight,
    ['--appza-row-padding' as string]: p.rowPadding,
    ['--appza-row-gap' as string]: p.rowGap,
    ['--appza-avatar-size' as string]: p.avatarSize,
    ['--appza-avatar-radius' as string]: p.avatarRadius,
    ['--appza-icon-color' as string]: p.iconColor,
    ['--appza-icon-size' as string]: p.iconSize,
    ['--appza-label-color' as string]: p.labelColor,
    ['--appza-label-size' as string]: p.labelSize,
    ['--appza-label-weight' as string]: p.labelWeight,
    ['--appza-privacy-color' as string]: p.privacyColor,
    ['--appza-privacy-size' as string]: p.privacySize,
    ['--appza-divider-color' as string]: p.dividerColor,
    ['--appza-disabled-opacity' as string]: p.disabledOpacity,
  };

  const publicIcon = resolveIcon(p.publicIcon);
  const privateIcon = resolveIcon(p.privateIcon);

  const privacyLabel = (privacy: string): string => {
    if (privacy === 'private') return p.privateLabel;
    if (privacy === 'secret') return p.secretLabel;
    return p.publicLabel;
  };

  const moving = detail.mode === 'move';
  const sheetTitle = moving && p.moveTitle ? p.moveTitle : p.title;

  const pickProfile = () => {
    if (moving) applyMoveToProfile();
    else applyProfileDestination(detail.viewerIsModerator);
    closePostSpaceSheet();
  };

  const pickSpace = (row: PostSpaceRow) => {
    if (moving) applyMoveDestination(row);
    else applySpaceDestination(row, detail.viewerIsModerator);
    closePostSpaceSheet();
  };

  // The first row anywhere owns the row-template design-time attrs.
  // Stamping every row would give the right panel a dozen elements each
  // claiming to be children[2] (P73 / P90).
  let rowSeen = false;
  const templateAttrs = (index: number, primitive: string) => {
    if (rowSeen) return {};
    return childAttrs(slug, index, primitive);
  };

  const total = detail.groups.reduce((n, g) => n + g.spaces.length, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={sheetTitle}
      className="appza-post-space-sheet-backdrop"
      style={vars}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePostSpaceSheet();
      }}
    >
      <div className="appza-post-space-sheet" {...appzetAttrs(slug)}>
        {p.showHandle && <div className="appza-post-space-sheet-grabber" />}

        <div className="appza-post-space-sheet-scroll">
          {p.showTitle && (
            <div
              className="appza-post-space-sheet-title"
              style={cs[0]}
              {...childAttrs(slug, 0, 'ion-text')}
            >
              {sheetTitle}
            </div>
          )}

          {p.showProfileRow && detail.globalPostsEnabled && (
            <button
              type="button"
              className="appza-post-space-sheet-profile"
              style={cs[1]}
              onClick={pickProfile}
              {...childAttrs(slug, 1, 'ion-text')}
            >
              {detail.profileLabel || p.profileLabel}
            </button>
          )}

          {detail.groups.map((group) => (
            <div key={group.group_name} className="appza-post-space-sheet-group">
              {p.showGroupHeadings && group.group_name !== '' && (
                <div
                  className="appza-post-space-sheet-group-name"
                  style={cs[2]}
                  {...templateAttrs(2, 'ion-text')}
                >
                  {group.group_name}
                </div>
              )}

              {group.spaces.map((row) => {
                const isTemplate = !rowSeen;
                rowSeen = true;
                const glyph =
                  row.privacy === 'public' ? publicIcon : privateIcon;
                return (
                  <button
                    key={row.slug || row.id}
                    type="button"
                    className="appza-post-space-sheet-row"
                    // A space the viewer may not post to still shows —
                    // hiding it would leave an unexplained gap in a list
                    // the user knows the shape of — but it cannot be
                    // chosen, and it says so by being dimmed.
                    disabled={!row.can_create_post}
                    data-disabled={row.can_create_post ? 'no' : 'yes'}
                    onClick={() => pickSpace(row)}
                  >
                    {p.showAvatars && (
                      <span
                        className="appza-post-space-sheet-avatar"
                        style={cs[3]}
                        {...(isTemplate ? childAttrs(slug, 3, 'ion-avatar') : {})}
                      >
                        {row.logo ? (
                          <img src={row.logo} alt="" />
                        ) : row.emoji ? (
                          <span className="appza-post-space-sheet-emoji">{row.emoji}</span>
                        ) : glyph ? (
                          <IonIcon icon={glyph} />
                        ) : null}
                      </span>
                    )}
                    <span className="appza-post-space-sheet-row-body">
                      <span
                        className="appza-post-space-sheet-row-title"
                        style={cs[4]}
                        {...(isTemplate ? childAttrs(slug, 4, 'ion-text') : {})}
                      >
                        {row.title}
                      </span>
                      {p.showPrivacyLabel && (
                        <span className="appza-post-space-sheet-row-privacy">
                          {privacyLabel(row.privacy)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {total === 0 && !detail.globalPostsEnabled && (
            <div className="appza-post-space-sheet-empty">{p.emptyLabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Write one space onto the draft as the post's destination.
 *
 * Exported and shared rather than inlined in the picker, because the
 * EDIT screen needs the identical write: a post being edited already has
 * a space, and its chip, its topic chips, its document permission and its
 * announcement verdict all have to arrive together. Two copies of this
 * mapping would drift, and the half that drifted would be the one nobody
 * was looking at (P100).
 */
export function applySpaceDestination(row: PostSpaceRow, viewerIsModerator: boolean): void {
  setPostDraft({
    target: 'space',
    space_slug: row.slug,
    space_title: row.title,
    space_logo: row.logo,
    space_emoji: row.emoji,
    space_privacy: row.privacy,
    // FluentCommunity gates the announcement email on being a moderator
    // globally OR of the space posted to, so either grants it.
    space_can_announce: viewerIsModerator || row.can_announce,
    space_can_upload_documents: row.can_upload_documents,
    topic_required: row.topic_required,
    topics: row.topics,
  });
}

/** The same, for "On my profile". */
export function applyProfileDestination(viewerIsModerator: boolean): void {
  setPostDraft({
    target: 'profile',
    space_slug: '',
    space_title: '',
    space_logo: '',
    space_emoji: '',
    space_privacy: '',
    // A profile post has no space to moderate, so only the global
    // verdict can grant the announcement email.
    space_can_announce: viewerIsModerator,
    space_can_upload_documents: false,
    topic_required: false,
    topics: [],
  });
}

/** The same, for a MOVE — the edit screen's destination pick.
 *
 * Writes ONLY the move fields. The post's own space, its topic chips,
 * its announcement verdict and its document permission all stay where
 * they are, because none of them has moved yet: the post is still in its
 * old space until Save says otherwise, and the "Posted in:" row is
 * reading exactly those fields (design 4 shows it unchanged beside a
 * chip that has changed).
 *
 * The topics deliberately stay the OLD space's, which is what
 * FluentCommunity's own portal does — its edit modal keeps the composer
 * on the original space and posts the same `topic_ids` alongside
 * `new_space_id`.
 */
export function applyMoveDestination(row: PostSpaceRow): void {
  setPostDraft({
    move_target: 'space',
    move_space_id: row.id,
    move_space_title: row.title,
    move_space_logo: row.logo,
    move_space_emoji: row.emoji,
  });
}

/** "On my profile" / "On author's profile" — FC's `move_to_profile`. */
export function applyMoveToProfile(): void {
  setPostDraft({
    move_target: 'profile',
    move_space_id: '',
    move_space_title: '',
    move_space_logo: '',
    move_space_emoji: '',
  });
}

/**
 * The picker's payload: every space the viewer may post in, grouped as
 * the site groups them, plus the verdicts about the viewer themselves.
 */
export type PostSpacePayload = {
  groups: PostSpaceGroup[];
  viewerIsModerator: boolean;
  canUploadVideo: boolean;
  canUploadAudio: boolean;
  /**
   * MOVE payload only. The create picker leaves both alone and the
   * caller falls back to the site setting and the catalog label.
   */
  canMoveToProfile: boolean;
  profileLabel: string;
};

const EMPTY_PAYLOAD: PostSpacePayload = {
  groups: [],
  viewerIsModerator: false,
  canUploadVideo: false,
  canUploadAudio: false,
  canMoveToProfile: false,
  profileLabel: '',
};

// Keyed by slug AND params: the move picker answers a different list for
// every post, so a slug-only key would offer one post's destinations for
// the next one edited.
let cached: { key: string; payload: PostSpacePayload } | null = null;

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function s(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}
function b(v: unknown): boolean {
  return v === true || v === 'yes' || v === 1 || v === '1';
}

/**
 * Fetch and normalise the "Post to" payload.
 *
 * Goes through the preview proxy like every other DataSource read, by
 * slug. A direct fetch to fcom-mobile answers 401 even from wp-admin —
 * it authenticates on `is_user_logged_in()`, and a cookie without a REST
 * nonce is not a session as far as WP REST is concerned. The proxy is
 * where this app's auth lives.
 *
 * ONE implementation for both shells on purpose. They dispatch the same
 * actions against the same catalog, and a fetch written twice drifts —
 * the reaction glyph went missing for exactly that reason, in the shell
 * nobody was watching (P100).
 *
 * Answers a usable empty payload rather than throwing on a bad response:
 * a picker that opens with no rows is recoverable, a create-post screen
 * that cannot open its picker is not.
 */
export async function fetchPostSpacePayload(
  dataSourceSlug: string,
  opts?: { force?: boolean; params?: Record<string, unknown> },
): Promise<PostSpacePayload> {
  const key = `${dataSourceSlug}|${opts?.params ? JSON.stringify(opts.params) : ''}`;
  if (!opts?.force && cached && cached.key === key) return cached.payload;

  let json: unknown;
  try {
    json = await fetchDataSourceOnce(dataSourceSlug, opts?.params);
  } catch {
    return EMPTY_PAYLOAD;
  }

  // The preview proxy answers with the unwrapped rows — a bare array —
  // while the endpoint itself answers `{response, items}`. Accept both,
  // so this keeps working if it is ever read directly.
  const items = Array.isArray(json)
    ? (json as unknown[])
    : Array.isArray(rec(json).items)
      ? (rec(json).items as unknown[])
      : [];
  const wrapper = rec(items[0]);
  const viewer = rec(wrapper.viewer);

  const groups: PostSpaceGroup[] = (Array.isArray(wrapper.spaces) ? wrapper.spaces : []).map(
    (g) => {
      const group = rec(g);
      const spaces = (Array.isArray(group.spaces) ? group.spaces : []).map((sp) => {
        const row = rec(sp);
        const perms = rec(row.permissions);
        const settings = rec(row.settings);
        const topics = (Array.isArray(row.topics) ? row.topics : []).map((t) => {
          const topic = rec(t);
          return { id: s(topic.id), title: s(topic.title), slug: s(topic.slug) };
        });
        return {
          id: s(row.id),
          title: s(row.title),
          slug: s(row.slug),
          privacy: s(row.privacy) || 'public',
          logo: s(row.logo),
          emoji: s(settings.emoji),
          can_create_post: b(perms.can_create_post),
          can_announce: b(perms.community_moderator),
          can_upload_documents: b(perms.can_upload_documents),
          topic_required: b(row.topic_required),
          topics,
        };
      });
      return { group_name: s(group.group_name), spaces };
    },
  );

  const payload: PostSpacePayload = {
    groups,
    viewerIsModerator: b(viewer.is_moderator),
    canUploadVideo: b(viewer.can_upload_video),
    canUploadAudio: b(viewer.can_upload_audio),
    canMoveToProfile: b(wrapper.can_move_to_profile),
    profileLabel: s(wrapper.profile_label),
  };
  cached = { key, payload };
  return payload;
}

/**
 * Called when the create-post screen mounts, before anything is tapped.
 *
 * The announcement row and the schedule control exist on a per-viewer
 * verdict, and the designs show them on a composer with no space chosen
 * — so the verdict cannot wait for the picker to be opened. This warms
 * it (and the picker's rows with it, so opening the sheet is instant).
 */
export async function preparePostComposer(dataSourceSlug: string): Promise<void> {
  const payload = await fetchPostSpacePayload(dataSourceSlug);
  setPostDraft({ viewer_is_moderator: payload.viewerIsModerator });
}

/**
 * Put an EXISTING post's space onto the draft — the edit screen's opening
 * move.
 *
 * Looks the slug up in the same payload the picker uses, so the chip, the
 * topic chips, the document permission and the announcement verdict all
 * arrive exactly as they would from a tap. A slug that is not in the
 * payload means the viewer can no longer post there; the destination is
 * left unset rather than faked, which makes the Post button pale and
 * says so honestly.
 *
 * Returns whether it found the space, so a caller can tell "restored" from
 * "that space is gone".
 */
export async function hydratePostDraftSpace(
  dataSourceSlug: string,
  spaceSlug: string,
  topicIds: string[] = [],
): Promise<boolean> {
  if (spaceSlug === '') return false;
  const payload = await fetchPostSpacePayload(dataSourceSlug);
  for (const group of payload.groups) {
    for (const row of group.spaces) {
      if (row.slug === spaceSlug) {
        applySpaceDestination(row, payload.viewerIsModerator);
        // AFTER the destination, never before: setPostDraft clears
        // topic_ids on a destination change, so topics written first are
        // wiped by the space landing. Two writes, and the second one
        // moves nothing — so the selection sticks.
        if (topicIds.length > 0) setPostDraft({ topic_ids: topicIds });
        return true;
      }
    }
  }
  return false;
}

/** Drop the cached payload — on sign-out, or when a write may have changed it. */
export function clearPostSpaceCache(): void {
  cached = null;
}
