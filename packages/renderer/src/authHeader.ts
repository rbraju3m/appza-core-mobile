// Supplied by the shell, not a window global, so page scripts can't read the credential.
let provider: () => string | undefined = () => undefined;

export function setAuthHeaderProvider(fn: () => string | undefined): void {
  provider = fn;
}

export function getAuthHeader(): string | undefined {
  return provider() || undefined;
}
