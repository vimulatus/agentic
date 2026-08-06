// House determinism init-script for agent-browser verification.
//
// Passed via `agent-browser open --init-script <this>` so it runs BEFORE the page's own JS, in
// every document/frame. Purpose: make `diff screenshot` meaningful by removing non-deterministic
// visual noise, and record page errors from the first byte. Use ONLY for baseline/diff shots — run
// a separate normal pass to verify that animations/transitions actually fire.
//
// Page context only (no Node). Must be defensive: it runs everywhere, possibly more than once.
(() => {
  'use strict';
  if (window.__AGENT_DETERMINISTIC__) return;
  window.__AGENT_DETERMINISTIC__ = true;

  const FROZEN_EPOCH = 1735689600000; // 2025-01-01T00:00:00Z — a fixed, arbitrary instant.

  // 1. Freeze time. Date.now() and argless `new Date()` return the frozen instant; explicit args
  //    still construct the requested date so app logic that builds specific dates keeps working.
  try {
    const RealDate = Date;
    const FrozenDate = function (...args) {
      if (!(this instanceof FrozenDate)) return new RealDate(FROZEN_EPOCH).toString();
      return args.length === 0 ? new RealDate(FROZEN_EPOCH) : new RealDate(...args);
    };
    FrozenDate.prototype = RealDate.prototype;
    FrozenDate.now = () => FROZEN_EPOCH;
    FrozenDate.parse = RealDate.parse;
    FrozenDate.UTC = RealDate.UTC;
    // eslint-disable-next-line no-global-assign
    Date = FrozenDate;
    if (window.performance && typeof performance.now === 'function') {
      performance.now = () => 0;
    }
  } catch (_) { /* leave Date alone if the environment forbids reassignment */ }

  // 2. Deterministic Math.random (seeded mulberry32) so seeded layouts/ids don't churn the diff.
  try {
    let seed = 0x9e3779b9;
    Math.random = () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  } catch (_) { /* ignore */ }

  // 3. Force reduced-motion at the matchMedia layer (CSS kill below covers rendering).
  try {
    const realMatchMedia = window.matchMedia && window.matchMedia.bind(window);
    if (realMatchMedia) {
      window.matchMedia = (q) => {
        const r = realMatchMedia(q);
        if (typeof q === 'string' && /prefers-reduced-motion/.test(q)) {
          return Object.assign(Object.create(r), { matches: true });
        }
        return r;
      };
    }
  } catch (_) { /* ignore */ }

  // 4. Kill animations/transitions/caret blink and pin scroll behaviour, as early as possible.
  try {
    const css =
      '*,*::before,*::after{' +
      'animation-duration:0s !important;animation-delay:0s !important;' +
      'transition-duration:0s !important;transition-delay:0s !important;' +
      'scroll-behavior:auto !important;caret-color:transparent !important}';
    const inject = () => {
      if (!document.documentElement) return;
      const style = document.createElement('style');
      style.setAttribute('data-agent-deterministic', '');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.documentElement) inject();
    else document.addEventListener('DOMContentLoaded', inject, { once: true });
  } catch (_) { /* ignore */ }

  // 5. Record page errors from byte 0 so a boot-time crash is never missed.
  try {
    window.__AGENT_ERRORS__ = window.__AGENT_ERRORS__ || [];
    window.addEventListener('error', (e) => {
      window.__AGENT_ERRORS__.push({ type: 'error', message: String(e.message || e.error || e) });
    });
    window.addEventListener('unhandledrejection', (e) => {
      window.__AGENT_ERRORS__.push({ type: 'unhandledrejection', message: String(e.reason) });
    });
  } catch (_) { /* ignore */ }
})();
