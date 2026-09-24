// Work's desktop bridge. The same shape as web/bridge.js, so the page cannot
// tell which one it is talking to.

const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  if (res && res.ok) return res.value;
  const err = new Error(res?.error?.message || 'Something went wrong.');
  Object.assign(err, res?.error || {});
  throw err;
}

contextBridge.exposeInMainWorld('hazelnutWork', {
  kind: 'desktop',
  getState: () => call('app:state'),
  connect: (id) => call('work:connect', id),
  disconnect: (id) => call('work:disconnect', id),
  run: (taskId, connectorId) => call('work:run', { taskId, connectorId }),
  listDrafts: () => call('work:drafts'),
  history: (limit) => call('work:history', limit),
  openExternal: (url) => call('shell:open-external', url),
});
