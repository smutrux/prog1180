import toast from 'react-hot-toast';

const toastStyle = {
  borderRadius: '8px',
  background: '#333',
  color: '#fff',
};

export const notifySuccess = (message: string, id?: string) => {
  toast.success(message, { id, style: toastStyle });
};

export const notifyError = (message: string, id?: string) => {
  toast.error(message, { id, style: toastStyle });
};

/** Shows a spinner toast and returns its id. Passing that id to a later
 *  notify call replaces the spinner in place instead of stacking a
 *  second toast; dismissToast removes it with nothing shown. */
export const notifyLoading = (message: string) => {
  return toast.loading(message, { style: toastStyle });
};

export const dismissToast = (id: string) => {
  toast.dismiss(id);
};

const QUEUED_TOAST_KEY = 'pendingToast';

/** Queues a success toast for after the next page load. A toast shown
 *  right before a full reload or a sign-out redirect never gets to
 *  render, so it waits in sessionStorage and fires on mount instead. */
export const queueToast = (message: string) => {
  sessionStorage.setItem(QUEUED_TOAST_KEY, message);
};

/** Shows the queued toast, if there is one, and clears it. */
export const fireQueuedToast = () => {
  const message = sessionStorage.getItem(QUEUED_TOAST_KEY);
  if (!message) return;
  sessionStorage.removeItem(QUEUED_TOAST_KEY);
  notifySuccess(message);
};

const toastHostListeners = new Set<() => void>();
let toastHost: HTMLElement | null = null;

export const setToastHost = (el: HTMLElement | null) => {
  if (toastHost === el) return;
  toastHost = el;
  toastHostListeners.forEach((listener) => listener());
};

export const getToastHost = () => toastHost;

export const subscribeToastHost = (listener: () => void) => {
  toastHostListeners.add(listener);
  return () => {
    toastHostListeners.delete(listener);
  };
};

export const clearToastHost = (el: HTMLElement) => {
  if (toastHost === el) setToastHost(null);
};
