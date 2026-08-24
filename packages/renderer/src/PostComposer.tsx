import { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';

import { resolveIcon } from './PrimitiveRenderer';
import {
  removePostDraftImage,
  setPostDraft,
  togglePostDraftTopic,
  usePostDraft,
} from './postDraft';
import { useFcRuntimeSettings } from './fcRuntimeSettings';
import type { ActionInvocation, ActionDispatch } from './actionContext';

/**
 * The create-post card's interior: the "Posted in:" row, the title
 * field, the body field and the topic chips.
 *
 * Bespoke rather than composed for the reason the chat composer is —
 * both fields are CONTROLLED against the postDraft slice, because other
 * things write them. Opening the screen from a post's 3-dot menu
 * prefills the draft; picking a space replaces the topic chips and
 * clears a selection the new space has never heard of; posting clears
 * everything. An uncontrolled field cannot be written to from outside.
 *
 * The card FRAME and the five attach glyphs are NOT in here. The glyphs
 * stay sibling ion-buttons so each keeps its own catalog action wiring
 * (each carries a different endpoint) and its own row in the right-hand
 * Properties panel; the frame is the Superstructure wrapper. What is
 * left is exactly the part that has to be controlled.
 *
 * Which of the three title states draws is FluentCommunity's
 * `post_title_pref` (Settings → Customization → Post Title), read from
 * the runtime-settings store — Noor's designs 1, 2 and 3. `title_mode`
 * overrides it per placement for an author who wants one screen to
 * differ from the site default.
 *
 * The space chip is this component's own action because the tap target
 * sits inside a card the user also types in: the primitive is registered
 * as self-dispatching so a tap on the body does not open the picker.
 */

export type PostComposerProps = {
  overrides?: Record<string, unknown>;
  /** The `on_tap_space` wiring resolved from the AppZet. */
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

/**
 * True in the builder's Edit mode — inside the device frame, but not in
 * the App-mode canvas. Design time has no draft, so every part draws
 * with sample content; a block gated on real state would render nothing
 * and be unselectable, which is how a control becomes invisible to the
 * person meant to style it (P73).
 */
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
    // Re-read when the mode changes. A one-shot check on mount looks
    // equivalent and is not: App mode is a class toggled on an ancestor,
    // so a composer that happened to mount first stays on sample content
    // for the rest of the session — which reads as "the real data never
    // arrived" rather than "this is the design-time view".
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    return () => observer.disconnect();
  }, []);
  return designTime;
}

/** Grow a textarea with its content instead of scrolling inside a fixed box. */
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

  // Two body placeholders because the designs use two. With no title
  // field the body is the first thing you meet and reads as an invitation
  // ("Share your thoughts"); under a title it is the second field and
  // reads as a continuation ("How's it going?").
  const bodyPlaceholder = str(overrides, 'body_placeholder') || "How's it going?";
  const bodyPlaceholderNoTitle =
    str(overrides, 'body_placeholder_no_title') || 'Share your thoughts';

  // "{max}" is substituted with the site's max_topics_per_post, so the
  // label states the real limit rather than repeating a number that has
  // to be kept in sync by hand.
  const topicsLabelTemplate = str(overrides, 'topics_label') || 'Topic.up to {max}';

  const removeIcon = resolveIcon(str(overrides, 'remove_icon') || 'close');
  const showMedia = bool(overrides, 'show_media', true);

  const showTopics = bool(overrides, 'show_topics', true);
  const showTitle = bool(overrides, 'show_title', true);
  const showPostedIn = bool(overrides, 'show_posted_in', true);

  // 'auto' follows the site setting, which is what every screen wants
  // unless an author has deliberately overridden it.
  const titleModeProp = str(overrides, 'title_mode') || 'auto';
  const titlePref = titleModeProp === 'auto' ? settings.post_title_pref : titleModeProp;
  const titleVisible = showTitle && titlePref !== 'disabled' && titlePref !== 'hidden';
  const titleRequired = titlePref === 'required';

  const maxTopics = settings.max_topics_per_post;
  const topics = designTime && draft.topics.length === 0 ? DESIGN_TIME_TOPICS : draft.topics;
  const topicsVisible = showTopics && topics.length > 0;

  // Flashes the label when a tap is refused for hitting the cap. The
  // design has no error text — the limit is stated in the label, so the
  // label is what answers.
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

  return (
    <span className="appza-post-composer">
      {showPostedIn && (
        <span className="appza-post-composer-postedin">
          <span className="appza-post-composer-postedin-label">{postedInLabel}</span>
          <button
            type="button"
            className="appza-post-composer-space"
            data-chosen={showChip ? 'yes' : 'no'}
            onClick={() => {
              if (!action) return;
              dispatch(action);
            }}
          >
            {showChip && !isProfile && (draft.space_logo || draft.space_emoji || designTime) && (
              <span className="appza-post-composer-space-badge">
                {draft.space_logo ? (
                  <img src={draft.space_logo} alt="" />
                ) : (
                  <span className="appza-post-composer-space-emoji">
                    {draft.space_emoji || '🙂'}
                  </span>
                )}
              </span>
            )}
            <span className="appza-post-composer-space-name">{spaceLabel}</span>
            {spaceChevron && (
              <IonIcon
                className="appza-post-composer-space-chevron"
                icon={spaceChevron}
                aria-hidden="true"
              />
            )}
          </button>
        </span>
      )}

      {/* Topics sit between the "Posted in:" row and the title. Every
          design that shows both puts them there — the chips describe the
          destination, so they belong with it rather than with the text. */}
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
            // A textarea rather than an input so a long title wraps
            // instead of scrolling sideways — FluentCommunity allows 192
            // characters and the design shows the whole line.
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

      {/* Attached images, under the body and above the action bar —
          designs 10 (one, full width) and 13 (a grid). One image is not a
          one-cell grid: the design gives it the whole card width, and a
          third-width thumbnail of a single photo reads as a mistake. */}
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
    </span>
  );
}

// Sample chips so the Topics group in the Properties panel has something
// to style against. Never reached at runtime — a real draft either has
// topics from its space or hides the block.
const DESIGN_TIME_TOPICS = [
  { id: '__sample-1', title: 'Great', slug: 'great' },
  { id: '__sample-2', title: 'Media', slug: 'media' },
  { id: '__sample-3', title: 'Special', slug: 'special' },
];

/**
 * "Send announcement email to space member" — the row under the card.
 *
 * Its own primitive on its own placement rather than a child of the
 * composer, because the designs put it outside the card and because
 * whether it exists at all is a per-viewer question: FluentCommunity
 * ignores the flag for anyone who is not a moderator of the space being
 * posted to (FeedsController::create). The placement gates on
 * `state.post_draft.can_announce`, so Noor's design 4 — a member seeing
 * no email row and no schedule control — is a catalog decision rather
 * than a branch in this file.
 *
 * Controlled, like the fields: choosing a different space clears it,
 * because it is a permission on the destination and not a preference of
 * the author's.
 */
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
        {/* Drawn inline rather than as an ionicon: the design shows a
            tick in BOTH states — outlined when off, white on blue when
            on — and no registry glyph carries the unchecked half. */}
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
