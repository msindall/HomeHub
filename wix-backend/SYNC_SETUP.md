# Home Hub — Cross-Device Sync Setup (Phase 0.5, Option A)

This is the **backend / Wix-side setup** for cross-device sync. It uses the same
classic Wix Editor site that already runs the `cardLookup` proxy. The app stays a
static file; Wix only stores the shared data and verifies logins.

> **Model:** real Wix Members accounts (Wix stores the passwords), but login
> happens through our own HTTP functions because Home Hub isn't a page on the Wix
> site. State is stored per **household**, so Matt & Holly each have their own
> login yet share one dataset. Auto-sync: the app pulls on open and pushes
> (debounced) after changes — that wiring is **Stage 2** (client side, not done yet).

---

## 1. Add the backend code

`wix-backend/http-functions.js` now contains the sync functions alongside
`cardLookup`. In the Wix Editor: **Dev Mode → Backend → http-functions.js**, paste
the full file contents, then **Publish**.

It imports `wix-members-backend` and `wix-data` — both are built in, nothing to install.

## 2. Create three Wix Data collections

Wix Editor → **Content Manager → Create Collection**. For each, set
**Permissions → "Admin only"** (the backend uses `suppressAuth`, so it works
regardless, and this keeps the public out).

### `HomeHubHouseholds`
| Field | Type |
|---|---|
| `joinCode` | Text |
| `ownerEmail` | Text |
| `stateJson` | Text (long — holds the whole app state blob) |
| `updatedAt` | Date & Time |
| `updatedByEmail` | Text |

### `HomeHubMembers`
| Field | Type |
|---|---|
| `memberId` | Text |
| `email` | Text |
| `householdId` | Text |

### `HomeHubSessions`
| Field | Type |
|---|---|
| `token` | Text |
| `memberId` | Text |
| `email` | Text |
| `householdId` | Text |
| `expiresAt` | Date & Time |

(The default `_id`, `_createdDate`, `_updatedDate` system fields are fine; we don't rely on them.)

## 3. Turn on Members signups

Wix Editor → **Settings → Members area / Signup settings**:
- Allow new members to **sign up**.
- Set approval to **Automatic** (not "manual approval"), so `authentication.register()`
  returns an active member immediately.

## 4. Publish, then smoke-test the endpoints

Base URL (same site as cardLookup):
`https://mattjsindall.wixsite.com/homehub/_functions/`

Register + create a household:
```
POST .../authRegister
{ "email": "matt@example.com", "password": "secret123", "mode": "create" }
→ { "ok": true, "token": "...", "householdId": "...", "joinCode": "ABC234" }
```

Holly joins the same household with that code:
```
POST .../authLogin            (after she registers with mode:"join", joinCode:"ABC234")
{ "email": "holly@example.com", "password": "..." }
→ { "ok": true, "token": "...", "householdId": "(same id)" }
```

Save + load state:
```
POST .../syncSave   { "token": "...", "stateJson": "{\"hello\":1}" }   → { "ok": true, "updatedAt": "..." }
GET  .../syncLoad?token=...                                            → { "ok": true, "stateJson": "{\"hello\":1}" }
```

A quick browser/Postman check is enough. Once `syncSave` then `syncLoad` round-trips
the same JSON, the backend is proven (the cardLookup pattern, repeated).

---

## Stage 2 — client wiring (next session)

In the app (built via `build.py`), add a small sync module + a Sign-in modal that:
1. Calls `authRegister` / `authLogin`, stores the returned `token` in `localStorage`
   (key `hh_sync`), separate from the Anthropic key.
2. On startup, if signed in: `GET syncLoad` and, if the cloud copy is newer than
   local, load it into `state`.
3. After `saveState()`, debounce a `POST syncSave` of the current `state`.
4. Show last-synced time + who, and a manual "Sync now" fallback.

Conflict strategy starts as **last-write-wins by `updatedAt`**, with a guard when a
pull would overwrite newer local edits. We can add `wix-realtime` push later (roadmap).

## Honest limits

- **Free Wix plan**: storage/bandwidth/function-call quotas apply. Fine for two
  people; check current limits before heavy use. Reliable scheduled jobs (email
  reminders) need a paid plan.
- **State size**: the whole `state` goes into one `stateJson` field. Years of data
  with base64 receipt images could get large — media should move to Wix Media later
  (roadmap item).
- **Token in query string** on `syncLoad`: acceptable for this MVP; can move to a
  header later if desired.
