# Home Hub — Recurring Issues & Update-Efficiency Plan

_Scan date: 2026-06-20. Source files are clean (`node --check` passes on all 7 JS files; no `alert/confirm/prompt`; no orphaned static IDs). The problems below are about the **workflow around** the code, which is where update time is being lost._

---

## The recurring issues (ranked by how much they slow you down)

### 1. Git index keeps getting corrupted — #1 time sink
Right now the repo is in a broken state: `.git/index.lock` exists and **every file shows as staged-for-deletion**. This is the exact failure CLAUDE.md warns about — it happens whenever git or a build runs from the Linux sandbox instead of natively on Windows. Each time it happens, a commit/deploy stalls until the index is rebuilt by hand.

**Root cause:** the sandbox treats the folder as a network mount and can't write `.git` safely.

### 2. Build-artifact sprawl — 28 old builds, ~29 MB, one corrupt
The folder holds 28 `App_V6_*.html` builds plus two `V6_*.html` files. `App_V6_32.html` is **4 bytes** — a truncated/empty build that was never cleaned up. They're gitignored so they shouldn't be committed, but they clutter the working folder, slow file listings, and make "which one is live?" ambiguous.

### 3. `build.py` doesn't validate its own output — corrupt builds ship silently
The build script writes the file and reports size, but never runs `node --check` on the combined JS and never checks a minimum size. That's how the 4-byte `App_V6_32.html` got produced without anyone noticing. A truncated source file would sail straight through to a deployed app.

### 4. "Matt" and "Holly" are hardcoded into the data model — 673 occurrences
CLAUDE.md says names must come from `state.members`, but the **state schema and tax logic** use literal identifiers: `fhsa.mattBalance`, `hbp.hollyEligible`, `td.mattEmployment`, `mattCpp`, etc. UI labels are fine; the *data keys* are not. Consequences: renaming a person, or adding a third member, means touching hundreds of lines, and the tax page can't generalize.

### 5. The documented #1 corruption source has no automated guard
Truncation and the JS↔HTML ID contract are both "discipline only" right now — you have to remember to run `node --check` and `wc -l` after every edit. The contract is currently intact (good), but nothing *keeps* it intact. One forgotten check reintroduces the corruption the whole protocol exists to prevent.

### 6. Minor: duplicated parser helpers + hardcoded tax-year values
`cleanField`, `parseLine`, and `toAmt` are each defined twice inside `07-upload.js` (one copy per bank parser). And tax brackets / clawback thresholds (e.g. the OAS `~$90,997 (2024)` string, the bracket table in `05-household.js`) are hardcoded inline with no central constant, so the annual CRA update is a scavenger hunt.

---

## The fix plan (ordered: fastest payback first)

### Fix A — Make the build self-checking _(highest payback, ~20 min, one-time)_
Add three guards to the end of `build.py` so a bad build can never ship:
1. Run `node --check` on the combined JS before writing; abort on failure.
2. Assert the output is larger than a floor (e.g. 500 KB) — catches truncation/empties like V6_32.
3. Print a one-line PASS/FAIL summary.

This converts the manual "remember to verify" step into something automatic, and directly prevents issues #3 and #5.

### Fix B — One clean deploy script that runs natively _(~20 min, one-time)_
Wrap the whole flow into a single Windows command sequence (build → validate → deploy_github → git add/commit/push) that **only ever runs natively** via Desktop Commander, never the sandbox. Include the index-repair line from CLAUDE.md as a built-in pre-step so a corrupted index self-heals instead of blocking you. This kills issue #1 permanently.

### Fix C — Auto-prune old builds _(~10 min, one-time)_
Add a step to `build.py` (or the deploy script) that keeps only the latest 2–3 `App_V6_*.html` and deletes the rest, and removes any zero/tiny-byte build. Clears issue #2 and stops it recurring.

### Fix D — Repair the git index now _(~2 min, do first)_
Run the documented native repair so the repo is usable again:
```
cmd /c "cd /d D:\Claude\Home Planner && del /f .git\index.lock 2>nul & del /f .git\index 2>nul & git reset"
```
Then a normal `git add` / `commit`. (Must be done natively — the sandbox can't unlink the lock.)

### Fix E — De-hardcode names in the data model _(larger, do when you next touch tax/members)_
Migrate `mattX`/`hollyX` state keys to a member-indexed shape (e.g. `fhsa.balances[memberId]`, `taxData.byMember[memberId]`). Add a migration guard that maps the old keys onto the first salaried member (Matt) and first tipped member (Holly) so existing saved data still loads. This is the only structurally large item — schedule it on its own, not bundled with a quick edit.

### Fix F — Centralize tax constants _(~30 min, pairs well with the annual CRA update)_
Pull bracket tables, OAS clawback threshold, CPP/EI maximums, and RRSP/FHSA limits into a single `TAX_CONSTANTS_2026` object at the top of `05-household.js`, tagged with the tax year. Next year's update becomes editing one block instead of hunting strings. Also dedupe the three parser helpers into single shared functions while you're in `07-upload.js`.

---

## Suggested sequence
**Now:** D (repair index). **This session or next:** A, then B, then C — these three give you a build/deploy pipeline that validates itself, never corrupts git, and cleans up after itself, which is most of the "efficiency of updates" win. **Later, scheduled separately:** E and F.

I can implement A, B, C, and D for you in one pass — they're self-contained and low-risk. E and F change app behaviour, so I'd want to confirm scope before starting.
