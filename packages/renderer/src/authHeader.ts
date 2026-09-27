// The signed-in user's Authorization header, supplied by the shell. Not a window global,
// so page scripts can't read the credential off `window`.
let provider: () => string | undefined = () => undefined;

export function setAuthHeaderProvider(fn: () => string | undefined): void {
  provider = fn;
}

export function getAuthHeader(): string | undefined {
  return provider() || undefined;
}
