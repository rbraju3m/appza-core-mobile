import { useEffect, useState } from 'react';

// FluentCommunity runtime settings surfaced by the WP portal's own
// settings screens. The bootstrap controller reads FluentCommunity's
// `customization_settings`, `fluent_community_settings` and
// `_fluent_player_settings` stores and ships the fields we honor as
// `runtime_config.fluent_community`. The mobile shell (App.tsx)
// hydrates this store once the envelope lands; PlacementRenderer
// subscribes so fc-member-card can flip between grid and list layouts
// and the create-post composer can branch the way the portal does.
//
// Values mirror FluentCommunity's own strings verbatim — `classic`
// is the list layout in FC vocabulary; `grid` is the tile grid.
//
// ⚠ Everything here is a property of the SITE. Whether a particular
// VIEWER may schedule a post, send the announcement email or upload a
// video is answered per request on the space-picker payload (the
// plug-in's FluentCommunityComposerEnricher), because bootstrap is
// public-read and cached per template — a per-viewer answer baked in
// here would be whoever warmed the cache.

export type FcMemberListLayout = 'classic' | 'grid';

/** Settings → Customization → Post Title. */
export type FcPostTitlePref = 'disabled' | 'optional' | 'required';

/** Settings → Customization → Rich Media Post Layout. */
export type FcRichPostLayout = 'classic' | 'modern';

/** FluentPlayer's `video_upload_role`, verbatim. */
export type FcVideoUploadRole = 'admin' | 'admin_moderator' | 'everyone';

export type FcFluentPlayerSettings = {
  /** 'active' | 'installed' | 'not_installed' */
  status: string;
  /** The "Enable FluentPlayer" switch. */
  enabled: boolean;
  /** Whether the Upload Video tab exists at all. */
  video_upload_enabled: boolean;
  /** Raw — resolved against the viewer where the auth state is known. */
  video_upload_role: FcVideoUploadRole;
  /** Whether the audio glyph exists at all. */
  audio_upload_enabled: boolean;
  max_audios_per_post: number;
  play_embedded_videos: boolean;
};

export type FcComposerSettings = {
  post_title_pref: FcPostTitlePref;
  /** Settings → General → Global Post Status — the "On my profile" row. */
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

export type FcRuntimeSettings = {
  member_list_layout: FcMemberListLayout;
  composer: FcComposerSettings;
};

const EVENT = 'appza:fc-runtime-settings-change';

// Defaults are FluentCommunity's own defaults, so a site that has never
// opened its settings behaves in the app the way it behaves in the
// portal. FluentPlayer defaults to absent: its switches are meaningless
// without the plug-in, and the composer hides both tabs when it is.
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

const DEFAULTS: FcRuntimeSettings = {
  member_list_layout: 'classic',
  composer: COMPOSER_DEFAULTS,
};

let current: FcRuntimeSettings = DEFAULTS;

export function getFcRuntimeSettings(): FcRuntimeSettings {
  return current;
}

/** Convenience for the many composer call sites. */
export function getFcComposerSettings(): FcComposerSettings {
  return current.composer;
}

function pickString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// A count that arrives as 0, a negative, or something unparseable all
// mean "the site did not really say" — fall back rather than let a
// picker cap itself at nothing.
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

/**
 * Hydrate from the bootstrap envelope's `runtime_config.fluent_community`
 * (or any subset of it). Unknown / malformed fields keep their CURRENT
 * value rather than resetting to the default — a partial envelope must
 * not silently undo a good one.
 *
 * No-ops when nothing actually changed, so a pull-to-refresh returning
 * identical settings does not re-render every subscriber.
 */
export function setFcRuntimeSettings(patch: Record<string, unknown>): void {
  const next: FcRuntimeSettings = {
    member_list_layout: pickString(
      patch.member_list_layout,
      ['classic', 'grid'] as const,
      current.member_list_layout,
    ),
    composer: normalizeComposer(patch.composer, current.composer),
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
