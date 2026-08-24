import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import { usePostDraft } from './postDraft';
import { useFcRuntimeSettings } from './fcRuntimeSettings';

/**
 * The post preview — Noor's designs 9, 11 and 12.
 *
 * What the draft will look like once it is posted, drawn from the
 * postDraft slice. Nothing here is fetched: the post does not exist yet,
 * it has no id, no timestamp and no reactions, and the whole point of
 * the screen is to answer "what will this look like" before any of that
 * is true.
 *
 * Its own Superstructure rather than a second AppZet on fc-post-card,
 * for the same reason. The feed card carries a 3-dot menu, a topic pill,
 * a verified badge, reaction COUNTS and a mood — none of which a draft
 * has — and its child indices are addressed by field_mappings and saved
 * customizations, so a preview riding it would have to fake a feed row
 * and then hide two thirds of it. The designs are a simpler card, and
 * this draws that card.
 *
 * MODERN vs CLASSIC is FluentCommunity's Settings → Customization →
 * Rich Media Post Layout, read from the runtime store. Modern puts the
 * media above the author block, edge to edge; classic puts it under the
 * body. Designs 11 and 12 are the same draft under the two settings.
 *
 * ⚠ The FEED card does not honour that setting yet — it is classic-only,
 * which is what this site is set to, so the two agree today. Teaching
 * fc-post-card the modern order means a second `grid-template-areas`
 * block in BOTH of its scopes (feed and space-detail); see the warning
 * above its rules in styles.css. Tracked as follow-up, not silently
 * skipped.
 */

export type PostPreviewProps = {
  overrides?: Record<string, unknown>;
};

function str(o: Record<string, unknown> | undefined, k: string): string {
  const v = o?.[k];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

function bool(o: Record<string, unknown> | undefined, k: string, fallback: boolean): boolean {
  const v = o?.[k];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return fallback;
}

/** See the note in PostComposer — App mode is a class on an ancestor, so
 *  this has to be re-read rather than sampled once at mount. */
function useDesignTime(): boolean {
  const [designTime, setDesignTime] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const read = () => {
      const inFrame = Boolean(document.querySelector('.appza-device-viewport'));
      const inApp = Boolean(document.querySelector('.appza-center-app-mode'));
      setDesignTime(inFrame && !inApp);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    return () => observer.disconnect();
  }, []);
  return designTime;
}

export function AppzaPostPreview({ overrides }: PostPreviewProps) {
  const draft = usePostDraft();
  const { composer: settings } = useFcRuntimeSettings();
  const designTime = useDesignTime();

  // Bound from fc-current-user through the AppZet's field_mappings — the
  // author of a draft is always the viewer, so there is nothing to look
  // up per post.
  const authorName = str(overrides, 'author_name') || (designTime ? 'Test User' : '');
  const authorAvatar = str(overrides, 'author_avatar');

  const nowLabel = str(overrides, 'now_label') || 'Now';
  const metaSeparator = str(overrides, 'meta_separator') || ' . ';
  const emptyBodyLabel = str(overrides, 'empty_body_label') || 'Nothing to preview yet';

  const likeIcon = resolveIcon(str(overrides, 'like_icon') || 'heart-outline');
  const commentIcon = resolveIcon(str(overrides, 'comment_icon') || 'chatbubble-outline');
  const bookmarkIcon = resolveIcon(str(overrides, 'bookmark_icon') || 'bookmark-outline');

  const showAvatar = bool(overrides, 'show_avatar', true);
  const showSpace = bool(overrides, 'show_space', true);
  const showActions = bool(overrides, 'show_actions', true);
  const showLike = bool(overrides, 'show_like', true);
  const showComment = bool(overrides, 'show_comment', true);
  const showBookmark = bool(overrides, 'show_bookmark', true);

  // 'auto' follows the site setting, which is what the preview wants —
  // it is answering a question about this site. The explicit values exist
  // so an author can see the other layout without changing the site.
  const layoutProp = str(overrides, 'layout') || 'auto';
  const layout = layoutProp === 'auto' ? settings.rich_post_layout : layoutProp;

  const title = draft.title || (designTime ? 'hurry' : '');
  const body = draft.body || (designTime ? 'fufhudfh uhuf yhdfyh' : '');
  const spaceName = draft.target === 'space' ? draft.space_title : '';

  const meta =
    showSpace && spaceName ? `${nowLabel}${metaSeparator}${spaceName}` : nowLabel;

  // Media lands here as the later chunks add it — images, video, audio,
  // a poll, attached files. The region exists now so the two layouts are
  // real rather than something to retrofit, and so the builder has both
  // to style. Empty at runtime until then.
  const media = designTime ? <span className="appza-post-preview-media-sample" /> : null;

  return (
    <span className="appza-post-preview" data-layout={layout}>
      {layout === 'modern' && media && (
        <span className="appza-post-preview-media" data-position="top">
          {media}
        </span>
      )}

      <span className="appza-post-preview-author">
        {showAvatar && (
          <span className="appza-post-preview-avatar">
            {authorAvatar ? <img src={authorAvatar} alt="" /> : null}
          </span>
        )}
        <span className="appza-post-preview-author-text">
          <span className="appza-post-preview-name">{authorName}</span>
          <span className="appza-post-preview-meta">{meta}</span>
        </span>
      </span>

      {title !== '' && <span className="appza-post-preview-title">{title}</span>}
      {body !== '' ? (
        <span className="appza-post-preview-body">{body}</span>
      ) : title === '' ? (
        <span className="appza-post-preview-empty">{emptyBodyLabel}</span>
      ) : null}

      {layout !== 'modern' && media && (
        <span className="appza-post-preview-media" data-position="bottom">
          {media}
        </span>
      )}

      {showActions && (
        <span className="appza-post-preview-actions">
          {showLike && likeIcon && <IonIcon icon={likeIcon} aria-label="Like" />}
          {showComment && commentIcon && <IonIcon icon={commentIcon} aria-label="Comment" />}
          {showBookmark && bookmarkIcon && <IonIcon icon={bookmarkIcon} aria-label="Save" />}
        </span>
      )}
    </span>
  );
}
