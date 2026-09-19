// Install the polish observers in every page of the session.
//   agent-browser --session <task> --init-script "<skill-dir>/scripts/observe.js" open <url>
// Then, after each action, read the moment:
//   agent-browser --session <task> eval "JSON.stringify(__polish.moment('<result selector>'))"
// moment(selector) returns, for the last pointer or key action:
//   sinceActionMs, firstChangeMs   time from the action to now, and to the first DOM change (null: none yet)
//   action                          what was pressed, as tag#id.class "text"
//   focus, focusIsBody             where focus sits now
//   target                         the result element: rect, inView, centreOffsetPct of the viewport height,
//                                  transition and keyframe animation durations; null when the selector matches nothing
//   shifts                         elements that moved that are not the target or inside it (Chromium only;
//                                  transform-driven motion does not register)
//   scroll                         y, max, and atEnd: the page cannot scroll further, so the result cannot centre
(() => {
  if (window.__polish) return;
  const state = { action: null, firstChange: null, shifts: [] };

  const describe = (el) => {
    if (!el || el === document) return "document";
    const tag = el.tagName ? el.tagName.toLowerCase() : String(el.nodeName);
    const id = el.id ? "#" + el.id : "";
    const cls = el.classList && el.classList.length ? "." + [...el.classList].slice(0, 3).join(".") : "";
    const label = el.getAttribute && (el.getAttribute("aria-label") || el.textContent || "");
    const text = label.trim().replace(/\s+/g, " ").slice(0, 40);
    return tag + id + cls + (text ? ` "${text}"` : "");
  };
  const rect = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });

  const mark = (e) => {
    state.action = { t: performance.now(), type: e.type, key: e.key, target: describe(e.target) };
    state.firstChange = null;
    state.shifts = [];
  };
  addEventListener("pointerdown", mark, true);
  addEventListener("keydown", mark, true);

  // The script runs before the document has an element, so observe the document node itself.
  new MutationObserver(() => {
    if (state.action && state.firstChange === null) state.firstChange = performance.now() - state.action.t;
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });

  if ("PerformanceObserver" in window) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        for (const s of entry.sources || []) {
          if (!s.node) continue;
          state.shifts.push({ node: s.node, from: rect(s.previousRect), to: rect(s.currentRect) });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  }

  window.__polish = {
    moment(selector) {
      const now = performance.now();
      const vh = innerHeight, vw = innerWidth;
      const target = selector ? document.querySelector(selector) : null;
      let targetInfo = null;
      if (target) {
        const r = target.getBoundingClientRect();
        const cs = getComputedStyle(target);
        const centre = r.y + r.height / 2;
        targetInfo = {
          rect: rect(r),
          inView: r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw,
          fullyInView: r.top >= 0 && r.bottom <= vh,
          centreOffsetPct: Math.round(((centre - vh / 2) / vh) * 100),
          transition: { property: cs.transitionProperty, duration: cs.transitionDuration },
          animation: { name: cs.animationName, duration: cs.animationDuration },
          fontVariantNumeric: cs.fontVariantNumeric,
        };
      }
      const shifts = state.shifts
        .filter((s) => !(target && (s.node === target || target.contains(s.node))))
        .map((s) => ({ node: describe(s.node), from: s.from, to: s.to, dx: s.to.x - s.from.x, dy: s.to.y - s.from.y, dh: s.to.h - s.from.h }));
      return {
        sinceActionMs: state.action ? Math.round(now - state.action.t) : null,
        firstChangeMs: state.firstChange === null ? null : Math.round(state.firstChange),
        action: state.action ? { type: state.action.type, key: state.action.key, target: state.action.target } : null,
        focus: describe(document.activeElement),
        focusIsBody: document.activeElement === document.body,
        viewport: { w: vw, h: vh },
        target: targetInfo,
        shifts,
        scroll: { y: Math.round(scrollY), max: Math.round(document.documentElement.scrollHeight - vh),
                  atEnd: Math.round(scrollY) >= Math.round(document.documentElement.scrollHeight - vh) },
      };
    },
  };
})();
