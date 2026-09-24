# Hazelnut, the service

Hazelnut used to mean the editor. It means the account now, and the editor is
one of three things on it.

| | Product | What it is | Where it runs |
|---|---|---|---|
| `photo` | **Hazelnut Photo** | The editor. 23 tools, 12 of them on your machine, two image models of our own. | Windows, Mac, Android, browser |
| `movi` | **Hazelnut Movi** | Moving pictures, on Hazelnut 3.0. | Windows, Mac |
| `work` | **Hazelnut Work** | A coworker for the mail you already have. | Windows, Mac, browser |
| `squirreal` | ~~Hazelnut Squirreal~~ | **Withdrawn.** Movi replaces it. | — |

`packages/core/products.js` is the list, and it is the only list. `SERVICE.name`
is the account; `PRODUCTS.photo.name` is the editor. They are separate fields
on purpose — the rename is the part most likely to break something, because
every dialog that says "Hazelnut" now has to mean one or the other and cannot
mean both.

`planFor()` accepts `photo` and `hazelnut` as the same family. Every licence
stored before the pivot says `hazelnut`, and the rename must not log those
people out of their own app.

## Storage

`packages/core/storage.js`.

| Tier | Quota | Who |
|---|---|---|
| Founder | 48 EB | The first **50** accounts, and only those |
| Standard | 200 GB | Every account opened after that |

The founder tier needs **places left and the date** — either running out closes
it, and `founderClosedBecause()` says which, because "the places have gone" and
"the offer closed on the 30th" are different things to be told.

The deadline is on **joining**, not on keeping. A founder account keeps its
storage after the offer shuts. An offer that reached back and took the storage
away would make it a loan, and it is not sold as one. This is the same rule the
fall deal follows in `offers.js`.

### Why BigInt

48 exabytes is 4.8 × 10¹⁹ bytes. `Number.MAX_SAFE_INTEGER` is 9.007 × 10¹⁵.
A quota held in a double is a number that is merely *near* the truth, and a
quota that is near the truth will one day subtract wrongly — so every size in
`storage.js` is a `BigInt` and converts to `Number` only to compute a bar
width.

Two consequences worth knowing:

- `usedFraction` scales **before** dividing. BigInt division floors, so
  `used / quota` is `0` for everything short of the whole quota, and the bar
  would read empty at 199 GB of 200. There is a test for exactly that.
- Bridges hand `quotaBytes` to their pages as a **string**. A BigInt does not
  survive `structuredClone` into every host, and it does not survive being
  turned into a Number either.

The apps print the figure rather than softening it into "unlimited". It is not
unlimited. It is 48 exabytes.

### There is no server

Nothing in this repository stores a byte for anybody. `storage.js` is the
client's model of a quota; the meter in each app draws it. When there is a real
backing store, `usedBytes` comes from it and nothing else changes. This is said
out loud in the file for the same reason `license.js` says it about the
redemption server: a quota in a progress bar looks equally real either way, and
the place to admit which it is, is the file that draws it.

## Movi

`packages/core/movi.js`.

| Model | Height | Credits/second | 8-second clip |
|---|---|---|---|
| Hazelnut 3.0 Lite | 720p | 12 | 96 |
| Hazelnut 3.0 Lite Fast | 720p | 15 | 120 |
| Hazelnut 3.0 Pro | 1080p | 40 | 320 |

Lite and Lite Fast **draw the same picture**. What Fast sells is the wait, and
it costs more per second for it — so the blurb says "you are paying for the
wait, not the quality" rather than implying it looks better.

### The two modes

**Simple** decides the length, the quality and the price from the words alone,
then **charges before it asks**. That ordering is the product. Two things
follow from it and both are enforced:

- `planSimple` is **deterministic**. The same sentence must produce the same
  plan and therefore the same price, because a price that moved between the
  quote and the charge would be indefensible.
- It is never allowed to plan something the balance cannot pay for. Over
  budget, it **shortens before it downgrades** — a shorter clip of what was
  asked for is nearer the ask than a longer one of something cheaper — and
  reports which in `trimmed`. If it cannot plan even one clip of the cheapest
  model it returns `affordable: false` rather than planning a failure.

**Advanced** makes 8-second clips, quoted on the button before it is pressed,
and extends them in the Editor. An extension costs a **whole clip**, because it
is one: nothing about the first is reused, and pricing it as though it were
would be quoting a discount that does not exist.

### Putting the credits back

`RESTORE_WINDOW_MS` is 15 minutes, once per render, Simple only. There has to
be a window and it has to be written down — "put the credits back whenever you
like" is a free video service, and the first person to notice would never pay
for anything again.

`restorable()` returns a **reason** rather than a bare `false`, because "you
already had these back" and "that was an hour ago" are different things to be
told, and the UI should not have to guess which happened. Every refusal has its
own sentence in `RESTORE_REASONS`, and a test asserts they differ.

The rules are checked in the **bridge**, not the page. The page is the part a
determined person edits.

### Nothing renders

There are no Hazelnut 3.0 servers here. `renderSimple` and `renderClip` move
credits, write a record and return `pending: true`; the app draws a placard
reading **NOT RENDERED** rather than a black rectangle that could be mistaken
for output. The day a renderer fills `frame`, the placard disappears on its own.

## Work

`packages/core/work.js`. Six connectors — Gmail, Outlook, Google Calendar,
Outlook Calendar, Google Drive, Slack — and seven tasks.

Two rules the product is sold on, and both are held by tests:

- **No task sends anything on your behalf.** Every task is `sends: false`. If
  one is ever added that sends, it needs a confirmation path, and the test is
  where that gets noticed.
- A task with no connector **names the ones that would satisfy it**
  (`missingLine` → "Connect Gmail or Outlook first.") rather than going
  mysteriously grey.

### Nothing is connected

There is no OAuth client, no token store, no redirect URI and no server to
redirect to. `connect()` writes an id into local state and reads no mail; every
draft is a placeholder that says so **in its own body**, so a screenshot taken
out of context still tells the truth.

The disclosure across the top of the window comes from the **host**, not the
page, so it cannot be edited out of the markup alone. A coworker is the one
product where a green dot beside "Connected to Gmail" would be the worst thing
to fake.

When a real integration exists, the `scopes` listed per connector are what the
consent screen must ask for.

## Squirreal, withdrawn

Every AI tool Squirreal had was a video model somebody else ran. That account is
closed, so those calls fail — and they can fail two ways: as a timeout, a retry
and a stack trace, or as a sentence. `VideoClient` takes a `product` and throws
`PRODUCT_WITHDRAWN` **before opening a socket**, with no retries and no waiting.
A test counts the fetches and asserts zero.

The app is not deleted and does not pretend to be gone. On launch it shows the
notice from `products.js`, and it says what still works — opening, trimming and
exporting clips, and every frame tool that ran on your machine — before it says
what does not. `RETIRED_PLANS` keeps the plan describable, because people hold
it and their app still has to be able to ask what they have.
