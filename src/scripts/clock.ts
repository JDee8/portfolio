// Lisbon local time in the nav, phone menu and footer, so visitors in other
// time zones know when a reply is likely. Updates on the minute.
const els = [...document.querySelectorAll<HTMLElement>('[data-clock]')];
if (els.length) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' });
  const tick = () => {
    const time = fmt.format(new Date());
    els.forEach((el) => { el.textContent = `${el.dataset.clock || 'Lisbon'} ${time}`; });
    setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
  };
  tick();
}
