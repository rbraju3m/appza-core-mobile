import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { useBackDismiss } from './backStack';

// Bottom-sheet role picker opened when the member overflow menu's
// "Change Membership" row fires (member.change_role). Each role row
// dispatches `member.set_role` with the picked value — the dispatcher in
// App.tsx handles the HTTP call (POST /spaces/add-member with role).
//
// Design: uppercase subject header, bold "Change Membership" title,
// selectable row for each role (icon + label), current role gets a
// highlighted background + a check icon on the right.

export type MemberRoleOption = {
  value: string;
  label: string;
  icon?: string;
};

const OPEN_EVENT = 'appza:open-member-role-sheet';
const CLOSE_EVENT = 'appza:close-member-role-sheet';

type OpenDetail = {
  subject: string;
  currentRole: string;
  roles: MemberRoleOption[];
  item: unknown;
  setRoleActionSlug?: string;
  setRoleArgs?: Record<string, unknown>;
};

export function openMemberRoleSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeMemberRoleSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function MemberRoleSheet() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const dispatch = useActionDispatch();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  useBackDismiss(!(!open || !detail), () => setOpen(false));

  if (!open || !detail) return null;

  const handlePick = (role: MemberRoleOption) => {
    setOpen(false);
    if (role.value === detail.currentRole) return;
    const actionSlug = detail.setRoleActionSlug ?? 'member.set_role';
    const defaults = readActionDefaultsFromCatalog(actionSlug);
    dispatch({
      action_slug: actionSlug,
      args: { ...(defaults ?? {}), ...(detail.setRoleArgs ?? {}), role: role.value },
      item: detail.item,
    });
  };

  const checkIcon = resolveIcon('checkmark');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Change membership for ${detail.subject}`}
      className="appza-member-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="appza-member-sheet">
        <div className="appza-member-sheet-handle" />
        <div className="appza-member-sheet-subject">{(detail.subject || '').toUpperCase()}</div>
        <div className="appza-member-sheet-title">Change Membership</div>
        <div className="appza-member-sheet-list">
          {detail.roles.map((role) => {
            const isCurrent = role.value === detail.currentRole;
            const resolved = role.icon ? resolveIcon(role.icon) : null;
            return (
              <button
                key={role.value}
                type="button"
                className={
                  'appza-member-sheet-row appza-member-role-row' +
                  (isCurrent ? ' is-current' : '')
                }
                onClick={() => handlePick(role)}
              >
                {resolved && <IonIcon icon={resolved} className="appza-member-sheet-icon" />}
                <span className="appza-member-role-label">{role.label}</span>
                {isCurrent && checkIcon && (
                  <IonIcon icon={checkIcon} className="appza-member-role-check" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
