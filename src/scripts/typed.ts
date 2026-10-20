// Command headings type themselves out when they scroll into view.
// The cursor fades once typing ends, so nothing moves while people read.
import { motionOff } from './motion';

const headings = [...document.querySelectorAll<HTMLElement>('[data-type]')];
if (!motionOff()) headings.forEach((el) => { el.textContent = ''; });

function type(el: HTMLElement) {
  const text = el.dataset.type ?? '';
  if (motionOff()) {
    el.textContent = text;
    el.classList.add('done');
    return;
  }
  let i = 0;
  const step = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(step, 45 + Math.random() * 55);
    else setTimeout(() => el.classList.add('done'), 1600);
  };
  setTimeout(step, 300);
}

const io = new IntersectionObserver(
  (entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    io.unobserve(entry.target);
    type(entry.target as HTMLElement);
  }),
  { rootMargin: '0px 0px -15% 0px' },
);
headings.forEach((el) => io.observe(el));
