import { createContext, useContext, type ReactNode } from 'react';

export type ActionInvocation = {
  action_slug: string;
  args?: Record<string, unknown>;
  binding_root?: string;
  item?: unknown;
  siblings?: unknown[];
  siblingIndex?: number;
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
