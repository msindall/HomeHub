/*************************************************************************
 * Home Hub — Phase 0 backend  (Wix Velo HTTP function)
 * File location in Wix:  Backend  →  http-functions.js
 *
 * Card-lookup proxy: Home Hub calls this from the browser, Wix fetches
 * the card page server-side (no CORS), pulls out a few fields, returns JSON.
 *
 * Live URL once published (classic Wix Editor / free site):
 *   https://USERNAME.wixsite.com/SITENAME/_functions/cardLookup?url=...
 *
 * Quick check (no ?url=) should return:
 *   {"ok":false,"error":"Missing ?url= parameter"}
 *************************************************************************/

import { ok, badRequest, serverError, response } from 'wix-http-functions';
import { fetch } from 'wix-fetch';
import { authentication } from 'wix-members-backend';
import wixData from 'wix-data';

// CORS so Home Hub (any origin / local file) can read the reply.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

// Pre-flight OPTIONS request handler.
export function options_cardLookup(request) {
  return response({ status: 200, headers: CORS, body: '' });
}

// GET /_functions/cardLookup?url=<encoded card page url>
export async function get_cardLookup(request) {
  const target = request.query && request.query.url;

  if (!target) {
    return badRequest({
      headers: CORS,
      body: { ok: false, error: 'Missing ?url= parameter' }
    });
  }

  if (!/^https?:\/\//i.test(target)) {
    return badRequest({
      headers: CORS,
      body: { ok: false, error: 'url must start with http:// or https://' }
    });
  }

  try {
    const res = await fetch(target, {
      method: 'get',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html'
      }
    });

    if (!res.ok) {
      return response({
        status: 502,
        headers: CORS,
        body: { ok: false, error: 'Upstream returned HTTP ' + res.status, url: target }
      });
    }

    const html = await res.text();
    const data = extractCardFields(html);

    return ok({
      headers: CORS,
      body: {
        ok: true,
        url: target,
        fetchedAt: new Date().toISOString(),
        ...data
      }
    });
  } catch (err) {
    return serverError({
      headers: CORS,
      body: { ok: false, error: String(err && err.message ? err.message : err), url: target }
    });
  }
}

/*------------------------------------------------------------------
 * Field extraction — best effort, never throws.
 *-----------------------------------------------------------------*/
function extractCardFields(html) {
  const out = {
    title: null,
    description: null,
    annualFee: null,
    rewardsRate: null,
    matchedSnippets: []
  };
  if (!html) return out;

  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (t) out.title = decode(t[1]).trim();

  const d =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (d) out.description = decode(d[1]).trim();

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  let fee =
    text.match(/annual\s+fee[^$0-9]{0,20}\$?\s?([0-9]{1,4}(?:\.[0-9]{2})?)/i) ||
    text.match(/\$\s?([0-9]{1,4}(?:\.[0-9]{2})?)[^.]{0,20}annual\s+fee/i);
  if (fee) {
    out.annualFee = Number(fee[1]);
  } else if (/no\s+annual\s+fee/i.test(text)) {
    out.annualFee = 0;
  }

  const rate =
    text.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:cash\s*back|back|rewards)/i) ||
    text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:x|×)\s*(?:points|the points|reward)/i) ||
    text.match(/([0-9]+(?:\.[0-9]+)?)\s*points?\s*(?:per|for every|\/)\s*\$?1?\s*(?:dollar|spent)?/i);
  if (rate) out.rewardsRate = decode(rate[0]).trim();

  const re = /([^.]{0,60}(?:annual fee|points per|cash back|% back)[^.]{0,60})/gi;
  let m, n = 0;
  while ((m = re.exec(text)) && n < 5) {
    out.matchedSnippets.push(m[1].trim());
    n++;
  }

  return out;
}

function decode(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/*************************************************************************
 * Phase 0.5 — Cross-device sync (Option A: Wix as backend)
 *
 * Home Hub is a static file, so it can't use Wix's in-page Members login.
 * Instead the app POSTs email+password to these functions; Wix Members
 * stores/verifies the password (we never hash anything ourselves), and we
 * hand back our own opaque session token. State is stored per HOUSEHOLD so
 * Matt & Holly each have their own login but share one dataset.
 *
 * Endpoints (classic Wix Editor / free site):
 *   POST /_functions/authRegister  {email,password,mode:'create'|'join',joinCode?}
 *   POST /_functions/authLogin     {email,password}
 *   POST /_functions/syncSave      {token,stateJson}
 *   GET  /_functions/syncLoad?token=...
 *
 * Requires three Wix Data collections (see wix-backend/SYNC_SETUP.md):
 *   HomeHubHouseholds { joinCode, ownerEmail, stateJson, updatedAt, updatedByEmail }
 *   HomeHubMembers    { memberId, email, householdId }
 *   HomeHubSessions   { token, memberId, email, householdId, expiresAt }
 *
 * All wixData calls use { suppressAuth: true } so the backend owns the data
 * regardless of each collection's permission settings.
 *************************************************************************/

// NOTE: these are the collections' internal Wix IDs, not their display names.
// CSV-imported collections get auto-assigned IDs (Import1/2/3); the CMS still
// shows the friendly names HomeHubHouseholds / HomeHubMembers / HomeHubSessions.
// If you ever recreate a collection, re-check its ID via the CMS / Data API.
const HH_HOUSEHOLDS = 'Import1'; // display name: HomeHubHouseholds
const HH_MEMBERS    = 'Import2'; // display name: HomeHubMembers
const HH_SESSIONS   = 'Import3'; // display name: HomeHubSessions
const HH_SESSION_DAYS = 30;
const HH_DB = { suppressAuth: true };

// CORS preflight handlers (browsers send OPTIONS before a JSON POST).
export function options_authRegister(request) { return response({ status: 200, headers: CORS, body: '' }); }
export function options_authLogin(request)    { return response({ status: 200, headers: CORS, body: '' }); }
export function options_syncSave(request)     { return response({ status: 200, headers: CORS, body: '' }); }
export function options_syncLoad(request)     { return response({ status: 200, headers: CORS, body: '' }); }

function hhNewToken() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2) +
          Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '');
}

// Human-friendly join code; skips easily-confused characters (0/O, 1/I).
function hhNewJoinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

async function hhSessionFor(token) {
  if (!token) return null;
  const r = await wixData.query(HH_SESSIONS).eq('token', token).find(HH_DB);
  const s = r.items[0];
  if (!s) return null;
  if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) return null;
  return s;
}

async function hhIssueSession(memberId, email, householdId) {
  const token = hhNewToken();
  const expiresAt = new Date(Date.now() + HH_SESSION_DAYS * 86400000);
  await wixData.insert(HH_SESSIONS, { token, memberId, email, householdId, expiresAt }, HH_DB);
  return { token, expiresAt };
}

// POST /_functions/authRegister
export async function post_authRegister(request) {
  try {
    const body = await request.body.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const mode = body.mode === 'join' ? 'join' : 'create';
    const joinCode = String(body.joinCode || '').trim().toUpperCase();

    if (!email || !password) {
      return ok({ headers: CORS, body: { ok: false, error: 'Email and password are required.' } });
    }

    // 1. Establish/verify the credential. Wix Members hashes/stores the password.
    //    If the email is already a member (e.g. the site owner, or a prior test),
    //    register() throws — fall back to verifying the password via login() so an
    //    existing account can still set up or join a household.
    let memberId = null;
    try {
      if (password.length < 6) {
        return ok({ headers: CORS, body: { ok: false, error: 'Password must be at least 6 characters.' } });
      }
      const reg = await authentication.register(email, password);
      memberId = (reg && reg.member && (reg.member._id || reg.member.id)) || null;
    } catch (e) {
      try {
        await authentication.login(email, password);   // existing account — verify password
      } catch (e2) {
        return ok({ headers: CORS, body: { ok: false, error:
          'That email is already registered, but that password didn\'t match. Use the existing password for this email, or pick a different email.' } });
      }
    }

    // 2. Reuse an existing member link if there is one.
    const mr = await wixData.query(HH_MEMBERS).eq('email', email).find(HH_DB);
    const memberRec = mr.items[0] || null;
    if (memberRec && memberRec.memberId) memberId = memberRec.memberId;
    if (!memberId) memberId = email;   // stable fallback key

    // 3. Resolve the household: already linked → sign in; else create or join.
    let householdId, hhItem;
    if (memberRec && memberRec.householdId) {
      householdId = memberRec.householdId;
      hhItem = await wixData.get(HH_HOUSEHOLDS, householdId, HH_DB);
    } else if (mode === 'join') {
      if (!joinCode) return ok({ headers: CORS, body: { ok: false, error: 'Enter the household join code to join.' } });
      const hr = await wixData.query(HH_HOUSEHOLDS).eq('joinCode', joinCode).find(HH_DB);
      hhItem = hr.items[0];
      if (!hhItem) return ok({ headers: CORS, body: { ok: false, error: 'No household found for that join code.' } });
      householdId = hhItem._id;
      await wixData.insert(HH_MEMBERS, { memberId, email, householdId }, HH_DB);
    } else {
      hhItem = await wixData.insert(HH_HOUSEHOLDS, {
        joinCode: hhNewJoinCode(), ownerEmail: email, stateJson: '',
        updatedAt: new Date(), updatedByEmail: email
      }, HH_DB);
      householdId = hhItem._id;
      await wixData.insert(HH_MEMBERS, { memberId, email, householdId }, HH_DB);
    }

    const sess = await hhIssueSession(memberId, email, householdId);

    return ok({ headers: CORS, body: {
      ok: true, token: sess.token, email,
      householdId, joinCode: hhItem ? hhItem.joinCode : null,
      updatedAt: hhItem ? hhItem.updatedAt : null
    }});
  } catch (err) {
    return serverError({ headers: CORS, body: { ok: false, error: String(err && err.message ? err.message : err) } });
  }
}

// POST /_functions/authLogin
export async function post_authLogin(request) {
  try {
    const body = await request.body.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return ok({ headers: CORS, body: { ok: false, error: 'Email and password are required.' } });
    }

    // Verify the password via Wix Members (throws if wrong).
    try {
      await authentication.login(email, password);
    } catch (e) {
      return ok({ headers: CORS, body: { ok: false, error: 'Incorrect email or password.' } });
    }

    const mr = await wixData.query(HH_MEMBERS).eq('email', email).find(HH_DB);
    const mem = mr.items[0];
    if (!mem) {
      return ok({ headers: CORS, body: { ok: false, error: 'Signed in, but this account isn\'t part of a household yet. Switch to “Create a new household” or “Join an existing household” above.' } });
    }

    const hhItem = await wixData.get(HH_HOUSEHOLDS, mem.householdId, HH_DB);
    const sess = await hhIssueSession(mem.memberId, email, mem.householdId);

    return ok({ headers: CORS, body: {
      ok: true, token: sess.token, email,
      householdId: mem.householdId, joinCode: hhItem ? hhItem.joinCode : null,
      updatedAt: hhItem ? hhItem.updatedAt : null
    }});
  } catch (err) {
    return serverError({ headers: CORS, body: { ok: false, error: String(err && err.message ? err.message : err) } });
  }
}

// POST /_functions/syncSave  {token, stateJson}
export async function post_syncSave(request) {
  try {
    const body = await request.body.json();
    const s = await hhSessionFor(body.token);
    if (!s) return ok({ headers: CORS, body: { ok: false, error: 'Session expired — sign in again.' } });
    if (typeof body.stateJson !== 'string') {
      return ok({ headers: CORS, body: { ok: false, error: 'stateJson must be a string.' } });
    }

    const hh = await wixData.get(HH_HOUSEHOLDS, s.householdId, HH_DB);
    if (!hh) return ok({ headers: CORS, body: { ok: false, error: 'Household not found.' } });

    hh.stateJson = body.stateJson;
    hh.updatedAt = new Date();
    hh.updatedByEmail = s.email;
    await wixData.update(HH_HOUSEHOLDS, hh, HH_DB);

    return ok({ headers: CORS, body: { ok: true, updatedAt: hh.updatedAt, updatedByEmail: s.email } });
  } catch (err) {
    return serverError({ headers: CORS, body: { ok: false, error: String(err && err.message ? err.message : err) } });
  }
}

// GET /_functions/syncLoad?token=...
export async function get_syncLoad(request) {
  try {
    const token = request.query && request.query.token;
    const s = await hhSessionFor(token);
    if (!s) return ok({ headers: CORS, body: { ok: false, error: 'Session expired — sign in again.' } });

    const hh = await wixData.get(HH_HOUSEHOLDS, s.householdId, HH_DB);
    if (!hh) return ok({ headers: CORS, body: { ok: false, error: 'Household not found.' } });

    return ok({ headers: CORS, body: {
      ok: true,
      stateJson: hh.stateJson || '',
      updatedAt: hh.updatedAt || null,
      updatedByEmail: hh.updatedByEmail || null,
      joinCode: hh.joinCode || null,
      email: s.email
    }});
  } catch (err) {
    return serverError({ headers: CORS, body: { ok: false, error: String(err && err.message ? err.message : err) } });
  }
}
