import { useEffect, useState } from 'react';

// Not persisted: a restored thread or reply target would act on a conversation no longer shown.

export type ChatControls = {
  thread_id: string;
  space_slug: string;
  // Derived: a placement can read state but cannot count rows.
  messages_view: string;
  reply_to_id: string;
  reply_to_name: string;
  reply_to_text: string;
  active_message_id: string;
  // Derived; the footer composer's gate. Starts 'no' until the thread resolves.
  can_send: string;
  // FC can't open an empty thread (POST /chat/threads requires `message`), so the first send creates it.
  intent_user_id: string;
  // Held here, not in the DOM: other actions write it.
  draft: string;
  attachments: string[];
  uploading: boolean;
};

const EVENT = 'appza:chat-controls-change';

const DEFAULTS: ChatControls = {
  thread_id: '',
  space_slug: '',
  messages_view: 'loading',
  can_send: 'no',
  intent_user_id: '',
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
    can_send: typeof patch.can_send === 'string' ? patch.can_send : current.can_send,
    intent_user_id:
      typeof patch.intent_user_id === 'string' ? patch.intent_user_id : current.intent_user_id,
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

  // Switching conversation (or intent) resets reply/draft so nothing leaks into another thread.
  const switched =
    next.thread_id !== current.thread_id ||
    next.space_slug !== current.space_slug ||
    next.intent_user_id !== current.intent_user_id;
  if (switched) {
    next.messages_view =
      typeof patch.messages_view === 'string' ? patch.messages_view : 'loading';
    next.can_send = typeof patch.can_send === 'string' ? patch.can_send : 'no';
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
    next.intent_user_id === current.intent_user_id &&
    next.messages_view === current.messages_view &&
    next.can_send === current.can_send &&
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
