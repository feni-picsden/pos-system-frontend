// Page Rules sandbox (Settings > Page Rules — reference art. 360021629152).
// A rule is store-authored JavaScript exposing `entry(context)` that returns the
// next wizard Question (or a Promise of one). The code runs inside a sandboxed
// iframe (allow-scripts only, srcdoc => opaque origin) so it has no access to
// the POS window, storage or session — all host interaction goes over a
// postMessage RPC exposing the reference's ShopfrontAPI surface.
//
//   const session = await createPageRuleSession(code, { onHostAction });
//   const question = await session.ask(context);
//   const { data, next } = await session.fireEvent(askId, path, event);
//   session.destroy();

const CALL_TIMEOUT_MS = 5000;

// The bootstrap that runs inside the iframe. Kept as a plain string so the
// rule code can be delivered by postMessage (no srcdoc escaping games).
const BOOTSTRAP = `
<script>
(function () {
  var vars = {};
  var entryFn = null;
  var eventHandlers = {}; // askId -> { path -> onEvent }

  function hostCall(action, payload) {
    parent.postMessage({ __pageRule: true, type: 'host-action', action: action, payload: payload || {} }, '*');
  }

  // The reference ShopfrontAPI surface. queryGraphQL exists on the reference but
  // this POS has no GraphQL endpoint — it rejects with a clear message instead
  // of failing silently.
  var ShopfrontAPI = {
    storeVariable: function (name, data) { vars[name] = data; },
    hasVariable: function (name) { return Object.prototype.hasOwnProperty.call(vars, name); },
    getVariable: function (name) {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) throw new TypeError('Variable not found: ' + name);
      return vars[name];
    },
    queryGraphQL: function () {
      return Promise.reject(new Error('queryGraphQL is not available in this POS — use select elements with internal databases instead'));
    },
    redirect: function (address) { hostCall('redirect', { address: address }); },
    setField: function (field, value) { hostCall('setField', { field: field, value: value }); },
    back: function () { hostCall('back'); },
    next: function () { hostCall('next'); },
    finish: function () { hostCall('finish'); },
    toast: function (toastType, toastMessage) { hostCall('toast', { toastType: toastType, toastMessage: toastMessage }); },
  };
  window.ShopfrontAPI = ShopfrontAPI;

  // Strip functions out of a Question so it can cross postMessage. Custom
  // elements' onEvent handlers are kept here, addressed by element path.
  function serializeQuestion(question, askId) {
    eventHandlers[askId] = {};
    function walkCustom(node, path) {
      if (!node || typeof node !== 'object') return node;
      var out = {
        type: node.type,
        textNode: node.textNode,
        attributes: node.attributes || {},
        events: Array.isArray(node.events) ? node.events : [],
      };
      if (typeof node.onEvent === 'function') {
        eventHandlers[askId][path] = node.onEvent;
        out.hasOnEvent = true;
      }
      if (Array.isArray(node.children)) {
        out.children = node.children.map(function (child, i) { return walkCustom(child, path + '.' + i); });
      }
      return out;
    }
    var elements = (question.elements || []).map(function (el, i) {
      var copy = {};
      for (var k in el) { if (k !== 'customElement') copy[k] = el[k]; }
      if (el.customElement) copy.customElement = walkCustom(el.customElement, String(i));
      return copy;
    });
    return {
      question: question.question,
      title: question.title,
      questionsLeft: question.questionsLeft,
      metaData: question.metaData,
      elements: elements,
    };
  }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || !msg.__pageRule) return;

    if (msg.type === 'init') {
      try {
        // Wrapping with new Function keeps helper functions in the rule's own
        // closure while handing back its entry().
        var factory = new Function('ShopfrontAPI', msg.code + '\\n;return (typeof entry === "function") ? entry : null;');
        entryFn = factory(ShopfrontAPI);
        if (!entryFn) throw new Error('The Page Rule must define a function named "entry"');
        parent.postMessage({ __pageRule: true, type: 'init-result', ok: true }, '*');
      } catch (err) {
        parent.postMessage({ __pageRule: true, type: 'init-result', ok: false, error: String(err && err.message || err) }, '*');
      }
      return;
    }

    if (msg.type === 'ask') {
      Promise.resolve()
        .then(function () { return entryFn(msg.context); })
        .then(function (question) {
          if (!question || typeof question !== 'object') throw new Error('entry() must return a Question object');
          parent.postMessage({ __pageRule: true, type: 'ask-result', id: msg.id, ok: true, question: serializeQuestion(question, msg.id) }, '*');
        })
        .catch(function (err) {
          parent.postMessage({ __pageRule: true, type: 'ask-result', id: msg.id, ok: false, error: String(err && err.message || err) }, '*');
        });
      return;
    }

    if (msg.type === 'fire-event') {
      var handlers = eventHandlers[msg.askId] || {};
      var handler = handlers[msg.path];
      Promise.resolve()
        .then(function () {
          if (!handler) return null;
          // Synthetic event: the reference hands the DOM event; across the
          // sandbox boundary we reconstruct type/target value.
          var synthetic = {
            type: msg.event.type,
            target: { value: msg.event.value },
            currentTarget: { value: msg.event.value },
          };
          return handler(synthetic);
        })
        .then(function (result) {
          parent.postMessage({ __pageRule: true, type: 'event-result', id: msg.id, ok: true, result: result || null }, '*');
        })
        .catch(function (err) {
          parent.postMessage({ __pageRule: true, type: 'event-result', id: msg.id, ok: false, error: String(err && err.message || err) }, '*');
        });
    }
  });

  parent.postMessage({ __pageRule: true, type: 'ready' }, '*');
})();
<\/script>`;

export const createPageRuleSession = (code, { onHostAction } = {}) =>
  new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('sandbox', 'allow-scripts'); // opaque origin — no POS access
    iframe.srcdoc = BOOTSTRAP;

    let seq = 0;
    const pending = new Map(); // id -> {resolve, reject, timer}
    let destroyed = false;

    const send = (msg) => iframe.contentWindow?.postMessage({ __pageRule: true, ...msg }, '*');

    const call = (msg) => {
      const id = ++seq;
      const promise = new Promise((res, rej) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          rej(new Error('The Page Rule took too long to respond'));
        }, CALL_TIMEOUT_MS);
        pending.set(id, { resolve: res, reject: rej, timer });
        send({ ...msg, id });
      });
      return { id, promise };
    };

    const onMessage = (e) => {
      if (e.source !== iframe.contentWindow) return;
      const msg = e.data;
      if (!msg || !msg.__pageRule) return;

      if (msg.type === 'ready') {
        send({ type: 'init', code });
        return;
      }
      if (msg.type === 'init-result') {
        if (msg.ok) {
          resolve(session);
        } else {
          destroy();
          reject(new Error(msg.error || 'The Page Rule failed to load'));
        }
        return;
      }
      if (msg.type === 'ask-result' || msg.type === 'event-result') {
        const entry = pending.get(msg.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.delete(msg.id);
        if (msg.ok) entry.resolve(msg.type === 'ask-result' ? msg.question : msg.result);
        else entry.reject(new Error(msg.error || 'The Page Rule raised an error'));
        return;
      }
      if (msg.type === 'host-action') {
        // hostActionHandler is late-bound by the wizard component; the creation
        // option stays as a fallback for non-UI callers (validation probes).
        (session.hostActionHandler || onHostAction)?.(msg.action, msg.payload || {});
      }
    };

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener('message', onMessage);
      pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('Page Rule session closed')); });
      pending.clear();
      iframe.remove();
    };

    const session = {
      // context -> serialized Question (custom-element handlers addressable by askId+path)
      ask: (context) => {
        const { id, promise } = call({ type: 'ask', context });
        return promise.then((question) => ({ ...question, askId: id }));
      },
      // askId + element path + {type, value} -> onEvent result ({data, next} | null)
      fireEvent: (askId, path, event) => call({ type: 'fire-event', askId, path, event }).promise,
      destroy,
    };

    window.addEventListener('message', onMessage);
    // A rule that never boots (e.g. busy loop at top level) must not hang the wizard.
    const bootTimer = setTimeout(() => { destroy(); reject(new Error('The Page Rule sandbox failed to start')); }, CALL_TIMEOUT_MS);
    const origResolve = resolve;
    resolve = (v) => { clearTimeout(bootTimer); origResolve(v); };

    document.body.appendChild(iframe);
  });

// Save-time validation, per the reference: syntax + a callable entry() that
// returns a Question-shaped object for a first-question probe context.
export const validatePageRule = async (code, probeContext) => {
  let session;
  try {
    session = await createPageRuleSession(code, {});
    const question = await session.ask(
      probeContext || {
        user: { name: 'Validator', username: 'validator', role: null, permissions: [] },
        answers: [],
        currentQuestion: 0,
        currentLocation: { outlet: null, register: null },
      }
    );
    if (!question || typeof question.question !== 'string' || !Array.isArray(question.elements)) {
      return { ok: false, error: 'entry() must return a Question with a `question` string and an `elements` array' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'The Page Rule failed validation' };
  } finally {
    session?.destroy();
  }
};
