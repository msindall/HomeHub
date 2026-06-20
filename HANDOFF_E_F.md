# Handoff Prompt — Home Hub Fixes E & F

_Paste the block below into a new chat session in the Home Planner project to pick up the two larger refactors. Everything the next session needs is included._

---

## PROMPT TO PASTE

I'm continuing maintenance on the Home Hub app (single-file HTML household app, see `CLAUDE.md` — follow its editing protocol exactly: all edits to existing `.js/.html/.css` via `mcp__Desktop_Commander__edit_block`, run everything natively on Windows via Desktop Commander, never the Linux sandbox, `node --check` after every edit, build with `python build.py`).

A prior session already fixed the build/deploy workflow (self-validating build, auto-prune, `deploy.bat`, git-index repair) — see `MAINTENANCE_PLAN.md` for the full audit. Two structural items were deferred to now: **Fix E** and **Fix F**. Please implement them, one at a time, with verification after each.

### Fix E — De-hardcode "Matt"/"Holly" from the data model
**Problem:** ~673 occurrences of literal `mattX` / `hollyX` identifiers are baked into the **state schema and tax logic**, violating the project's own rule that names come from `state.members`. This makes renaming a person or adding a third member a multi-hundred-line change.

**Scope (data keys, NOT just UI labels):**
- `01-core.js` — `defaultState()` and the migration block: `house.fhsa.{mattBalance,hollyBalance,mattYearStart,hollyYearStart}`, `house.hbp.{mattEligible,hollyEligible,mattUsed,hollyUsed}`.
- `05-household.js` — the tax-prep page: `taxData.matt*` / `taxData.holly*` keys (e.g. `mattEmployment`, `mattPensionAdj`, `mattRrspRoom`, `mattCpp`, `hollyEmployment`, etc.) and the matching `getElementById('tax-matt-…')` / `tax-holly-…` form IDs in the page + modal HTML.

**Approach to confirm with me before coding:** migrate to a member-indexed shape (e.g. `fhsa.balances[memberId]`, `taxData.byMember[memberId]`) keyed off `state.members[].id`. **Critical:** add a migration guard that maps the existing `matt*`/`holly*` saved data onto the right member (first member with `hasPension || incomeType==='salary'` = Matt's data; first tipped/waged member = Holly's) so current saved state still loads with no data loss. Keep the Ontario tax math unchanged — only the key shape changes.

Please start by reading the relevant sections and giving me a concrete migration plan + the member-matching rule before editing.

### Fix F — Centralize tax constants
**Problem:** tax brackets, OAS clawback threshold (`~$90,997 (2024)` string), CPP/EI maximums, RRSP/FHSA limits are hardcoded inline across `05-household.js`, so the annual CRA update is a string hunt.

**Do:** pull them into a single `TAX_CONSTANTS_2026` object at the top of `05-household.js`, tagged with the tax year, and point `calcOntarioTax()`, `estimateCPP()`, `oasAtAge()`, and the tax-alert deadline strings at it. **Verify each value against current CRA/Ontario figures before writing it** (don't copy the possibly-stale inline numbers blindly). While in `07-upload.js`, also dedupe the three parser helpers (`cleanField`, `parseLine`, `toAmt`) that are each defined twice — one shared copy each.

### After each fix
Run `node --check` on every touched file, confirm line counts didn't drop, then `python build.py` (it now validates + prunes automatically) and sanity-check in the browser. Don't push/deploy unless I ask — I'll run `deploy.bat` myself.

---
```
