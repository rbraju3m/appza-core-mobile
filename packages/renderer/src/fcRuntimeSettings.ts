import { useEffect, useState } from 'react';

// Site-level only: bootstrap is public-read and cached, so per-viewer answers come per request.

export type FcMemberListLayout = 'classic' | 'grid';

export type FcPostTitlePref = 'disabled' | 'optional' | 'required';

export type FcRichPostLayout = 'classic' | 'modern';

export type FcVideoUploadRole = 'admin' | 'admin_moderator' | 'everyone';

export type FcFluentPlayerSettings = {
  status: string;
  enabled: boolean;
  video_upload_enabled: boolean;
  video_upload_role: FcVideoUploadRole;
  audio_upload_enabled: boolean;
  max_audios_per_post: number;
  play_embedded_videos: boolean;
};

export type FcComposerSettings = {
  post_title_pref: FcPostTitlePref;
  global_posts_enabled: boolean;
  rich_post_layout: FcRichPostLayout;
  max_media_per_post: number;
  announcement_email_enabled: boolean;
  survey_enabled: boolean;
  video_embed_enabled: boolean;
  inline_image_upload: boolean;
  topics_enabled: boolean;
  max_topics_per_post: number;
  fluent_player: FcFluentPlayerSettings;
};

export type FcFeedLayout = 'timeline' | 'list' | 'card';

export type FcFeedSortOption = { value: string; label: string };

export type FcFeedSettings = {
  default_layout: FcFeedLayout;
  layout_change_disabled: boolean;
  // '' means "no preference" and must not be collapsed to 'latest'.
  default_sort_by: string;
  sort_change_disabled: boolean;
  // Excludes `following`: that row is per-viewer.
  sort_options: FcFeedSortOption[];
  followers_module_enabled: boolean;
  content_moderation_enabled: boolean;
  show_topic_on_post_card: boolean;
};

export type FcAccessLevel = 'public' | 'logged_in' | 'role_based';

export type FcAccessSettings = {
  access_level: FcAccessLevel;
  privacy: {
    members_page_status: string;
    profile_page_visibility: string;
    user_space_visibility: string;
    leaderboard_members_visibility: string;
  };
};

export type FcRuntimeSettings = {
  member_list_layout: FcMemberListLayout;
  leaderboard_enabled: boolean;
  composer: FcComposerSettings;
  feed: FcFeedSettings;
  access: FcAccessSettings;
};

const EVENT = 'appza:fc-runtime-settings-change';

// FC's own defaults, so an unconfigured site behaves as it does in the portal.
const PLAYER_DEFAULTS: FcFluentPlayerSettings = {
  status: 'not_installed',
  enabled: false,
  video_upload_enabled: false,
  video_upload_role: 'admin',
  audio_upload_enabled: false,
  max_audios_per_post: 10,
  play_embedded_videos: false,
};

const COMPOSER_DEFAULTS: FcComposerSettings = {
  post_title_pref: 'optional',
  global_posts_enabled: false,
  rich_post_layout: 'classic',
  max_media_per_post: 4,
  announcement_email_enabled: false,
  survey_enabled: true,
  video_embed_enabled: true,
  inline_image_upload: true,
  topics_enabled: false,
  max_topics_per_post: 1,
  fluent_player: PLAYER_DEFAULTS,
};

const FEED_DEFAULTS: FcFeedSettings = {
  default_layout: 'timeline',
  layout_change_disabled: false,
  default_sort_by: '',
  sort_change_disabled: false,
  sort_options: [],
  followers_module_enabled: false,
  content_moderation_enabled: false,
  show_topic_on_post_card: true,
};

// Public by default: a locked default would bounce guests to login on a slow envelope; the API is the real gate.
const ACCESS_DEFAULTS: FcAccessSettings = {
  access_level: 'public',
  privacy: {
    members_page_status: '',
    profile_page_visibility: '',
    user_space_visibility: '',
    leaderboard_members_visibility: '',
  },
};

const DEFAULTS: FcRuntimeSettings = {
  member_list_layout: 'classic',
  // Off by default: with the module off the bar would read "Level 0".
  leaderboard_enabled: false,
  composer: COMPOSER_DEFAULTS,
  feed: FEED_DEFAULTS,
  access: ACCESS_DEFAULTS,
};

let current: FcRuntimeSettings = DEFAULTS;

export function getFcRuntimeSettings(): FcRuntimeSettings {
  return current;
}

export function getFcComposerSettings(): FcComposerSettings {
  return current.composer;
}

export function getFcFeedSettings(): FcFeedSettings {
  return current.feed;
}

export function getFcAccessSettings(): FcAccessSettings {
  return current.access;
}

// Pro appends `Following` only for a signed-in viewer, so it can't live in cached bootstrap.
export function resolveFeedSortOptions(isLoggedIn: boolean): FcFeedSortOption[] {
  const base = current.feed.sort_options;
  if (!current.feed.followers_module_enabled || !isLoggedIn) return base;
  if (base.some((o) => o.value === 'following')) return base;
  return [...base, { value: 'following', label: 'Following' }];
}

export type FcFeedSortRow = { value: string; label: string; icon?: string };

// FC owns which sorts exist; the catalog only supplies glyphs. Catalog rows are the fallback before bootstrap lands.
export function resolveFeedSortRows(
  catalogRows: readonly FcFeedSortRow[],
  isLoggedIn: boolean,
): FcFeedSortRow[] {
  const glyphs = new Map(catalogRows.map((r) => [r.value, r.icon]));
  const siteRows = resolveFeedSortOptions(isLoggedIn);
  const rows: FcFeedSortRow[] =
    siteRows.length > 0
      ? siteRows.map((r) => ({ value: r.value, label: r.label, icon: glyphs.get(r.value) }))
      : catalogRows
          .filter((r) => r.value !== 'following')
          .map((r) => ({ ...r }));
  // The fallback bypassed resolveFeedSortOptions; re-add `following` on the same terms.
  if (
    siteRows.length === 0 &&
    isLoggedIn &&
    current.feed.followers_module_enabled &&
    glyphs.has('following')
  ) {
    rows.push({ value: 'following', label: 'Following', icon: glyphs.get('following') });
  }
  return rows;
}

function pickString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// 0, negative or unparseable means the site didn't really say.
function pickCount(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizePlayer(raw: unknown, base: FcFluentPlayerSettings): FcFluentPlayerSettings {
  if (!isRecord(raw)) return base;
  return {
    status: typeof raw.status === 'string' ? raw.status : base.status,
    enabled: pickBool(raw.enabled, base.enabled),
    video_upload_enabled: pickBool(raw.video_upload_enabled, base.video_upload_enabled),
    video_upload_role: pickString(
      raw.video_upload_role,
      ['admin', 'admin_moderator', 'everyone'] as const,
      base.video_upload_role,
    ),
    audio_upload_enabled: pickBool(raw.audio_upload_enabled, base.audio_upload_enabled),
    max_audios_per_post: pickCount(raw.max_audios_per_post, base.max_audios_per_post),
    play_embedded_videos: pickBool(raw.play_embedded_videos, base.play_embedded_videos),
  };
}

function normalizeFeed(raw: unknown, base: FcFeedSettings): FcFeedSettings {
  if (!isRecord(raw)) return base;

  // An empty list is a real answer; only a malformed/absent one keeps the current list.
  const options = Array.isArray(raw.sort_options)
    ? raw.sort_options
        .filter(isRecord)
        .filter((o) => typeof o.value === 'string' && typeof o.label === 'string')
        .map((o) => ({ value: o.value as string, label: o.label as string }))
    : base.sort_options;

  return {
    default_layout: pickString(
      raw.default_layout,
      ['timeline', 'list', 'card'] as const,
      base.default_layout,
    ),
    layout_change_disabled: pickBool(raw.layout_change_disabled, base.layout_change_disabled),
    // '' (no preference) must survive, so no pickString here.
    default_sort_by: typeof raw.default_sort_by === 'string' ? raw.default_sort_by : base.default_sort_by,
    sort_change_disabled: pickBool(raw.sort_change_disabled, base.sort_change_disabled),
    sort_options: options,
    followers_module_enabled: pickBool(raw.followers_module_enabled, base.followers_module_enabled),
    content_moderation_enabled: pickBool(
      raw.content_moderation_enabled,
      base.content_moderation_enabled,
    ),
    show_topic_on_post_card: pickBool(raw.show_topic_on_post_card, base.show_topic_on_post_card),
  };
}

function normalizeAccess(raw: unknown, base: FcAccessSettings): FcAccessSettings {
  if (!isRecord(raw)) return base;
  const privacy = isRecord(raw.privacy) ? raw.privacy : {};
  const pick = (k: keyof FcAccessSettings['privacy']) =>
    typeof privacy[k] === 'string' ? (privacy[k] as string) : base.privacy[k];
  return {
    access_level: pickString(
      raw.access_level,
      ['public', 'logged_in', 'role_based'] as const,
      base.access_level,
    ),
    privacy: {
      members_page_status: pick('members_page_status'),
      profile_page_visibility: pick('profile_page_visibility'),
      user_space_visibility: pick('user_space_visibility'),
      leaderboard_members_visibility: pick('leaderboard_members_visibility'),
    },
  };
}

function normalizeComposer(raw: unknown, base: FcComposerSettings): FcComposerSettings {
  if (!isRecord(raw)) return base;
  return {
    post_title_pref: pickString(
      raw.post_title_pref,
      ['disabled', 'optional', 'required'] as const,
      base.post_title_pref,
    ),
    global_posts_enabled: pickBool(raw.global_posts_enabled, base.global_posts_enabled),
    rich_post_layout: pickString(
      raw.rich_post_layout,
      ['classic', 'modern'] as const,
      base.rich_post_layout,
    ),
    max_media_per_post: pickCount(raw.max_media_per_post, base.max_media_per_post),
    announcement_email_enabled: pickBool(
      raw.announcement_email_enabled,
      base.announcement_email_enabled,
    ),
    survey_enabled: pickBool(raw.survey_enabled, base.survey_enabled),
    video_embed_enabled: pickBool(raw.video_embed_enabled, base.video_embed_enabled),
    inline_image_upload: pickBool(raw.inline_image_upload, base.inline_image_upload),
    topics_enabled: pickBool(raw.topics_enabled, base.topics_enabled),
    max_topics_per_post: pickCount(raw.max_topics_per_post, base.max_topics_per_post),
    fluent_player: normalizePlayer(raw.fluent_player, base.fluent_player),
  };
}

// Malformed fields keep their CURRENT value so a partial envelope can't undo a good one.
export function setFcRuntimeSettings(patch: Record<string, unknown>): void {
  const next: FcRuntimeSettings = {
    member_list_layout: pickString(
      patch.member_list_layout,
      ['classic', 'grid'] as const,
      current.member_list_layout,
    ),
    leaderboard_enabled: pickBool(patch.leaderboard_enabled, current.leaderboard_enabled),
    composer: normalizeComposer(patch.composer, current.composer),
    feed: normalizeFeed(patch.feed, current.feed),
    access: normalizeAccess(patch.access, current.access),
  };

  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

export function useFcRuntimeSettings(): FcRuntimeSettings {
  const [state, setState] = useState<FcRuntimeSettings>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}
