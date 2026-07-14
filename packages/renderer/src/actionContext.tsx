import { createContext, useContext, type ReactNode } from 'react';

/**
 * Wiring for AppZet on_tap_* actions. The shell (mobile app or plug-in
 * admin) provides an implementation; the renderer stays presentation-only.
 *
 * `dispatch` receives the resolved action wiring from the AppZet
 * (action_slug + args merged from AppZet.actions[event] + any per-item
 * data bindings) plus a reference to the current data item so the shell
 * can resolve `data.<path>` params against it.
 */
export type ActionInvocation = {
  action_slug: string;
  args?: Record<string, unknown>;
  item?: unknown;
};

export type ActionDispatch = (inv: ActionInvocation) => void;

const noopDispatch: ActionDispatch = (inv) => {
  if (typeof console !== 'undefined') {
    console.warn(
      '[appza-renderer] no ActionContext.Provider mounted; dropping',
      inv.action_slug,
    );
  }
};

const ActionContext = createContext<ActionDispatch>(noopDispatch);

export function ActionProvider({
  dispatch,
  children,
}: {
  dispatch: ActionDispatch;
  children: ReactNode;
}) {
  return <ActionContext.Provider value={dispatch}>{children}</ActionContext.Provider>;
}

export function useActionDispatch(): ActionDispatch {
  return useContext(ActionContext);
}
