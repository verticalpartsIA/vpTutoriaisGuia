export const recorderInitScript = String.raw`
(() => {
  if (window.__vpGuideRecorderInstalled) return;
  window.__vpGuideRecorderInstalled = true;

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  };

  const targetFor = (element) => {
    if (!(element instanceof Element)) return {};
    const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id') || undefined;
    const id = element.id || undefined;
    const role = element.getAttribute('role') || undefined;
    const text = (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120) || undefined;

    let selector;
    if (testId) selector = '[data-testid="' + cssEscape(testId) + '"]';
    else if (id) selector = '#' + cssEscape(id);
    else {
      const name = element.getAttribute('name');
      if (name) selector = element.tagName.toLowerCase() + '[name="' + cssEscape(name) + '"]';
      else {
        const parts = [];
        let current = element;
        for (let depth = 0; current && current.nodeType === 1 && depth < 4; depth += 1) {
          let part = current.tagName.toLowerCase();
          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
            if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
          }
          parts.unshift(part);
          current = parent;
        }
        selector = parts.join(' > ');
      }
    }

    return { selector, text, role, testId };
  };

  const send = (payload) => {
    if (typeof window.__vpGuideCapture === 'function') {
      window.__vpGuideCapture({
        ...payload,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      });
    }
  };

  document.addEventListener('click', (event) => {
    const element = event.target instanceof Element ? event.target.closest('button,a,input,[role="button"],[data-testid]') || event.target : null;
    if (!element) return;
    send({ action: element.tagName === 'BUTTON' && element.getAttribute('type') === 'submit' ? 'submit' : 'click', target: targetFor(element) });
  }, true);

  document.addEventListener('change', (event) => {
    const element = event.target;
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
    const action = element instanceof HTMLSelectElement ? 'select' : 'input';
    const sensitive = element instanceof HTMLInputElement && ['password', 'hidden'].includes(element.type);
    send({ action, target: targetFor(element), value: sensitive ? '[REDACTED]' : String(element.value).slice(0, 500) });
  }, true);

  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    const result = originalPushState(...args);
    queueMicrotask(() => send({ action: 'navigate', target: {} }));
    return result;
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args) => {
    const result = originalReplaceState(...args);
    queueMicrotask(() => send({ action: 'navigate', target: {} }));
    return result;
  };

  window.addEventListener('popstate', () => send({ action: 'navigate', target: {} }));
})();
`;
