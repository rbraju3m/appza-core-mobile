import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import { usePostDraft, removePostDraftAudio, removePostDraftVideo } from './postDraft';
import { AppzaDraftVideo } from './VideoSheet';
import { AppzaDraftAudioList } from './AudioPlayerRow';
import { AppzaPollPreview } from './PollSheet';
import { AppzaDocumentsPreview } from './PostDocuments';
import { useFcRuntimeSettings } from './fcRuntimeSettings';

// fc-post-card is classic-only; modern needs a second grid-template-areas block in both its scopes.

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

/** App mode is a class on an ancestor, so re-read rather than sample once at mount. */
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

  const layoutProp = str(overrides, 'layout') || 'auto';
  const layout = layoutProp === 'auto' ? settings.rich_post_layout : layoutProp;

  const gridTiles = Math.max(1, Number.parseInt(str(overrides, 'grid_tiles'), 10) || 4);
  const overflowPrefix = str(overrides, 'overflow_prefix') || '+';

  const title = draft.title || (designTime ? 'hurry' : '');
  const body = draft.body || (designTime ? 'fufhudfh uhuf yhdfyh' : '');
  const spaceName = draft.target === 'space' ? draft.space_title : '';

  const meta =
    showSpace && spaceName ? `${nowLabel}${metaSeparator}${spaceName}` : nowLabel;

  const nothingToPreview =
    title === '' &&
    draft.body === '' &&
    draft.poll === null &&
    draft.video === null &&
    draft.images.length === 0 &&
    draft.audios.length === 0 &&
    draft.documents.length === 0;

  const images = draft.images;
  const audios = draft.audios;
  const showRemove = bool(overrides, 'show_remove', true);
  const removeIcon = str(overrides, 'remove_icon') || 'close';
  const onRemoveAudio = showRemove ? removePostDraftAudio : undefined;
  const onRemoveVideo = showRemove ? removePostDraftVideo : undefined;
  let media: React.ReactNode = null;
  if (audios.length > 0) {
    media = (
      <>
        <AppzaDraftAudioList
          audios={audios}
          overrides={overrides}
          onRemove={onRemoveAudio}
          removeIcon={removeIcon}
        />
        {draft.video ? (
          <AppzaDraftVideo
            video={draft.video}
            onRemove={onRemoveVideo}
            removeIcon={removeIcon}
          />
        ) : null}
      </>
    );
  } else if (draft.video) {
    media = (
      <AppzaDraftVideo video={draft.video} onRemove={onRemoveVideo} removeIcon={removeIcon} />
    );
  } else if (images.length > 0) {
    const shown = images.length > gridTiles ? images.slice(0, gridTiles) : images;
    const hidden = images.length - shown.length;
    media = (
      <span
        className="appza-post-preview-grid"
        data-count={images.length === 1 ? 'one' : 'many'}
      >
        {shown.map((image, i) => (
          <span key={image.url} className="appza-post-preview-tile">
            <img src={image.url} alt="" />
            {hidden > 0 && i === shown.length - 1 && (
              <span className="appza-post-preview-overflow">{`${overflowPrefix}${hidden}`}</span>
            )}
          </span>
        ))}
      </span>
    );
  } else if (designTime) {
    media = <span className="appza-post-preview-media-sample" />;
  }

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
      ) : nothingToPreview ? (
        <span className="appza-post-preview-empty">{emptyBodyLabel}</span>
      ) : null}

      {/* FC's SurveyRenderer keeps the survey under the body even when media moves to the top. */}
      {draft.poll && (
        <AppzaPollPreview
          poll={draft.poll}
          percentFormat={str(overrides, 'poll_percent_format') || '{whole}%.{decimal}'}
          votesLabel={str(overrides, 'poll_votes_label') || '{n} Vote'}
          showVotes={bool(overrides, 'show_poll_votes', true)}
        />
      )}

      {draft.documents.length > 0 && (
        <AppzaDocumentsPreview
          documents={draft.documents}
          heading={str(overrides, 'documents_heading') || 'Documents and files'}
          fileIcon={str(overrides, 'doc_file_icon') || 'document-outline'}
          downloadIcon={str(overrides, 'doc_download_icon') || 'download-outline'}
          showHeading={bool(overrides, 'show_documents_heading', true)}
        />
      )}

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
