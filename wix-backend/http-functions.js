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

// CORS so Home Hub (any origin / local file) can read the reply.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
