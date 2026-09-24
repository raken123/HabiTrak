// Movi's desktop bridge. Deliberately the same shape as the web bridge in
// web/bridge.js, so the page cannot tell which one it is talking to.

const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (res && res.ok) return res.value;
  const err = new Error(res?.error?.message || 'Something went wrong.');
  Object.assign(err, res?.error || {});
  throw err;
}

contextBridge.exposeInMainWorld('hazelnutMovi', {
  kind: 'desktop',
  getState: () => call('app:state'),
  markWelcomed: () => call('app:welcomed'),
  renderSimple: (plan) => call('movi:simple', plan),
  renderClip: (opts) => call('movi:clip', opts),
  listClips: () => call('movi:clips'),
  restore: (id) => call('movi:restore', id),
  history: (limit) => call('movi:history', limit),
  openExternal: (url) => call('shell:open-external', url),
});
