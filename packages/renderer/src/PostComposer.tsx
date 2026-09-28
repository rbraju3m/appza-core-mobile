import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import { AppzaDraftVideo } from './VideoSheet';
import { AppzaDraftAudioList } from './AudioPlayerRow';
import { AppzaDraftPollStrip, requestPollSheet } from './PollSheet';
import {
  AppzaDraftDocumentList,
  requestDocumentRemove,
  requestDocumentRename,
} from './PostDocuments';
import {
  removePostDraftAudio,
  removePostDraftImage,
  removePostDraftPoll,
  removePostDraftVideo,
  setPostDraft,
  togglePostDraftMove,
  togglePostDraftTopic,
  usePostDraft,
} from './postDraft';
import { useFcRuntimeSettings } from './fcRuntimeSettings';
import type { ActionInvocation, ActionDispatch } from './actionContext';

// Fields are controlled against postDraft: prefill, space change and posting all write them from outside.

export type PostComposerProps = {
  overrides?: Record<string, unknown>;
  action?: ActionInvocation;
  dispatch: ActionDispatch;
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

/** Builder Edit mode: draw sample content so state-gated blocks stay selectable. */
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
    // Re-read on mode change: App mode is a class toggled on an ancestor.
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    return () => observer.disconnect();
  }, []);
  return designTime;
}

function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement>, value: string): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, value]);
}

export function AppzaPostComposer({ overrides, action, dispatch }: PostComposerProps) {
  const draft = usePostDraft();
  const { composer: settings } = useFcRuntimeSettings();
  const designTime = useDesignTime();

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const postedInLabel = str(overrides, 'posted_in_label') || 'Posted in:';
  const spacePlaceholder = str(overrides, 'space_placeholder') || 'Select space';
  const spaceChevron = resolveIcon(str(overrides, 'space_chevron_icon') || 'chevron-down');
  const profileLabel = str(overrides, 'profile_label') || 'On my profile';

  const titlePlaceholderRequired =
    str(overrides, 'title_placeholder_required') || 'Title(Required)';
  const titlePlaceholderOptional =
    str(overrides, 'title_placeholder_optional') || 'Title(Optional)';

  const bodyPlaceholder = str(overrides, 'body_placeholder') || "How's it going?";
  const bodyPlaceholderNoTitle =
    str(overrides, 'body_placeholder_no_title') || 'Share your thoughts';

  const topicsLabelTemplate = str(overrides, 'topics_label') || 'Topic.up to {max}';

  const moveLabel = str(overrides, 'move_label') || 'Move to a different space';
  const movePlaceholder = str(overrides, 'move_placeholder') || 'Select destination';
  const moveProfileLabel = str(overrides, 'move_profile_label') || 'On my profile';
  const showMove = bool(overrides, 'show_move', true);

  const removeIcon = resolveIcon(str(overrides, 'remove_icon') || 'close');
  const showMedia = bool(overrides, 'show_media', true);

  const showTopics = bool(overrides, 'show_topics', true);
  const showTitle = bool(overrides, 'show_title', true);
  const showPostedIn = bool(overrides, 'show_posted_in', true);

  const titleModeProp = str(overrides, 'title_mode') || 'auto';
  const titlePref = titleModeProp === 'auto' ? settings.post_title_pref : titleModeProp;
  const titleVisible = showTitle && titlePref !== 'disabled' && titlePref !== 'hidden';
  const titleRequired = titlePref === 'required';

  const maxTopics = settings.max_topics_per_post;
  const topics = designTime && draft.topics.length === 0 ? DESIGN_TIME_TOPICS : draft.topics;
  const topicsVisible = showTopics && topics.length > 0;

  const [capHit, setCapHit] = useState(false);
  useEffect(() => {
    if (!capHit) return;
    const t = setTimeout(() => setCapHit(false), 600);
    return () => clearTimeout(t);
  }, [capHit]);

  useAutoGrow(titleRef, draft.title);
  useAutoGrow(bodyRef, draft.body);

  const images = draft.images;
  const chosen = draft.target !== '';
  const isProfile = draft.target === 'profile';
  const spaceLabel = isProfile
    ? profileLabel
    : draft.space_title || (designTime ? 'QA Private Members Only' : spacePlaceholder);
  const showChip = chosen || designTime;

  // Read-only: FC moves a post only via new_space_id/move_to_profile, never by changing `space` on update.
  const editing = draft.edit_feed_id !== null;
  const spaceLocked = editing && !designTime;

  const moveVisible = showMove && (designTime || (editing && draft.can_move_space));
  const moveOn = designTime ? true : draft.move_target !== '';
  const movePicked = draft.move_target === 'space' || draft.move_target === 'profile';
  const moveIsProfile = draft.move_target === 'profile';
  const moveLogo = movePicked ? draft.move_space_logo : draft.space_logo;
  const moveEmoji = movePicked ? draft.move_space_emoji : draft.space_emoji;
  const moveSpaceLabel = moveIsProfile
    ? moveProfileLabel
    : movePicked
      ? draft.move_space_title || movePlaceholder
      : draft.space_title || (designTime ? 'General' : movePlaceholder);

  const spaceBadge =
    showChip && !isProfile && (draft.space_logo || draft.space_emoji || designTime) ? (
      <span className="appza-post-composer-space-badge">
        {draft.space_logo ? (
          <img src={draft.space_logo} alt="" />
        ) : (
          <span className="appza-post-composer-space-emoji">{draft.space_emoji || '🙂'}</span>
        )}
      </span>
    ) : null;

  const spaceChipInner = (
    <>
      {spaceBadge}
      <span className="appza-post-composer-space-name">{spaceLabel}</span>
      {spaceChevron && (
        <IonIcon
          className="appza-post-composer-space-chevron"
          icon={spaceChevron}
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <span className="appza-post-composer">
      {showPostedIn && (
        <span className="appza-post-composer-postedin">
          <span className="appza-post-composer-postedin-label">{postedInLabel}</span>
          {spaceLocked ? (
            <span
              className="appza-post-composer-space"
              data-chosen={showChip ? 'yes' : 'no'}
              data-locked="yes"
            >
              {spaceChipInner}
            </span>
          ) : (
            <button
              type="button"
              className="appza-post-composer-space"
              data-chosen={showChip ? 'yes' : 'no'}
              onClick={() => {
                if (!action) return;
                dispatch(action);
              }}
            >
              {spaceChipInner}
            </button>
          )}
        </span>
      )}

      {/* Same catalog action as the picker plus mode 'move': an action no child names never reaches the snapshot. */}
      {moveVisible && (
        <span className="appza-post-composer-move">
          <button
            type="button"
            role="checkbox"
            aria-checked={moveOn}
            className="appza-post-composer-move-toggle"
            data-checked={moveOn ? 'yes' : 'no'}
            onClick={() => togglePostDraftMove(!moveOn)}
          >
            <span className="appza-post-composer-move-box">
              {moveOn && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 12.5 9 17.5 20 6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="appza-post-composer-move-label">{moveLabel}</span>
          </button>

          {moveOn && (
            <button
              type="button"
              className="appza-post-composer-move-space"
              onClick={() => {
                if (!action) return;
                dispatch({ ...action, args: { ...(action.args ?? {}), mode: 'move' } });
              }}
            >
              {!moveIsProfile && (moveLogo || moveEmoji) && (
                <span className="appza-post-composer-move-badge">
                  {moveLogo ? (
                    <img src={moveLogo} alt="" />
                  ) : (
                    <span className="appza-post-composer-space-emoji">{moveEmoji}</span>
                  )}
                </span>
              )}
              <span className="appza-post-composer-move-name">{moveSpaceLabel}</span>
              {spaceChevron && (
                <IonIcon
                  className="appza-post-composer-move-chevron"
                  icon={spaceChevron}
                  aria-hidden="true"
                />
              )}
            </button>
          )}
        </span>
      )}

      {topicsVisible && (
        <span className="appza-post-composer-topics">
          <span className="appza-post-composer-topics-label" data-cap-hit={capHit ? 'yes' : 'no'}>
            {topicsLabelTemplate.replace('{max}', String(maxTopics))}
          </span>
          <span className="appza-post-composer-topics-chips">
            {topics.map((topic) => {
              const picked = draft.topic_ids.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  className="appza-post-composer-topic"
                  data-picked={picked ? 'yes' : 'no'}
                  onClick={() => {
                    if (!togglePostDraftTopic(topic.id, maxTopics)) setCapHit(true);
                  }}
                >
                  {topic.title}
                </button>
              );
            })}
          </span>
        </span>
      )}

      {titleVisible && (
        <span className="appza-post-composer-title-wrap">
          <textarea
            ref={titleRef}
            className="appza-post-composer-title"
            rows={1}
            placeholder={titleRequired ? titlePlaceholderRequired : titlePlaceholderOptional}
            value={draft.title}
            onChange={(e) => setPostDraft({ title: e.target.value.replace(/\n/g, '') })}
          />
        </span>
      )}

      <textarea
        ref={bodyRef}
        className="appza-post-composer-body"
        rows={1}
        placeholder={titleVisible ? bodyPlaceholder : bodyPlaceholderNoTitle}
        value={draft.body}
        onChange={(e) => setPostDraft({ body: e.target.value })}
      />

      {/* FC stores one content_type per post, so video and images are exclusive. */}
      {showMedia && draft.video && (
        <AppzaDraftVideo
          video={draft.video}
          onRemove={removePostDraftVideo}
          removeIcon={str(overrides, 'remove_icon') || 'close'}
        />
      )}

      {/* Audio lives in meta.audio_medias, so it may accompany images. */}
      {showMedia && draft.audios.length > 0 && (
        <AppzaDraftAudioList
          audios={draft.audios}
          overrides={overrides}
          onRemove={removePostDraftAudio}
          removeIcon={str(overrides, 'remove_icon') || 'close'}
        />
      )}

      {showMedia && images.length > 0 && (
        <span
          className="appza-post-composer-images"
          data-count={images.length === 1 ? 'one' : 'many'}
        >
          {images.map((image) => (
            <span key={image.url} className="appza-post-composer-image">
              <img src={image.url} alt="" />
              <button
                type="button"
                className="appza-post-composer-image-remove"
                aria-label="Remove image"
                onClick={() => removePostDraftImage(image.url)}
              >
                {removeIcon ? <IonIcon icon={removeIcon} /> : '×'}
              </button>
            </span>
          ))}
        </span>
      )}

      {showMedia && draft.poll && (
        <AppzaDraftPollStrip
          poll={draft.poll}
          label={str(overrides, 'poll_label') || 'Poll'}
          optionsLabel={str(overrides, 'poll_options_label') || '{n} options'}
          separator={str(overrides, 'poll_separator') || ' . '}
          editLabel={str(overrides, 'poll_edit_label') || 'Edit'}
          icon={str(overrides, 'poll_strip_icon') || 'stats-chart-outline'}
          removeIcon={str(overrides, 'remove_icon') || 'close'}
          onEdit={requestPollSheet}
          onRemove={removePostDraftPoll}
        />
      )}

      {showMedia && draft.documents.length > 0 && (
        <AppzaDraftDocumentList
          documents={draft.documents}
          labels={{
            fileIcon: str(overrides, 'doc_file_icon') || 'document-outline',
            renameIcon: str(overrides, 'doc_rename_icon') || 'create-outline',
            deleteIcon: str(overrides, 'doc_delete_icon') || 'trash-outline',
            downloadIcon: str(overrides, 'doc_download_icon') || 'download-outline',
            renamePrompt: str(overrides, 'doc_rename_label') || 'Rename file',
          }}
          onRename={requestDocumentRename}
          onRemove={requestDocumentRemove}
        />
      )}
    </span>
  );
}

const DESIGN_TIME_TOPICS = [
  { id: '__sample-1', title: 'Great', slug: 'great' },
  { id: '__sample-2', title: 'Media', slug: 'media' },
  { id: '__sample-3', title: 'Special', slug: 'special' },
];

/** FC ignores the announce flag for non-moderators; the placement gates on state.post_draft.can_announce. */
export function AppzaPostAnnounce({ overrides }: { overrides?: Record<string, unknown> }) {
  const draft = usePostDraft();
  const label =
    str(overrides, 'label') || 'Send announcement email to space member';
  const checked = draft.announcement;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className="appza-post-announce"
      data-checked={checked ? 'yes' : 'no'}
      onClick={() => setPostDraft({ announcement: !checked })}
    >
      <span className="appza-post-announce-box">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 12.5 9 17.5 20 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="appza-post-announce-label">{label}</span>
    </button>
  );
}
