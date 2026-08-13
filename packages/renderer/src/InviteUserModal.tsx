import { useCallback, useEffect, useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { useActionDispatch } from './actionContext';
import { resolveIcon } from './PrimitiveRenderer';
import { readActionDefaultsFromCatalog } from './PostOptionsPopover';
import { useInsideDeviceViewport } from './insideDeviceViewport';
import { appzetAttrs, childAttrs } from './designTimeAttrs';

// Slug of the catalog AppZet this modal stands in for. Used only to
// address the builder's Properties panel; the runtime never reads it.
const DEFAULT_APPZET_SLUG = 'fc-invite-user-modal';

// Centered modal opened by member.invite. Two tabs in one shell:
//
//   1. Invitations → the space's existing invitations. Each row can
//      copy its link, resend itself, or be deleted (behind a confirm).
//   2. Invite User → email + optional name + membership role, with a
//      submit whose caption flips to "INVITE AS {ROLE}" once a role
//      is picked.
//
// Presentation only, per P65: every row control and the submit go out
// through the shared ActionDispatch context, and App.tsx owns the HTTP,
// the clipboard write, the toast and the confirm dialog. The rows
// themselves arrive pre-composed from fc-space-invitations — `title`
// and `meta_line` are built server-side because their shape is
// conditional and has to stay identical to the web portal.

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
  // Tabs
  tabInvitationsLabel?: string;
  tabInviteLabel?: string;
  showInvitationCount?: boolean;
  defaultTab?: InviteTab;
  // Invitation rows
  copyLinkLabel?: string;
  copyLinkIcon?: string;
  resendLabel?: string;
  deleteIcon?: string;
  invitedByPrefix?: string;
  emptyLabel?: string;
  // Delete confirm copy. Authored on the AppZet, so it rides the
  // dispatch rather than letting the action's param_schema defaults
  // shadow whatever the site admin typed.
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
  deleteCancelLabel?: string;
  deleteConfirmLabel?: string;
  // Form
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
  // Style knobs read off the AppZet's default_props_override
  chipPalette?: InviteChipPalette;
  copyLinkColor?: string;
  deleteColor?: string;
  submitBgColor?: string;
  submitTextColor?: string;
  submitDisabledBgColor?: string;
  listMaxHeight?: string;
  // Wiring
  listEndpoint?: string;
  spaceSlug?: string;
  authHeader?: string;
  /**
   * WP REST nonce (window.appzaCoreConfig?.restNonce). Sent as
   * `X-WP-Nonce` so the plugin-admin can authenticate off the WP
   * session cookie instead of the mobile shell's Basic Auth. Same
   * dual-wire arrangement as the add-member picker.
   */
  restNonce?: string;
  submitActionSlug?: string;
  submitArgs?: Record<string, unknown>;
  copyActionSlug?: string;
  resendActionSlug?: string;
  deleteActionSlug?: string;
  /**
   * Catalog slug of the AppZet whose props drove this open. Carried so
   * the builder can select the right row when the modal is clicked in
   * the simulator — the shell resolves it from the opener action's
   * `form_appzet_slug`, which may point at a customer's own variant.
   */
  appzetSlug?: string;
};

/** Slug-addressed so a patch reaches only the modal it was authored for. */
type PatchDetail = { appzetSlug: string; patch: Partial<OpenDetail> };

export function openInviteUserModal(detail: OpenDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

export function closeInviteUserModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

/**
 * Re-authors an already-open modal in place. The builder calls this when
 * a prop changes while the modal is on screen — re-opening instead would
 * reset the active tab and any half-typed invite, so editing a label
 * would yank the form out from under the user.
 *
 * No-op when the modal is closed; the next open reads fresh props anyway.
 */
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

/**
 * Loose enough to keep the button live for anything plausibly an
 * address — the endpoint is the real authority and returns a readable
 * message when it disagrees.
 */
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
  // Form
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<InviteRoleOption | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dispatch = useActionDispatch();
  // In the plug-in admin the card caps its height against the simulated
  // phone screen; on mobile it sizes to the real one.
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
      // Show the spinner on the very first paint rather than the
      // empty state — the fetch effect runs on this same tick but its
      // own setLoading only lands on the next render.
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

  // Every mutation the shell performs ends with appza:refresh-data, so
  // the list repopulates itself after an invite, a resend or a delete
  // without the modal needing to know which one happened.
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

        // Our endpoint answers HTTP 200 and carries the real outcome
        // in response.status, so a permission failure would otherwise
        // render as an empty list rather than an error.
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

  /**
   * Author-set confirm copy, dropping any key the author left blank so
   * the action's own defaults still fill the gap.
   */
  const deleteConfirmArgs = useMemo(() => {
    const out: Record<string, unknown> = {};
    if (detail?.deleteConfirmTitle) out.subject = detail.deleteConfirmTitle;
    if (detail?.deleteConfirmMessage) out.message = detail.deleteConfirmMessage;
    if (detail?.deleteCancelLabel) out.cancel_label = detail.deleteCancelLabel;
    if (detail?.deleteConfirmLabel) out.confirm_label = detail.deleteConfirmLabel;
    return out;
  }, [detail]);

  if (!open || !detail) return null;

  const closeIcon = resolveIcon('close');
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
    // App.tsx closes the modal on success and surfaces the message on
    // failure. Release the busy state either way after a grace period
    // so a failed submit leaves the form intact and re-submittable
    // rather than stranding a dead spinner.
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
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.title ?? 'Invite user'}
      className={'appza-invite-user-backdrop' + (embedded ? ' is-embedded' : '')}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="appza-invite-user-modal" {...appzetAttrs(az)}>
        <div className="appza-invite-user-header">
          <div className="appza-invite-user-title" {...childAttrs(az, 0, 'ion-text')}>
            {detail.title ?? 'Invite user'}
          </div>
          <button
            type="button"
            className="appza-invite-user-close"
            aria-label="Close"
            onClick={handleClose}
            disabled={submitting}
            {...childAttrs(az, 1, 'ion-button')}
          >
            {closeIcon && <IonIcon icon={closeIcon} />}
          </button>
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
            {...childAttrs(az, 3, 'ion-button')}
          >
            {detail.tabInviteLabel ?? 'Invite User'}
          </button>
        </div>

        {tab === 'invitations' ? (
          <div
            className="appza-invite-user-list"
            style={detail.listMaxHeight ? { maxHeight: detail.listMaxHeight } : undefined}
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
                {...childAttrs(az, 6, 'ion-input')}
              />

              <label
                className="appza-invite-user-label"
                htmlFor="appza-invite-name"
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
                {...childAttrs(az, 8, 'ion-input')}
              />

              <div className="appza-invite-user-label" {...childAttrs(az, 9, 'ion-text')}>
                {detail.roleLabel ?? 'Membership Role'}
              </div>
              {/* In-flow menu, not absolutely positioned: the modal
                  clips overflow, so an absolute menu would render off
                  screen and the trigger would read as a dead button. */}
              <div className="appza-invite-user-role" {...childAttrs(az, 10, 'ion-select')}>
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
                <p className="appza-invite-user-helper" {...childAttrs(az, 11, 'ion-text')}>
                  {detail.helperText}
                </p>
              )}
            </div>

            <div className="appza-invite-user-footer">
              <button
                type="button"
                className={
                  'appza-invite-user-submit' + (canSubmit ? '' : ' is-disabled')
                }
                style={submitStyle}
                onClick={handleSubmit}
                disabled={!canSubmit}
                {...childAttrs(az, 12, 'ion-button')}
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
