// The address ships reversed and base64-encoded so simple scrapers miss it.
// See src/lib/email.ts for the build-time side.
export const decodeEmail = (encoded: string) => atob(encoded).split('').reverse().join('');

/** Opens the visitor's email app. The address is decoded only at the moment of the click,
    so it never appears on the page. */
export function openEmail(encoded: string) {
  location.href = `mailto:${decodeEmail(encoded)}?subject=${encodeURIComponent('Hello João')}`;
}
