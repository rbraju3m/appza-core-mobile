import { useEffect, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { useBackDismiss } from './backStack';

export type MemberMenuItem = {
  action_slug: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  args?: Record<string, unknown>;
};

const OPEN_EVENT = 'appza:open-member-options-sheet';
const CLOSE_EVENT = 'appza:close-member-options-sheet';

type OpenDetail = {
  subject: string;
  items: MemberMenuItem[];
  item: unknown;
};

export function openMemberOptionsSheet(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeMemberOptionsSheet(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function MemberOptionsSheet() {
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

  const handlePick = (menuItem: MemberMenuItem) => {
    setOpen(false);
    // Merge the action's param_schema defaults under the row args; some actions' config lives entirely in defaults.
    const defaults = readActionDefaultsFromCatalog(menuItem.action_slug);
    const merged =
      defaults || menuItem.args
        ? { ...(defaults ?? {}), ...(menuItem.args ?? {}) }
        : undefined;
    dispatch({
      action_slug: menuItem.action_slug,
      args: merged,
      item: detail.item,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${detail.subject} actions`}
      className="appza-member-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="appza-member-sheet">
        <div className="appza-member-sheet-handle" />
        <div className="appza-member-sheet-subject">{(detail.subject || '').toUpperCase()}</div>
        <div className="appza-member-sheet-title">Member actions</div>
        <div className="appza-member-sheet-list">
          {detail.items.map((mi) => {
            const resolved = mi.icon ? resolveIcon(mi.icon) : null;
            return (
              <button
                key={mi.action_slug}
                type="button"
                className={
                  'appza-member-sheet-row' + (mi.destructive ? ' is-destructive' : '')
                }
                onClick={() => handlePick(mi)}
              >
                {resolved && <IonIcon icon={resolved} className="appza-member-sheet-icon" />}
                <span>{mi.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
