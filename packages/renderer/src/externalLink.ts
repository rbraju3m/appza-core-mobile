// Native opener override: on the phone window.open(_blank) is a silent no-op.
let opener: (url: string) => void = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

export function setExternalOpener(fn: (url: string) => void): void {
  opener = fn;
}

export function openExternal(url: string): void {
  if (url) opener(url);
}
