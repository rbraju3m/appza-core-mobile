import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { useInsideDeviceViewport } from './insideDeviceViewport';
import { appzetAttrs, childAttrs } from './designTimeAttrs';
import { useBackDismiss } from './backStack';

const DEFAULT_APPZET_SLUG = 'fc-invite-user-modal';

// Presentation only: HTTP, clipboard, toast and confirm live in App.tsx via ActionDispatch.

export type InviteRoleOption = {
  value: string;
  label: string;
};

export type InvitationRow = {
  id: number | string;
  title?: string;
  chip_label?: string;
  chip_tone?: string;
  meta_line?: string;
  invited_by?: string;
  access_url?: string;
  can_copy?: boolean;
  can_resend?: boolean;
  can_delete?: boolean;
};

export type InviteChipPalette = Record<string, { bg?: string; text?: string }>;

const OPEN_EVENT = 'appza:open-invite-user-modal';
const CLOSE_EVENT = 'appza:close-invite-user-modal';
const PATCH_EVENT = 'appza:patch-invite-user-modal';
const REFRESH_EVENT = 'appza:refresh-data';

type InviteTab = 'invitations' | 'invite';

type OpenDetail = {
  title?: string;
  tabInvitationsLabel?: string;
  tabInviteLabel?: string;
  showInvitationCount?: boolean;
  defaultTab?: InviteTab;
  copyLinkLabel?: string;
  copyLinkIcon?: string;
  resendLabel?: string;
  deleteIcon?: string;
  invitedByPrefix?: string;
  emptyLabel?: string;
  // Rides the dispatch so the action's param_schema defaults don't shadow the admin's copy.
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
  deleteCancelLabel?: string;
  deleteConfirmLabel?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  roleLabel?: string;
  rolePlaceholder?: string;
  roles: InviteRoleOption[];
  helperText?: string;
  submitLabelEmpty?: string;
  submitLabelTemplate?: string;
  chipPalette?: InviteChipPalette;
  copyLinkColor?: string;
  deleteColor?: string;
  submitBgColor?: string;
  submitTextColor?: string;
  submitDisabledBgColor?: string;
  listMaxHeight?: string;
  listEndpoint?: string;
  spaceSlug?: string;
  authHeader?: string;
  // Sent as X-WP-Nonce so plugin-admin authenticates via the WP cookie instead of Basic Auth.
  restNonce?: string;
  submitActionSlug?: string;
  submitArgs?: Record<string, unknown>;
  copyActionSlug?: string;
  resendActionSlug?: string;
  deleteActionSlug?: string;
  appzetSlug?: string;

  hidden?: boolean;
  showClose?: boolean;

  closeIcon?: string;
  modalMaxWidth?: string;
  modalPadding?: string;
  sectionGap?: string;
  modalRadius?: string;
  modalBgColor?: string;
  backdropColor?: string;
  tabBgColor?: string;
  tabActiveBgColor?: string;
  tabActiveTextColor?: string;
  tabTextColor?: string;
  rowTitleColor?: string;
  rowMetaColor?: string;
  fieldBgColor?: string;
  fieldBorderColor?: string;
  fieldTextColor?: string;
  fieldRadius?: string;
  helperTextColor?: string;
  submitRadius?: string;

  childStyles?: Record<number, CSSProperties>;
};

type PatchDetail = { appzetSlug: string; patch: Partial<OpenDetail> };

export function openInviteUserModal(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeInviteUserModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

// Patches in place: re-opening would reset the tab and a half-typed invite.
export function patchInviteUserModal(
  appzetSlug: string,
  patch: Partial<OpenDetail>,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<PatchDetail>(PATCH_EVENT, { detail: { appzetSlug, patch } }),
  );
}

function fillTemplate(tpl: string, role: InviteRoleOption | null): string {
  if (!tpl) return '';
  return tpl.replace(/\{role(?::(\w+))?(?:\|(\w+))?\}/g, (_m, _field, filter) => {
    const value = role?.label ?? '';
    if (filter === 'upper') return value.toUpperCase();
    if (filter === 'lower') return value.toLowerCase();
    return value;
  });
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function InviteUserModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [tab, setTab] = useState<InviteTab>('invitations');
  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<InviteRoleOption | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dispatch = useActionDispatch();
  const embedded = useInsideDeviceViewport(open);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<OpenDetail>;
      if (!ce.detail) return;
      setDetail(ce.detail);
      setTab(ce.detail.defaultTab === 'invite' ? 'invite' : 'invitations');
      setRows([]);
      setTotal(0);
      setError(null);
      setEmail('');
      setName('');
      setRole(null);
      setRoleOpen(false);
      setSubmitting(false);
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
    if (!open || typeof window === 'undefined') return;
    const onRefresh = () => setTick((t) => t + 1);
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, [open]);

  useEffect(() => {
    if (!open || !detail) return;
    const endpoint = detail.listEndpoint;
    if (!endpoint) {
      setError('Invitations endpoint not configured.');
      setRows([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const url = new URL(endpoint, window.location.origin);
    if (detail.spaceSlug) url.searchParams.set('space_slug', detail.spaceSlug);
    url.searchParams.set('status', 'all');
    url.searchParams.set('per_page', '50');

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
        const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
        const inner =
          rec && 'response' in rec
            ? (rec.response as Record<string, unknown> | undefined)
            : undefined;

        // Our endpoint answers 200 with the real outcome in response.status.
        const innerStatus =
          inner && typeof inner.status === 'number' ? (inner.status as number) : null;
        const ok = innerStatus !== null ? innerStatus === 200 : res.ok;
        if (!ok) {
          const msg =
            (inner && typeof inner.message === 'string' && inner.message) ||
            `Could not load invitations (HTTP ${res.status}).`;
          throw new Error(msg);
        }

        const data = Array.isArray(rec?.data)
          ? (rec!.data as unknown[])
          : Array.isArray(rec?.items)
            ? (rec!.items as unknown[])
            : Array.isArray(inner?.data)
              ? (inner!.data as unknown[])
              : Array.isArray(json)
                ? (json as unknown[])
                : [];

        const meta =
          rec && typeof rec.meta === 'object' && rec.meta
            ? (rec.meta as Record<string, unknown>)
            : null;
        const metaTotal = meta && typeof meta.total === 'number' ? (meta.total as number) : null;

        setRows(data as InvitationRow[]);
        setTotal(metaTotal ?? data.length);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, detail, tick]);

  const submitLabel = useMemo(() => {
    if (!detail) return 'SEND INVITATION';
    if (!role) return detail.submitLabelEmpty ?? 'SEND INVITATION';
    const tpl = detail.submitLabelTemplate ?? 'INVITE AS {role|upper}';
    return fillTemplate(tpl, role);
  }, [detail, role]);

  const dispatchForRow = useCallback(
    (
      slug: string | undefined,
      fallback: string,
      row: InvitationRow,
      extraArgs?: Record<string, unknown>,
    ) => {
      const actionSlug = slug ?? fallback;
      const defaults = readActionDefaultsFromCatalog(actionSlug) ?? {};
      dispatch({
        action_slug: actionSlug,
        args: { ...defaults, ...(extraArgs ?? {}) },
        item: row,
      });
    },
    [dispatch],
  );

  const deleteConfirmArgs = useMemo(() => {
    const out: Record<string, unknown> = {};
    if (detail?.deleteConfirmTitle) out.subject = detail.deleteConfirmTitle;
    if (detail?.deleteConfirmMessage) out.message = detail.deleteConfirmMessage;
    if (detail?.deleteCancelLabel) out.cancel_label = detail.deleteCancelLabel;
    if (detail?.deleteConfirmLabel) out.confirm_label = detail.deleteConfirmLabel;
    return out;
  }, [detail]);

  useBackDismiss(!(!open || !detail), () => handleClose());

  if (!open || !detail) return null;
  if (detail.hidden) return null;

  const closeIcon = resolveIcon(detail.closeIcon ?? 'close');
  const copyIcon = resolveIcon(detail.copyLinkIcon ?? 'copy-outline');
  const trashIcon = resolveIcon(detail.deleteIcon ?? 'trash-outline');
  const caretIcon = roleOpen ? resolveIcon('chevron-up') : resolveIcon('chevron-down');

  const canSubmit = looksLikeEmail(email) && Boolean(role) && !submitting;

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
  };

  const handleSubmit = () => {
    if (!canSubmit || !role) return;
    setSubmitting(true);
    const actionSlug = detail.submitActionSlug ?? 'member.invite';
    const defaults = readActionDefaultsFromCatalog(actionSlug) ?? {};
    dispatch({
      action_slug: actionSlug,
      args: {
        ...defaults,
        ...(detail.submitArgs ?? {}),
        email: email.trim(),
        invitee_name: name.trim(),
        role: role.value,
      },
    });
    // Release busy after a grace period so a failed submit stays re-submittable.
    window.setTimeout(() => setSubmitting(false), 1500);
  };

  const palette = detail.chipPalette ?? {};
  const chipStyle = (tone: string | undefined) => {
    const entry = palette[tone ?? 'muted'] ?? palette.muted ?? {};
    return {
      background: entry.bg || undefined,
      color: entry.text || undefined,
    };
  };

  const tabInvitationsLabel = detail.showInvitationCount === false
    ? (detail.tabInvitationsLabel ?? 'Invitations')
    : `${detail.tabInvitationsLabel ?? 'Invitations'} ${total}`;

  const az = detail.appzetSlug ?? DEFAULT_APPZET_SLUG;

  const submitStyle = {
    background: canSubmit
      ? detail.submitBgColor || undefined
      : detail.submitDisabledBgColor || detail.submitBgColor || undefined,
    color: detail.submitTextColor || undefined,
    borderRadius: detail.submitRadius || undefined,
  };

  const styleVars = {
    '--appza-iu-backdrop': detail.backdropColor,
    '--appza-iu-bg': detail.modalBgColor,
    '--appza-iu-radius': detail.modalRadius,
    '--appza-iu-max-width': detail.modalMaxWidth,
    '--appza-iu-padding': detail.modalPadding,
    '--appza-iu-gap': detail.sectionGap,
    '--appza-iu-tab-bg': detail.tabBgColor,
    '--appza-iu-tab-text': detail.tabTextColor,
    '--appza-iu-tab-active-bg': detail.tabActiveBgColor,
    '--appza-iu-tab-active-text': detail.tabActiveTextColor,
    '--appza-iu-row-title': detail.rowTitleColor,
    '--appza-iu-row-meta': detail.rowMetaColor,
    '--appza-iu-field-bg': detail.fieldBgColor,
    '--appza-iu-field-border': detail.fieldBorderColor,
    '--appza-iu-field-text': detail.fieldTextColor,
    '--appza-iu-field-radius': detail.fieldRadius,
    '--appza-iu-helper-text': detail.helperTextColor,
  } as CSSProperties;

  const childStyle = (idx: number): CSSProperties | undefined =>
    detail.childStyles?.[idx];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.title ?? 'Invite user'}
      className={'appza-invite-user-backdrop' + (embedded ? ' is-embedded' : '')}
      style={styleVars}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="appza-invite-user-modal" {...appzetAttrs(az)}>
        <div className="appza-invite-user-header">
          <div
            className="appza-invite-user-title"
            style={childStyle(0)}
            {...childAttrs(az, 0, 'ion-text')}
          >
            {detail.title ?? 'Invite user'}
          </div>
          {detail.showClose !== false && (
            <button
              type="button"
              className="appza-invite-user-close"
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

        <div className="appza-invite-user-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'invitations'}
            className={
              'appza-invite-user-tab' + (tab === 'invitations' ? ' is-active' : '')
            }
            onClick={() => setTab('invitations')}
            style={childStyle(2)}
            {...childAttrs(az, 2, 'ion-button')}
          >
            {tabInvitationsLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'invite'}
            className={'appza-invite-user-tab' + (tab === 'invite' ? ' is-active' : '')}
            onClick={() => setTab('invite')}
            style={childStyle(3)}
            {...childAttrs(az, 3, 'ion-button')}
          >
            {detail.tabInviteLabel ?? 'Invite User'}
          </button>
        </div>

        {tab === 'invitations' ? (
          <div
            className="appza-invite-user-list"
            style={{
              ...(detail.listMaxHeight ? { maxHeight: detail.listMaxHeight } : {}),
              ...childStyle(4),
            }}
            {...childAttrs(az, 4, 'ion-list')}
          >
            {loading && <div className="appza-invite-user-empty">Loading…</div>}
            {!loading && error && <div className="appza-invite-user-error">{error}</div>}
            {!loading && !error && rows.length === 0 && (
              <div className="appza-invite-user-empty">
                {detail.emptyLabel ?? 'No invitations yet.'}
              </div>
            )}
            {!loading &&
              !error &&
              rows.map((row) => (
                <div className="appza-invite-user-row" key={String(row.id)}>
                  <div className="appza-invite-user-row-main">
                    <div className="appza-invite-user-row-title">{row.title ?? ''}</div>

                    {row.can_copy && (
                      <button
                        type="button"
                        className="appza-invite-user-copy"
                        style={detail.copyLinkColor ? { color: detail.copyLinkColor } : undefined}
                        onClick={() =>
                          dispatchForRow(detail.copyActionSlug, 'invitation.copy_link', row)
                        }
                      >
                        {copyIcon && <IonIcon icon={copyIcon} />}
                        <span>{detail.copyLinkLabel ?? 'Copy Link'}</span>
                      </button>
                    )}

                    {row.meta_line && (
                      <div className="appza-invite-user-row-meta">{row.meta_line}</div>
                    )}
                    {row.invited_by && (
                      <div className="appza-invite-user-row-meta">
                        {`${detail.invitedByPrefix ?? 'Invite by'} ${row.invited_by}`}
                      </div>
                    )}
                  </div>

                  <div className="appza-invite-user-row-side">
                    {row.chip_label && (
                      <span
                        className={
                          'appza-invite-user-chip is-' + (row.chip_tone ?? 'muted')
                        }
                        style={chipStyle(row.chip_tone)}
                      >
                        {row.chip_label}
                      </span>
                    )}
                    <div className="appza-invite-user-row-controls">
                      {row.can_resend && (
                        <button
                          type="button"
                          className="appza-invite-user-resend"
                          onClick={() =>
                            dispatchForRow(detail.resendActionSlug, 'invitation.resend', row)
                          }
                        >
                          {detail.resendLabel ?? 'Resend'}
                        </button>
                      )}
                      {row.can_delete !== false && (
                        <button
                          type="button"
                          className="appza-invite-user-delete"
                          aria-label="Delete invitation"
                          style={detail.deleteColor ? { color: detail.deleteColor } : undefined}
                          onClick={() =>
                            dispatchForRow(
                              detail.deleteActionSlug,
                              'invitation.delete_confirm',
                              row,
                              deleteConfirmArgs,
                            )
                          }
                        >
                          {trashIcon && <IonIcon icon={trashIcon} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <>
            <div className="appza-invite-user-form">
              <label
                className="appza-invite-user-label"
                htmlFor="appza-invite-email"
                style={childStyle(5)}
                {...childAttrs(az, 5, 'ion-text')}
              >
                {detail.emailLabel ?? 'Email'}
              </label>
              <input
                id="appza-invite-email"
                type="email"
                className="appza-invite-user-input"
                placeholder={detail.emailPlaceholder ?? 'name@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                style={childStyle(6)}
                {...childAttrs(az, 6, 'ion-input')}
              />

              <label
                className="appza-invite-user-label"
                htmlFor="appza-invite-name"
                style={childStyle(7)}
                {...childAttrs(az, 7, 'ion-text')}
              >
                {detail.nameLabel ?? 'Invitee name (optional)'}
              </label>
              <input
                id="appza-invite-name"
                type="text"
                className="appza-invite-user-input"
                placeholder={detail.namePlaceholder ?? 'Full name'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                style={childStyle(8)}
                {...childAttrs(az, 8, 'ion-input')}
              />

              <div
                className="appza-invite-user-label"
                style={childStyle(9)}
                {...childAttrs(az, 9, 'ion-text')}
              >
                {detail.roleLabel ?? 'Membership Role'}
              </div>
              {/* In-flow: the modal clips overflow, so an absolute menu would render off screen. */}
              <div
                className="appza-invite-user-role"
                style={childStyle(10)}
                {...childAttrs(az, 10, 'ion-select')}
              >
                <button
                  type="button"
                  className={
                    'appza-invite-user-role-trigger' + (roleOpen ? ' is-open' : '')
                  }
                  onClick={() => setRoleOpen((v) => !v)}
                  disabled={submitting}
                >
                  <span
                    className={
                      'appza-invite-user-role-value' + (role ? '' : ' is-placeholder')
                    }
                  >
                    {role?.label ?? detail.rolePlaceholder ?? 'Member role'}
                  </span>
                  {caretIcon && (
                    <IonIcon icon={caretIcon} className="appza-invite-user-role-caret" />
                  )}
                </button>
                {roleOpen && (
                  <div className="appza-invite-user-role-menu" role="listbox">
                    {detail.roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        role="option"
                        aria-selected={r.value === role?.value}
                        className={
                          'appza-invite-user-role-option' +
                          (r.value === role?.value ? ' is-current' : '')
                        }
                        onClick={() => {
                          setRole(r);
                          setRoleOpen(false);
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {detail.helperText && (
                <p
                  className="appza-invite-user-helper"
                  style={childStyle(11)}
                  {...childAttrs(az, 11, 'ion-text')}
                >
                  {detail.helperText}
                </p>
              )}
            </div>

            {/* Tag on the footer: a disabled submit gets no clicks, so it would be unselectable. */}
            <div
              className="appza-invite-user-footer"
              style={childStyle(12)}
              {...childAttrs(az, 12, 'ion-button')}
            >
              <button
                type="button"
                className={
                  'appza-invite-user-submit' + (canSubmit ? '' : ' is-disabled')
                }
                style={submitStyle}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? 'Sending…' : submitLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
