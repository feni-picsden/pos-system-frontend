import { useEffect, useRef, useState } from 'react';

// Per-row graphs (Products sparkline, Customers performance) used to fire one
// request per row the moment the list rendered: 40+ calls queued behind the
// backend's few DB connections, so the column spun for ~25 s. Now a row's
// request starts only once the row is on screen, and at most LIMIT run at a
// time, so the rows the user is looking at fill first. Same endpoints, same
// data; only the timing changes.
const LIMIT = 3;
let running = 0;
const queue = [];

const pump = () => {
  while (running < LIMIT && queue.length > 0) {
    const job = queue.shift();
    running += 1;
    job().finally(() => {
      running -= 1;
      pump();
    });
  }
};

const enqueue = (fn) =>
  new Promise((resolve, reject) => {
    queue.push(() => Promise.resolve().then(fn).then(resolve, reject));
    pump();
  });

// Drop a queued job that no longer matters (row scrolled away before its turn).
const dequeue = (job) => {
  const i = queue.indexOf(job);
  if (i >= 0) queue.splice(i, 1);
};

/**
 * Loads `loader()` for `key` once the element behind `ref` is visible.
 * Returns { ref, data, loading }. `data` is null until loaded.
 */
export default function useLazyRowLoad(key, loader) {
  const ref = useRef(null);
  const [state, setState] = useState({ key: null, data: null, loading: true });

  useEffect(() => {
    if (key == null) {
      setState({ key, data: null, loading: false });
      return undefined;
    }
    let active = true;
    let started = false;
    let queued = null;
    setState({ key, data: null, loading: true });

    const start = () => {
      if (started) return;
      started = true;
      queued = () => (active ? loader() : Promise.resolve(null));
      enqueue(queued).then(
        (data) => { if (active) setState({ key, data, loading: false }); },
        () => { if (active) setState({ key, data: null, loading: false }); }
      );
    };

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      start();
      return () => { active = false; };
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: '200px 0px' });
    io.observe(el);
    return () => {
      active = false;
      io.disconnect();
      if (queued) dequeue(queued);
    };
  }, [key, loader]);

  return { ref, data: state.key === key ? state.data : null, loading: state.key !== key || state.loading };
}
