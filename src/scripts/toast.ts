let timer = 0;

export function toast(message: string) {
  const el = document.querySelector<HTMLElement>('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove('is-on'), 2200);
}
