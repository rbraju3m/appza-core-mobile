import { useEffect, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';

import { childAttrs, appzetAttrs } from './designTimeAttrs';
import { resolveIcon } from './PrimitiveRenderer';
import { setPostDraft, type PostDraftTopic } from './postDraft';
import { fetchDataSourceOnce } from './dataFetch';
import { useBackDismiss } from './backStack';

// Child indices below MUST match the fc-post-space-sheet superstructure's children array.

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
  globalPostsEnabled: boolean;
  viewerIsModerator: boolean;
  mode?: 'destination' | 'move';
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

  // Only the first row carries the template attrs, or the builder sees many children[2].
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
                    // Unpostable spaces stay listed but dimmed and unselectable.
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

export function applySpaceDestination(row: PostSpaceRow, viewerIsModerator: boolean): void {
  setPostDraft({
    target: 'space',
    space_slug: row.slug,
    space_title: row.title,
    space_logo: row.logo,
    space_emoji: row.emoji,
    space_privacy: row.privacy,
    // FC grants the announcement email to a global OR space moderator.
    space_can_announce: viewerIsModerator || row.can_announce,
    space_can_upload_documents: row.can_upload_documents,
    topic_required: row.topic_required,
    topics: row.topics,
  });
}

export function applyProfileDestination(viewerIsModerator: boolean): void {
  setPostDraft({
    target: 'profile',
    space_slug: '',
    space_title: '',
    space_logo: '',
    space_emoji: '',
    space_privacy: '',
    space_can_announce: viewerIsModerator,
    space_can_upload_documents: false,
    topic_required: false,
    topics: [],
  });
}

/** Writes only the move fields: the post keeps its old space and topics until Save, as FC's portal does. */
export function applyMoveDestination(row: PostSpaceRow): void {
  setPostDraft({
    move_target: 'space',
    move_space_id: row.id,
    move_space_title: row.title,
    move_space_logo: row.logo,
    move_space_emoji: row.emoji,
  });
}

export function applyMoveToProfile(): void {
  setPostDraft({
    move_target: 'profile',
    move_space_id: '',
    move_space_title: '',
    move_space_logo: '',
    move_space_emoji: '',
  });
}

export type PostSpacePayload = {
  groups: PostSpaceGroup[];
  viewerIsModerator: boolean;
  canUploadVideo: boolean;
  canUploadAudio: boolean;
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

// Keyed by params too: the move picker's list differs per post.
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

/** Via the preview proxy: fcom-mobile 401s a cookie fetch with no REST nonce. Never throws. */
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

  // The proxy answers a bare array, the endpoint `{response, items}`; accept both.
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

export async function preparePostComposer(dataSourceSlug: string): Promise<void> {
  const payload = await fetchPostSpacePayload(dataSourceSlug);
  setPostDraft({ viewer_is_moderator: payload.viewerIsModerator });
}

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
        // After the destination: setPostDraft clears topic_ids on a destination change.
        if (topicIds.length > 0) setPostDraft({ topic_ids: topicIds });
        return true;
      }
    }
  }
  return false;
}

export function clearPostSpaceCache(): void {
  cached = null;
}
