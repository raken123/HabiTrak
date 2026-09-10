// Mini's bridge. Deliberately the same shape as the web bridge in
// www/js/web-bridge.js, so the page cannot tell which one it is talking to.

const { contextBridge, ipcRenderer } = require('electron');

let seq = 0;

async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (res && res.ok) return res.value;
  const err = new Error(res?.error?.message || 'Something went wrong.');
  Object.assign(err, res?.error || {});
  throw err;
}

contextBridge.exposeInMainWorld('hazelnutMini', {
  kind: 'desktop',
  getState: () => call('app:state'),
  startTrial: () => call('trial:start'),
  activate: (key) => call('license:activate', key),
  saveApiKey: (key) => call('apikey:save', key),
  openImage: () => call('file:open'),
  saveImage: (dataUrl) => call('file:save', dataUrl),
  openExternal: (url) => call('shell:open-external', url),

  remove: (opts, onProgress) => job('mini:remove', opts, onProgress),
  transform: (toolId, opts, onProgress) => job('tool:transform', { toolId, ...opts }, onProgress),
  describe: (opts, onProgress) => job('tool:describe', opts, onProgress),
});

/** A tool run: progress on the way, and a cancel that reaches the engine. */
function job(channel, opts, onProgress) {
  const jobId = `job-${Date.now().toString(36)}-${(seq += 1)}`;
  const listener = (_e, payload) => {
    if (payload.jobId === jobId && onProgress) onProgress(payload);
  };
  ipcRenderer.on('job:progress', listener);
  const promise = call(channel, jobId, opts)
    .finally(() => ipcRenderer.removeListener('job:progress', listener));
  promise.cancel = () => ipcRenderer.send('job:cancel', jobId);
  return promise;
}
