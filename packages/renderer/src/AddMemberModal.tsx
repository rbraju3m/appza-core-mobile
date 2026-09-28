import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { appzetAttrs, childAttrs } from './designTimeAttrs';
import { useBackDismiss } from './backStack';

const DEFAULT_APPZET_SLUG = 'fc-add-member-modal';

export type AddMemberRoleOption = {
  value: string;
  label: string;
  icon?: string;
};

export type AddMemberUser = {
  user_id?: number | string;
  id?: number | string;
  xprofile?: {
    display_name?: string;
    email?: string;
    user_email?: string;
    user_nicename?: string;
    avatar?: string;
    total_points?: number;
  };
};

const OPEN_EVENT = 'appza:open-add-member-modal';
const CLOSE_EVENT = 'appza:close-add-member-modal';
const PATCH_EVENT = 'appza:patch-add-member-modal';

type OpenDetail = {
  title?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  roleLabel?: string;
  rolePlaceholder?: string;
  submitLabelEmpty?: string;
  submitLabelTemplate?: string;
  roles: AddMemberRoleOption[];
  usersEndpoint?: string;
  spaceSlug?: string;
  authHeader?: string;
  // X-WP-Nonce lets plugin-admin authenticate via the WP cookie; without it the picker 401s.
  restNonce?: string;
  submitActionSlug?: string;
  submitArgs?: Record<string, unknown>;
  appzetSlug?: string;

  hidden?: boolean;
  showClose?: boolean;

  closeIcon?: string;
  searchIcon?: string;
  modalMaxWidth?: string;
  modalPadding?: string;
  sectionGap?: string;
  modalRadius?: string;
  modalBgColor?: string;
  backdropColor?: string;
  searchBgColor?: string;
  searchBorderColor?: string;
  searchTextColor?: string;
  roleBgColor?: string;
  roleBorderColor?: string;
  roleTextColor?: string;
  chipBgColor?: string;
  chipTextColor?: string;
  submitBgColor?: string;
  submitTextColor?: string;
  submitRadius?: string;
  submitDisabledBgColor?: string;

  childStyles?: Record<number, CSSProperties>;
};

type PatchDetail = { appzetSlug: string; patch: Partial<OpenDetail> };

export function openAddMemberModal(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeAddMemberModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

// Patches in place: re-opening would drop the search text and picked user.
export function patchAddMemberModal(
  appzetSlug: string,
  patch: Partial<OpenDetail>,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<PatchDetail>(PATCH_EVENT, { detail: { appzetSlug, patch } }),
  );
}

function initials(name: string | undefined | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '??';
}

function fillTemplate(tpl: string, role: AddMemberRoleOption | null): string {
  if (!tpl) return '';
  return tpl.replace(/\{role(?::(\w+))?(?:\|(\w+))?\}/g, (_m, _field, filter) => {
    const value = role?.label ?? '';
    if (filter === 'upper') return value.toUpperCase();
    if (filter === 'lower') return value.toLowerCase();
    return value;
  });
}

export function AddMemberModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [users, setUsers] = useState<AddMemberUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AddMemberUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<AddMemberRoleOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const dispatch = useActionDispatch();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setQuery('');
      setDebouncedQuery('');
      setUsers([]);
      setError(null);
      setSelectedUser(null);
      setSelectedRole(null);
      setSubmitting(false);
      setRoleOpen(false);
      // Spinner on first paint: the fetch effect's setLoading lands a render late.
      setLoading(true);
      setOpen(true);
    };
    const onClose = () => {
      setOpen(false);
      setSubmitting(false);
    };
    const onPatch = (e: Event) => {
      const ce = e as CustomEvent<PatchDetail>;
      if (!ce.detail) return;
      const { appzetSlug, patch } = ce.detail;
      setDetail((prev) => {
        if (!prev) return prev;
        const mine = prev.appzetSlug ?? DEFAULT_APPZET_SLUG;
        return mine === appzetSlug ? { ...prev, ...patch } : prev;
      });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener(PATCH_EVENT, onPatch);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener(PATCH_EVENT, onPatch);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query, open]);

  useEffect(() => {
    if (!open || !detail || selectedUser) return;
    const endpoint = detail.usersEndpoint;
    if (!endpoint) {
      setError('User search endpoint not configured.');
      setUsers([]);
      return;
    }
    const controller = new AbortController();
    const url = new URL(endpoint, window.location.origin);
    if (debouncedQuery) url.searchParams.set('search', debouncedQuery);
    if (detail.spaceSlug) url.searchParams.set('space_slug', detail.spaceSlug);
    url.searchParams.set('per_page', '20');

    setLoading(true);
    setError(null);
    void fetch(url.toString(), {
      method: 'GET',
      credentials: detail.restNonce ? 'include' : 'omit',
      headers: {
        Accept: 'application/json',
        ...(detail.restNonce ? { 'X-WP-Nonce': detail.restNonce } : {}),
        ...(detail.authHeader ? { Authorization: detail.authHeader } : {}),
      },
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        const jsonRec =
          json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
        const inner =
          jsonRec && 'response' in jsonRec
            ? (jsonRec.response as Record<string, unknown> | undefined)
            : undefined;
        // Payload shape varies by endpoint: top-level data, response.data/items, or a bare array.
        const dataArr = Array.isArray(jsonRec?.data)
          ? (jsonRec!.data as unknown[])
          : Array.isArray(jsonRec?.items)
            ? (jsonRec!.items as unknown[])
            : Array.isArray(inner?.data)
              ? (inner!.data as unknown[])
              : Array.isArray(inner?.items)
                ? (inner!.items as unknown[])
                : Array.isArray(json)
                  ? (json as unknown[])
                  : [];
        if (!res.ok) {
          const msg =
            (inner && typeof inner.message === 'string' && inner.message) ||
            (jsonRec && typeof jsonRec.message === 'string' && (jsonRec.message as string)) ||
            `Could not load users (HTTP ${res.status}).`;
          throw new Error(msg);
        }
        setUsers(dataArr as AddMemberUser[]);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setUsers([]);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, detail, debouncedQuery, selectedUser]);

  const submitLabel = useMemo(() => {
    if (!detail) return 'ADD AS';
    if (!selectedRole) return detail.submitLabelEmpty ?? 'ADD AS';
    const tpl = detail.submitLabelTemplate ?? 'ADD AS {role|upper}';
    return fillTemplate(tpl, selectedRole);
  }, [detail, selectedRole]);

  useBackDismiss(!(!open || !detail), () => handleClose());

  if (!open || !detail) return null;
  if (detail.hidden) return null;

  const closeIcon = resolveIcon(detail.closeIcon ?? 'close');
  const searchIcon = resolveIcon(detail.searchIcon ?? 'search');
  const caretIcon = roleOpen ? resolveIcon('chevron-up') : resolveIcon('chevron-down');
  const chipCloseIcon = resolveIcon('close');

  const styleVars = {
    '--appza-am-backdrop': detail.backdropColor,
    '--appza-am-bg': detail.modalBgColor,
    '--appza-am-radius': detail.modalRadius,
    '--appza-am-max-width': detail.modalMaxWidth,
    '--appza-am-padding': detail.modalPadding,
    '--appza-am-gap': detail.sectionGap,
    '--appza-am-search-bg': detail.searchBgColor,
    '--appza-am-search-border': detail.searchBorderColor,
    '--appza-am-search-text': detail.searchTextColor,
    '--appza-am-role-bg': detail.roleBgColor,
    '--appza-am-role-border': detail.roleBorderColor,
    '--appza-am-role-text': detail.roleTextColor,
    '--appza-am-chip-bg': detail.chipBgColor,
    '--appza-am-chip-text': detail.chipTextColor,
    '--appza-am-submit-bg': detail.submitBgColor,
    '--appza-am-submit-text': detail.submitTextColor,
    '--appza-am-submit-radius': detail.submitRadius,
    '--appza-am-submit-disabled-bg': detail.submitDisabledBgColor,
  } as CSSProperties;

  const childStyle = (idx: number): CSSProperties | undefined =>
    detail.childStyles?.[idx];

  const canSubmit = Boolean(selectedUser && selectedRole && !submitting);

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
  };
  const handleSelectUser = (u: AddMemberUser) => {
    setSelectedUser(u);
    setUsers([]);
    setError(null);
  };
  const handleClearUser = () => {
    setSelectedUser(null);
    setSelectedRole(null);
    setQuery('');
    setDebouncedQuery('');
  };
  const handlePickRole = (r: AddMemberRoleOption) => {
    setSelectedRole(r);
    setRoleOpen(false);
  };
  const handleSubmit = () => {
    if (!canSubmit || !selectedUser || !selectedRole) return;
    setSubmitting(true);
    const actionSlug = detail.submitActionSlug ?? 'member.add';
    const defaults = readActionDefaultsFromCatalog(actionSlug) ?? {};
    const userId = selectedUser.user_id ?? selectedUser.id ?? null;
    dispatch({
      action_slug: actionSlug,
      args: {
        ...defaults,
        ...(detail.submitArgs ?? {}),
        user_id: userId,
        role: selectedRole.value,
      },
    });
    // Fallback close so a broken handler can't strand the modal open.
    window.setTimeout(() => {
      setSubmitting(false);
      setOpen(false);
    }, 1500);
  };

  const displayName = (u: AddMemberUser): string =>
    u.xprofile?.display_name ?? '';
  const displayEmail = (u: AddMemberUser): string =>
    u.xprofile?.email ?? u.xprofile?.user_email ?? '';

  const selectedName = selectedUser ? displayName(selectedUser) : '';
  const az = detail.appzetSlug ?? DEFAULT_APPZET_SLUG;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.title ?? 'Add Member'}
      className="appza-add-member-backdrop"
      style={styleVars}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="appza-add-member-modal" {...appzetAttrs(az)}>
        <div className="appza-add-member-header">
          <div
            className="appza-add-member-title"
            style={childStyle(0)}
            {...childAttrs(az, 0, 'ion-text')}
          >
            {detail.title ?? 'Add Member'}
          </div>
          {detail.showClose !== false && (
            <button
              type="button"
              className="appza-add-member-close"
              aria-label="Close"
              onClick={handleClose}
              disabled={submitting}
              style={childStyle(1)}
              {...childAttrs(az, 1, 'ion-button')}
            >
              {closeIcon && <IonIcon icon={closeIcon} />}
            </button>
          )}
        </div>

        <div className="appza-add-member-body">
          <div
            className="appza-add-member-label"
            style={childStyle(2)}
            {...childAttrs(az, 2, 'ion-text')}
          >
            {detail.searchLabel ?? 'Search for an existing user'}
          </div>

          {!selectedUser && (
            <>
              <div
                className="appza-add-member-search"
                style={childStyle(3)}
                {...childAttrs(az, 3, 'ion-input')}
              >
                {searchIcon && (
                  <IonIcon icon={searchIcon} className="appza-add-member-search-icon" />
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  className="appza-add-member-search-input"
                  placeholder={detail.searchPlaceholder ?? 'Search members...'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div
                className="appza-add-member-list"
                style={childStyle(4)}
                {...childAttrs(az, 4, 'ion-list')}
              >
                {loading && (
                  <div className="appza-add-member-empty">Searching…</div>
                )}
                {!loading && error && (
                  <div className="appza-add-member-error">{error}</div>
                )}
                {!loading && !error && users.length === 0 && (
                  <div className="appza-add-member-empty">
                    {debouncedQuery ? 'No matches.' : 'No users available to add.'}
                  </div>
                )}
                {!loading &&
                  !error &&
                  users.map((u) => {
                    const key = `${u.user_id ?? u.id ?? Math.random()}`;
                    const name = displayName(u);
                    const email = displayEmail(u);
                    const avatarUrl = u.xprofile?.avatar;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="appza-add-member-row"
                        onClick={() => handleSelectUser(u)}
                      >
                        <span className="appza-add-member-avatar">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" />
                          ) : (
                            <span className="appza-add-member-initials">
                              {initials(name)}
                            </span>
                          )}
                        </span>
                        <span className="appza-add-member-row-text">
                          <span className="appza-add-member-name">{name || 'Unknown'}</span>
                          {email && (
                            <span className="appza-add-member-email">{email}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </>
          )}

          {selectedUser && (
            <div
              className="appza-add-member-chip-row"
              style={childStyle(5)}
              {...childAttrs(az, 5, 'ion-chip')}
            >
              <div className="appza-add-member-chip">
                <span className="appza-add-member-chip-label">
                  {selectedName || 'Selected user'}
                </span>
                <button
                  type="button"
                  className="appza-add-member-chip-clear"
                  onClick={handleClearUser}
                  aria-label="Clear selected user"
                  disabled={submitting}
                >
                  {chipCloseIcon && <IonIcon icon={chipCloseIcon} />}
                </button>
              </div>
            </div>
          )}

          <div
            className="appza-add-member-label appza-add-member-label--role"
            style={childStyle(6)}
            {...childAttrs(az, 6, 'ion-text')}
          >
            {detail.roleLabel ?? 'Membership Role'}
          </div>

          <div
            className="appza-add-member-role"
            style={childStyle(7)}
            {...childAttrs(az, 7, 'ion-select')}
          >
            <button
              type="button"
              className={
                'appza-add-member-role-trigger' + (roleOpen ? ' is-open' : '')
              }
              onClick={() => setRoleOpen((v) => !v)}
              disabled={submitting}
            >
              <span
                className={
                  'appza-add-member-role-value' +
                  (selectedRole ? '' : ' is-placeholder')
                }
              >
                {selectedRole?.label ?? detail.rolePlaceholder ?? 'Member role'}
              </span>
              {caretIcon && (
                <IonIcon icon={caretIcon} className="appza-add-member-role-caret" />
              )}
            </button>
            {roleOpen && (
              <div className="appza-add-member-role-menu" role="listbox">
                {detail.roles.map((r) => {
                  const isCurrent = r.value === selectedRole?.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      className={
                        'appza-add-member-role-option' +
                        (isCurrent ? ' is-current' : '')
                      }
                      onClick={() => handlePickRole(r)}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tag on the footer: a disabled submit gets no clicks, so it would be unselectable. */}
        <div
          className="appza-add-member-footer"
          style={childStyle(8)}
          {...childAttrs(az, 8, 'ion-button')}
        >
          <button
            type="button"
            className={
              'appza-add-member-submit' + (canSubmit ? '' : ' is-disabled')
            }
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? 'Adding…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
