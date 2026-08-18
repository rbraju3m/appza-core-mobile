import { useEffect, useState } from 'react';

// Conversation screen controls — which thread is open, what is being
// replied to, which message is selected, and the composer's text.
//
// Written by the App-side dispatchers (chat.open, chat.reply_start,
// chat.reply_cancel, chat.select_message, chat.set_draft) and by the
// chat bubble itself, which owns two gestures the action layer cannot
// express: a horizontal drag past a threshold starts a reply, a tap on
// your own message reveals the trash.
//
// Mirrors the spacesControls / spaceDetailControls event-backed store
// pattern — small enough to keep duplicated rather than abstract into a
// slice manager.
//
// NOT persisted, and that is the whole difference from the other two
// slices. Every key here describes one visit to one conversation: a
// restored `thread_id` would fetch a conversation the user is no longer
// looking at, and a restored reply target would attach the next message
// to a quote the composer is not showing.

export type ChatControls = {
  /** The open conversation, when it was addressed by id. */
  thread_id: string;
  /**
   * The open conversation, when it was addressed by space slug — which
   * is all the CHAT sub-tab knows. Both data sources bind both and the
   * endpoint falls through to whichever is set.
   */
  space_slug: string;
  /**
   * Derived, NOT authored: the message list publishes 'list' | 'empty' |
   * 'loading' after each fetch, and the empty-state placement gates on
   * it. Same contract as documents_view / media_view, and it exists for
   * the same reason — a placement can read state but cannot count rows
   * (P75).
   */
  messages_view: string;
  /** The message being replied to. Empty string means no reply pending. */
  reply_to_id: string;
  reply_to_name: string;
  reply_to_text: string;
  /**
   * The message whose delete affordance is showing. One at a time: the
   * design puts the trash beside a single bubble, and tapping a second
   * message should move it rather than accumulate.
   */
  active_message_id: string;
  /**
   * Composer text. Held here rather than in the DOM because other
   * actions write it — clearing after a send, and restoring a draft when
   * a reply is cancelled — and an uncontrolled field cannot be written
   * to from outside.
   */
  draft: string;
  /**
   * Images picked but not yet sent, as the URLs the upload returned.
   * The send call passes them as `mediaItems`.
   */
  attachments: string[];
  /** True while an attachment upload is in flight. */
  uploading: boolean;
};

const EVENT = 'appza:chat-controls-change';

const DEFAULTS: ChatControls = {
  thread_id: '',
  space_slug: '',
  messages_view: 'loading',
  reply_to_id: '',
  reply_to_name: '',
  reply_to_text: '',
  active_message_id: '',
  draft: '',
  attachments: [],
  uploading: false,
};

let current: ChatControls = { ...DEFAULTS };

export function getChatControls(): ChatControls {
  return current;
}

export function setChatControls(patch: Partial<ChatControls>): void {
  const next: ChatControls = {
    thread_id: typeof patch.thread_id === 'string' ? patch.thread_id : current.thread_id,
    space_slug: typeof patch.space_slug === 'string' ? patch.space_slug : current.space_slug,
    messages_view:
      typeof patch.messages_view === 'string' ? patch.messages_view : current.messages_view,
    reply_to_id: typeof patch.reply_to_id === 'string' ? patch.reply_to_id : current.reply_to_id,
    reply_to_name:
      typeof patch.reply_to_name === 'string' ? patch.reply_to_name : current.reply_to_name,
    reply_to_text:
      typeof patch.reply_to_text === 'string' ? patch.reply_to_text : current.reply_to_text,
    active_message_id:
      typeof patch.active_message_id === 'string'
        ? patch.active_message_id
        : current.active_message_id,
    draft: typeof patch.draft === 'string' ? patch.draft : current.draft,
    attachments: Array.isArray(patch.attachments) ? patch.attachments : current.attachments,
    uploading: typeof patch.uploading === 'boolean' ? patch.uploading : current.uploading,
  };

  // Opening a different conversation resets everything that described
  // the previous one. Without this a reply target survives the switch
  // and the next message is sent quoting something from another thread —
  // the same invariant spaceDetailControls enforces when the sub-tab or
  // the space changes, and for the same reason: the state outlives the
  // screen that produced it.
  const switched =
    next.thread_id !== current.thread_id || next.space_slug !== current.space_slug;
  if (switched) {
    next.messages_view =
      typeof patch.messages_view === 'string' ? patch.messages_view : 'loading';
    next.reply_to_id = '';
    next.reply_to_name = '';
    next.reply_to_text = '';
    next.active_message_id = '';
    next.draft = '';
    next.attachments = [];
    next.uploading = false;
  }

  if (
    next.thread_id === current.thread_id &&
    next.space_slug === current.space_slug &&
    next.messages_view === current.messages_view &&
    next.reply_to_id === current.reply_to_id &&
    next.reply_to_name === current.reply_to_name &&
    next.reply_to_text === current.reply_to_text &&
    next.active_message_id === current.active_message_id &&
    next.draft === current.draft &&
    next.attachments === current.attachments &&
    next.uploading === current.uploading
  ) {
    return;
  }

  current = next;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
}

/** Clear the pending reply without touching the draft the user has typed. */
export function clearChatReply(): void {
  setChatControls({ reply_to_id: '', reply_to_name: '', reply_to_text: '' });
}

export function useChatControls(): ChatControls {
  const [state, setState] = useState<ChatControls>(current);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(current);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return state;
}
