// Opens a URL outside the app. The shell may supply a native opener (Custom Tabs on the phone,
// where window.open('_blank') is a silent no-op); the default suits browsers and the simulator.
let opener: (url: string) => void = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

export function setExternalOpener(fn: (url: string) => void): void {
  opener = fn;
}

export function openExternal(url: string): void {
  if (url) opener(url);
}
