// Fade elements with .reveal in as they enter the viewport, staggered per section.
document.querySelectorAll<HTMLElement>('section').forEach((section) =>
  section.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 6) * 90}ms`;
    // Clear the delay afterwards so hover effects on the same element respond at once.
    el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
  }),
);

const io = new IntersectionObserver(
  (entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    io.unobserve(entry.target);
  }),
  { rootMargin: '0px 0px -10% 0px' },
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
