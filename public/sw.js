/* Push notification service worker */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Notification', body: '' };
  }
  const title = data.title || 'POS Notification';
  const opts = {
    body: data.body || '',
    icon: data.icon || '/vite.svg',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url && c.focus) {
          c.navigate(url);
          c.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url.startsWith('/') ? `${self.location.origin}${url}` : url);
      }
    })
  );
});
