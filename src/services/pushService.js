import apiClient from './apiClient';

/**
 * Request browser notification permission.
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications');
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Register the service worker.
 * @returns {Promise<ServiceWorkerRegistration>}
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });
  await navigator.serviceWorker.ready;
  return registration;
}

/**
 * Subscribe the user to push notifications using the current service worker.
 * @param {string} applicationServerKey - VAPID public key (base64url)
 * @returns {Promise<PushSubscription>}
 */
export async function subscribeUserToPush(applicationServerKey) {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    return subscription;
  }
  const keyBuffer = urlBase64ToUint8Array(applicationServerKey);
  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBuffer,
  });
  return subscription;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Send subscription data to the backend.
 * @param {{ deviceName: string, subscription: PushSubscription }} opts
 */
export async function sendSubscriptionToServer({ deviceName, subscription }) {
  const sub = subscription.toJSON();
  const keys = sub.keys || {};
  const response = await apiClient.post('/push/register-device', {
    deviceName,
    endpoint: sub.endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });
  return response.data;
}

/**
 * Full flow: register device from current browser.
 * @param {string} deviceName
 * @returns {Promise<{ success: boolean, device?: object, error?: string }>}
 */
export async function registerCurrentDevice(deviceName) {
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { success: false, error: 'Notification permission denied' };
  }
  const registration = await registerServiceWorker();
  const { data } = await apiClient.get('/push/vapid-public-key');
  const publicKey = data.publicKey;
  const subscription = await subscribeUserToPush(publicKey);
  const result = await sendSubscriptionToServer({ deviceName, subscription });
  return { success: true, device: result.device };
}

export const pushApi = {
  getDevices: () => apiClient.get('/push/devices'),
  updateSettings: (deviceId, settings) =>
    apiClient.put(`/push/settings/${deviceId}`, settings),
  send: (payload) => apiClient.post('/push/send', payload),
};
