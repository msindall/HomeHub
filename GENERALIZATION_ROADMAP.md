# Home Hub — Generalization Roadmap

Goal: make the app usable by **anybody, anywhere**. Everything driven by the people and region entered in setup — no hardcoded names, no assumed Canada/Ontario. Region-specific calculators are **hidden** when the user's region isn't supported (rather than showing wrong numbers).

Scope confirmed: **Full international** + **hide unsupported calculators**.

---

## The two problems

1. **People are hardcoded.** The tax page is built for exactly two people, with names baked into DOM element IDs (`tax-matt-employment`, `tax-holly-employment`, etc.) and ~229 `matt`/`holly` references in `05-household.js`. The app already has a flexible `state.members` array — the tax/retirement pages just don't use it.
2. **Region is hardcoded.** Ontario tax brackets, CPP/OAS, Land Transfer Tax, CMHC, RRSP, semi-annual mortgage compounding — ~270 Canada references across `04-planning.js`, `05-household.js`, `01-core.js`, `06-insights.js`, `07-upload.js`.

---

## Phased plan (each phase builds + tests independently)

### Phase 1 — Region & currency foundation
- Add `state.region` (country + sub-region) and `state.currency` to `defaultState()` + migration guard (existing users default to Canada/Ontario/CAD, so nothing breaks).
- Add a region/currency step to the setup wizard.
- Make `fmt()`/`fmtC()`/`fmtSigned()` currency-symbol aware instead of hardcoded `$`.
- Introduce a `regionSupports(feature)` helper — the single switch that later hides unsupported calculators.

### Phase 2 — De-hardcode people (tax page rebuild)
- Rebuild the Ontario tax-prep page to loop over `state.members` instead of fixed Matt/Holly fields. Generate inputs per member dynamically.
- Replace `getHollyTips*` with member-driven equivalents keyed on the member with `hasTips`.
- Remove name assumptions from retirement projector (CPP/OAS per member).
- This is the largest single phase — touches most of `05-household.js`.

### Phase 3 — Pluggable tax/financial engines
- Refactor `calcOntarioTax`, `estimateCPP`, `oasAtAge`, `calcOntarioLTT`, `calcCMHC`, mortgage compounding into a region-keyed registry (e.g. `engines.CA.incomeTax(...)`).
- Default registry ships with the existing Canada engine intact.
- `regionSupports()` returns true only for regions with an engine present.

### Phase 4 — Hide unsupported calculators
- Wherever a region-specific calculator renders (tax prep, LTT, CMHC, CPP/OAS retirement), gate the section on `regionSupports(...)`.
- Show a friendly "not yet available for your region" placeholder + a generic note instead of wrong math.

### Phase 5 — Add a second region (proof it works)
- Implement one more country's income-tax + mortgage engine (e.g. US or UK) to validate the architecture end-to-end.

---

## Guardrails (from CLAUDE.md)
- Edit source files with surgical find-and-replace only; never overwrite (truncation risk).
- `node --check` after every edit; watch line counts.
- All git/build/deploy run natively on Windows, never the Linux sandbox.
- Existing Canada/Ontario users must keep working unchanged — every new state key needs a migration default.
- `python build.py` after edits; build is gitignored, force-add the `App_VX_Y.html`.

---

## Recommended starting point
Phase 1 is low-risk, self-contained, and unlocks everything else. Suggest doing Phase 1 first, building, and you test it before we move to the bigger Phase 2 rebuild.
