/**
 * EnsinoLibre aula — worksheet progress tracker.
 *
 * Non-invasive: after renderWorksheet() runs, we find every Check button in
 * the host and treat each as one gradeable "unit". Its result is read from the
 * data-state the renderer already sets on the unit's card
 * (correct / wrong / revealed). We never modify the renderer.
 */

/** Units = one per Check button; state lives on the nearest .oc-qblock or .oc-activity. */
function collectUnits(host) {
  return [...host.querySelectorAll('.oc-btn--check')].map((btn) => ({
    btn,
    card: btn.closest('.oc-qblock') || btn.closest('.oc-activity'),
  }));
}

export function snapshot(host) {
  const units = collectUnits(host);
  const total = units.length;
  let attempted = 0;
  let correct = 0;
  for (const u of units) {
    const st = u.card && u.card.dataset ? u.card.dataset.state : '';
    if (st) attempted += 1;
    if (st === 'correct') correct += 1;
  }
  const done = total === 0 ? true : attempted >= total;
  const score = total === 0 ? 1 : correct / total;
  return { total, attempted, correct, done, score };
}

/**
 * Watch a rendered worksheet and call onUpdate(snapshot) after each check.
 * Returns a stop() function.
 */
export function trackWorksheet(host, onUpdate) {
  const units = collectUnits(host);
  const report = () => onUpdate(snapshot(host));
  // Run after the renderer's own click handler has set data-state.
  const handlers = units.map((u) => {
    const h = () => setTimeout(report, 0);
    u.btn.addEventListener('click', h);
    return { btn: u.btn, h };
  });
  report(); // initial (0 attempted)
  return () => handlers.forEach(({ btn, h }) => btn.removeEventListener('click', h));
}
