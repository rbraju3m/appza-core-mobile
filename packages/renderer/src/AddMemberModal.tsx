import { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { appzetAttrs, childAttrs } from './designTimeAttrs';

// Slug of the catalog AppZet this modal stands in for. Used only to
// address the builder's Properties panel; the runtime never reads it.
const DEFAULT_APPZET_SLUG = 'fc-add-member-modal';

// Centered modal opened by member.add. Three visual states in one shell:
//   1. no user picked  → search input + result list
//   2. user picked     → chip with X on top; role dropdown enabled
//   3. role picked     → submit becomes "ADD AS {ROLE|upper}" + enabled
//
// Submit dispatches the wired submit action slug (default `member.add`)
// through the shared ActionDispatch context — the App.tsx handler owns
// the actual POST /wp-json/fcom-mobile/api/v1/spaces/add-member call.
// The picked user_id + role ride the invocation args, so the handler
// doesn't need to reach back into modal-local state.

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
  /**
   * WP REST nonce (window.appzaCoreConfig?.restNonce). Sent as
   * `X-WP-Nonce` on the users-search fetch when present. Lets the
   * plugin-admin authenticate via the WP session cookie instead of
   * relying on Basic Auth from the app-mode login flow — otherwise
   * the picker returns 401 whenever the site admin hasn't logged
   * into the mobile shell.
   */
  restNonce?: string;
  submitActionSlug?: string;
  submitArgs?: Record<string, unknown>;
  /**
   * Catalog slug of the AppZet whose props drove this open. Carried so
   * the builder can select the right row when the modal is clicked in
   * the simulator — the shell resolves it from the opener action's
   * `form_appzet_slug`, which may point at a customer's own variant.
   */
  appzetSlug?: string;
};

export function openAddMemberModal(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeAddMemberModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
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
      // Kick loading to true immediately so the initial paint shows
      // the spinner row instead of the "no users" empty state — the
      // fetch effect runs on the same tick but its own setLoading
      // lands on the next render.
      setLoading(true);
      setOpen(true);
    };
    const onClose = () => {
      setOpen(false);
      setSubmitting(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  // Focus the search input once the modal opens.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  // Debounce the search query (250ms) so we don't hammer the DS on
  // every keystroke.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query, open]);

  // Fetch users from the search endpoint whenever the debounced query
  // or space slug changes. The endpoint may not yet exist on the
  // fcom-mobile plugin — surface a soft warning instead of exploding.
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
    // Send cookies + WP nonce when the shell provided one so a
    // WP-admin session authenticates the request; fall back to
    // Basic Auth (mobile shell / app-mode) when nonce is missing.
    // WP core picks whichever wire the caller ships.
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
        // Payload shape varies: our appza-core endpoint puts data at the
        // top level (`{response:{status,message}, data:[]}`), fcom-mobile
        // endpoints usually put it inside `response.data` or `response.items`,
        // and raw WP list endpoints just return a top-level array. Try all.
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

  if (!open || !detail) return null;

  const closeIcon = resolveIcon(detail.rolePlaceholder ? 'close' : 'close');
  const searchIcon = resolveIcon('search');
  const caretIcon = roleOpen ? resolveIcon('chevron-up') : resolveIcon('chevron-down');
  const chipCloseIcon = resolveIcon('close');

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
    // The App.tsx handler decides when to close (success/failure). Fall
    // back to closing on our own after a short grace so a broken handler
    // doesn't strand the modal open forever.
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
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="appza-add-member-modal" {...appzetAttrs(az)}>
        <div className="appza-add-member-header">
          <div className="appza-add-member-title" {...childAttrs(az, 0, 'ion-text')}>
            {detail.title ?? 'Add Member'}
          </div>
          <button
            type="button"
            className="appza-add-member-close"
            aria-label="Close"
            onClick={handleClose}
            disabled={submitting}
            {...childAttrs(az, 1, 'ion-button')}
          >
            {closeIcon && <IonIcon icon={closeIcon} />}
          </button>
        </div>

        <div className="appza-add-member-body">
          <div className="appza-add-member-label" {...childAttrs(az, 2, 'ion-text')}>
            {detail.searchLabel ?? 'Search for an existing user'}
          </div>

          {!selectedUser && (
            <>
              <div className="appza-add-member-search" {...childAttrs(az, 3, 'ion-input')}>
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
              <div className="appza-add-member-list" {...childAttrs(az, 4, 'ion-list')}>
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
            <div className="appza-add-member-chip-row" {...childAttrs(az, 5, 'ion-chip')}>
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
            {...childAttrs(az, 6, 'ion-text')}
          >
            {detail.roleLabel ?? 'Membership Role'}
          </div>

          <div className="appza-add-member-role" {...childAttrs(az, 7, 'ion-select')}>
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

        <div className="appza-add-member-footer">
          <button
            type="button"
            className={
              'appza-add-member-submit' + (canSubmit ? '' : ' is-disabled')
            }
            onClick={handleSubmit}
            disabled={!canSubmit}
            {...childAttrs(az, 8, 'ion-button')}
          >
            {submitting ? 'Adding…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
