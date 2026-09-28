import type { CSSProperties } from 'react';
import { sendJson, type StoredAuthLike } from './postMenuHandlers';
import { openNewMessageModal } from './NewMessageModal';
import { newMessagePresentation } from './modalPresentation';

// FC finds an existing thread or creates one with its first message, so SEND is one call; its body key is `message`, not `text`.

export type ProfileNewMessageDeps = {
  auth: StoredAuthLike | null;
  authHeader: (auth: StoredAuthLike) => string;
  onError: (msg: string) => void;
  onInfo: (msg: string) => void;
  requireAuth: () => void;
  readPath: (item: unknown, path: string) => unknown;
  modalProps: (slug: string) => Record<string, unknown>;
  modalChildStyles: (slug: string) => Record<number, CSSProperties>;
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function openProfileNewMessage(
  args: Record<string, unknown>,
  item: unknown,
  deps: ProfileNewMessageDeps,
): void {
  const { auth } = deps;
  if (!auth) {
    deps.requireAuth();
    return;
  }

  const rawMember = deps.readPath(item, str(args.member_id_path) ?? 'data.user_id');
  const memberId =
    typeof rawMember === 'number'
      ? rawMember
      : typeof rawMember === 'string' && rawMember !== '' && !Number.isNaN(Number(rawMember))
        ? Number(rawMember)
        : null;
  if (memberId === null) {
    deps.onError('Could not identify who to message.');
    return;
  }

  const name = deps.readPath(item, str(args.name_path) ?? 'data.display_name');
  const avatar = deps.readPath(item, str(args.avatar_path) ?? 'data.avatar');
  const slug = str(args.modal_appzet_slug) ?? 'fc-new-message-modal';
  const endpoint = str(args.endpoint) ?? '/wp-json/fcom-mobile/api/v1/chat/threads/create';
  const sentMessage = str(args.success_message) ?? 'Message sent';

  openNewMessageModal({
    appzetSlug: slug,
    presentation: newMessagePresentation(deps.modalProps(slug)),
    childStyles: deps.modalChildStyles(slug),
    recipient: {
      name: typeof name === 'string' ? name : '',
      avatar: typeof avatar === 'string' && avatar ? avatar : undefined,
    },
    onSend: async (text) => {
      const result = await sendJson(
        endpoint,
        'POST',
        { message: text, intent_id: memberId, intent_type: 'user' },
        auth,
        deps.authHeader,
      );
      if (!result.ok) {
        // FluentCommunity's own error (messaging off, private profile, block) beats a generic one.
        deps.onError(result.error);
        return false;
      }
      deps.onInfo(sentMessage);
      return true;
    },
  });
}
