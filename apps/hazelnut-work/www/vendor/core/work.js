// GENERATED — do not edit. Source: packages/core. Refresh with `npm run sync:core`.
// Hazelnut Work: the coworker, and what it is allowed to touch.
//
// ─────────────────────────────────────────────────────────────────────────────
// NOTHING HERE IS CONNECTED.
//
// Every connector below is a description of an integration, not an
// integration. There is no OAuth client, no token store, no redirect URI and
// no server to redirect to; `connect()` marks a connector connected in local
// state and that is the whole of it. When a real one is built, the scopes
// listed here are the scopes to ask for, and `SCOPES` is the list the consent
// screen has to match.
//
// This is written down because a coworker is the one product where pretending
// would be worst. An app that says "Connected to Gmail" beside a green dot,
// and has read nothing, is lying about the most sensitive thing it could lie
// about.
// ─────────────────────────────────────────────────────────────────────────────
//
// The rule the rest of the app enforces: Work never sends anything on your
// behalf without showing you the thing first. Every task below is marked
// `sends` or not, and the ones that send are the ones that must be confirmed.

export const CONNECTORS = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    vendor: 'Google',
    kind: 'mail',
    scopes: ['read messages', 'draft replies', 'apply labels'],
  },
  outlook: {
    id: 'outlook',
    name: 'Outlook',
    vendor: 'Microsoft',
    kind: 'mail',
    scopes: ['read messages', 'draft replies', 'move to folders'],
  },
  gcal: {
    id: 'gcal',
    name: 'Google Calendar',
    vendor: 'Google',
    kind: 'calendar',
    scopes: ['read events', 'propose times'],
  },
  outlookcal: {
    id: 'outlookcal',
    name: 'Outlook Calendar',
    vendor: 'Microsoft',
    kind: 'calendar',
    scopes: ['read events', 'propose times'],
  },
  drive: {
    id: 'drive',
    name: 'Google Drive',
    vendor: 'Google',
    kind: 'files',
    scopes: ['read files', 'save attachments'],
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    vendor: 'Slack',
    kind: 'chat',
    scopes: ['read channels you are in', 'draft messages'],
  },
};

export const CONNECTOR_ORDER = ['gmail', 'outlook', 'gcal', 'outlookcal', 'drive', 'slack'];

/** The union of every scope any connector asks for — what consent must cover. */
export const SCOPES = [...new Set(
  CONNECTOR_ORDER.flatMap((id) => CONNECTORS[id].scopes),
)];

export function connectorFor(id) {
  return CONNECTORS[id] || null;
}

/**
 * What the coworker can be asked to do.
 *
 * `needs` is the kind of connector required, not a specific one: triage works
 * off Gmail or Outlook and should not care which. `sends` marks the tasks that
 * would put something in front of another human, and those are the ones the UI
 * has to confirm.
 */
export const TASKS = {
  triage: {
    id: 'triage',
    name: 'Triage the inbox',
    needs: 'mail',
    cost: 20,
    sends: false,
    blurb: 'Sorts what arrived into what needs you, what needs a reply, and '
      + 'what needs nothing.',
  },
  summarise: {
    id: 'summarise',
    name: 'Summarise a thread',
    needs: 'mail',
    cost: 15,
    sends: false,
    blurb: 'Forty messages, one paragraph, and who is waiting on what.',
  },
  draft: {
    id: 'draft',
    name: 'Draft a reply',
    needs: 'mail',
    cost: 25,
    sends: false,
    blurb: 'Writes the reply and leaves it in drafts. It does not send it.',
  },
  chase: {
    id: 'chase',
    name: 'Chase what went quiet',
    needs: 'mail',
    cost: 20,
    sends: false,
    blurb: 'Finds the mail you sent that nobody answered, and drafts the nudge.',
  },
  meet: {
    id: 'meet',
    name: 'Find a time',
    needs: 'calendar',
    cost: 15,
    sends: false,
    blurb: 'Reads the calendars and proposes slots that work for everybody.',
  },
  file: {
    id: 'file',
    name: 'File the attachments',
    needs: 'files',
    cost: 10,
    sends: false,
    blurb: 'Pulls attachments out of the mail and puts them in your Hazelnut '
      + 'storage, named after the thread they came from.',
  },
  standup: {
    id: 'standup',
    name: 'Write the standup',
    needs: 'chat',
    cost: 20,
    sends: false,
    blurb: 'Reads the week and drafts what you did, for you to edit before it '
      + 'goes anywhere.',
  },
};

export const TASK_ORDER = ['triage', 'summarise', 'draft', 'chase', 'meet', 'file', 'standup'];

export function taskFor(id) {
  return TASKS[id] || null;
}

/** Which connectors would satisfy a task, given what is connected. */
export function connectorsFor(taskId) {
  const task = TASKS[taskId];
  if (!task) return [];
  return CONNECTOR_ORDER.filter((id) => CONNECTORS[id].kind === task.needs);
}

/**
 * Can this task run with these connectors?
 *
 * Returns what is missing rather than a bare false, so the button can say
 * "Connect Gmail or Outlook first" instead of being mysteriously grey.
 */
export function canRun(taskId, connected = []) {
  const task = TASKS[taskId];
  if (!task) return { ok: false, missing: [] };
  const usable = connectorsFor(taskId);
  const have = usable.filter((id) => connected.includes(id));
  return have.length
    ? { ok: true, using: have[0], missing: [] }
    : { ok: false, missing: usable };
}

/** "Connect Gmail or Outlook first" — the sentence, built once. */
export function missingLine(taskId, connected = []) {
  const { ok, missing } = canRun(taskId, connected);
  if (ok || !missing.length) return null;
  const names = missing.map((id) => CONNECTORS[id].name);
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  return `Connect ${list} first.`;
}

export function costOf(taskId) {
  return TASKS[taskId]?.cost ?? 0;
}
