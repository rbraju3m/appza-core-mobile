// Supplied by the shell, not a window global, so page scripts can't read the credential.
let provider: () => string | undefined = () => undefined;
// Extra proxy headers from the shell. The builder's "Viewing as: Member" sends its wp-admin nonce + X-Appza-View-As.
let extraProvider: () => Record<string, string> = () => ({});

export function setAuthHeaderProvider(fn: () => string | undefined): void {
  provider = fn;
}

export function getAuthHeader(): string | undefined {
  return provider() || undefined;
}

export function setProxyHeadersProvider(fn: () => Record<string, string>): void {
  extraProvider = fn;
}

/** Headers for a preview-proxy read: Accept, the shell's extras, then the sign-in (which wins). */
export function proxyRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extraProvider() };
  const auth = getAuthHeader();
  if (auth) headers.Authorization = auth;
  return headers;
}
