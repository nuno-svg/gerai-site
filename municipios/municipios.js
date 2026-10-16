// Progressive enhancement: the first illustration and all core content work without JS.
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = false) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
  });
});
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const toggle = document.getElementById('motion-toggle');
let userPaused = false;
function syncMotion() {
  const paused = userPaused || reducedMotion.matches;
  document.documentElement.classList.toggle('motion-paused', paused);
  toggle.hidden = reducedMotion.matches;
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = paused ? 'Ativar animações' : 'Pausar animações';
  if (paused) document.querySelectorAll('.is-pending').forEach(el => el.classList.remove('is-pending'));
}
toggle.addEventListener('click', () => { userPaused = !userPaused; syncMotion(); });
reducedMotion.addEventListener('change', syncMotion);
syncMotion();
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.remove('is-pending'); observer.unobserve(entry.target); }
  }), { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => { el.classList.add('is-pending'); observer.observe(el); });
}
