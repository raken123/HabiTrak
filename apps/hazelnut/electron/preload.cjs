// The only bridge between the sandboxed renderer and the privileged main
// process. Every call is named and typed here; the renderer cannot reach
// anything that is not on this object, and the API key is deliberately not.

const { contextBridge, ipcRenderer } = require('electron');

let jobSeq = 0;
const nextJobId = () => `job-${Date.now().toString(36)}-${(jobSeq += 1)}`;

/** Unwrap the { ok, value | error } envelope main.js replies with. */
async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (res && res.ok) return res.value;
  const err = new Error(res?.error?.message || 'Something went wrong.');
  Object.assign(err, res?.error || {});
  return Promise.reject(err);
}

/**
 * Start a tool run. Returns the promise plus a `cancel()` and the job id, so a
 * long generation can be abandoned from the UI.
 */
function job(channel, opts, onProgress) {
  const jobId = nextJobId();
  const listener = (_e, payload) => {
    if (payload.jobId === jobId && onProgress) onProgress(payload);
  };
  ipcRenderer.on('job:progress', listener);
  const promise = call(channel, jobId, opts).finally(() => {
    ipcRenderer.removeListener('job:progress', listener);
  });
  promise.jobId = jobId;
  promise.cancel = () => ipcRenderer.send('job:cancel', jobId);
  return promise;
}

contextBridge.exposeInMainWorld('hazelnut', {
  getState: () => call('app:state'),
  saveSettings: (patch) => call('app:settings', patch),

  startTrial: () => call('trial:start'),
  activate: (key) => call('license:activate', key),
  deactivate: () => call('license:deactivate'),
  saveApiKey: (key) => call('apikey:save', key),

  quote: (toolId, params) => call('tool:quote', toolId, params || {}),
  refund: (toolId, amount, note) => call('credits:refund', toolId, amount, note),

  magicDraw: (opts, onProgress) => job('tool:magic-draw', opts, onProgress),
  // The cheap edits all take the same shape, so they share one channel.
  transform: (toolId, opts, onProgress) => job('tool:transform', { toolId, ...opts }, onProgress),
  describe: (opts, onProgress) => job('tool:describe', opts, onProgress),
  realtouch: (opts, onProgress) => job('tool:realtouch', opts, onProgress),
  gifAnimate: (opts, onProgress) => job('tool:gif-animate', opts, onProgress),
  aiscopeLearn: (opts, onProgress) => job('tool:aiscope-learn', opts, onProgress),

  openImage: () => call('file:open'),
  openImagePath: (p) => call('file:open-path', p),
  saveImage: (dataUrl, name) => call('file:save', dataUrl, name),
  openExternal: (url) => call('shell:open-external', url),

  onMenuCommand: (handler) => {
    const listener = (_e, id) => handler(id);
    ipcRenderer.on('menu:command', listener);
    return () => ipcRenderer.removeListener('menu:command', listener);
  },
});
