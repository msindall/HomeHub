---
name: meal-plan
description: Generate a 7-day household meal plan and grocery shopping list from a Home Hub data export. Reads loaded flyer sale items, pantry stock, diet preferences, meal ratings, and each member's work calendar to plan breakfast/lunch/dinner for the week and list only what needs buying. Use when the user says "meal plan", "plan our meals", "what should we eat this week", or "weekly menu".
---

# Meal Plan

Generates the same weekly meal plan the Home Hub app produces, but run from Claude directly — no API key or browser needed. It reads a Home Hub data export and writes a readable plan plus an app-compatible JSON file.

This is a **resync skill**: run it each week (ideally after importing fresh grocery flyers) to refresh the plan.

## What you need from the user

A Home Hub data export (the **Export Data** button in the app → a `.json` file containing the full `state` object). If the user hasn't provided one, ask them to export and share it, or point Claude at the most recent `*.json` export in the Home Planner folder.

If no export is available, you can still generate a plan by asking the user for: who's in the household, any allergies/diet styles, and roughly what's on sale — but the export is strongly preferred because it captures everything automatically.

## Inputs read from the export (state object)

| Key | Used for |
|---|---|
| `members` | `[{id, name}]` — who gets a breakfast/lunch each day. Per-person meal keys use the lowercased first-letter name (e.g. `matt`, `holly`). |
| `children` | `[{name, dob}]` — adds kid-friendly options; stage derived from age. |
| `flyers` | `[{store, validTo, items:[{name, price, category, unit}]}]` — sale catalogue. **Skip flyers whose `validTo` is before today.** Use the cheapest store when the same item appears in several flyers. |
| `pantry` | `[{name}]` — already-owned items; never put these in `toBuy`. |
| `dietPrefs` | `{avoid, favourites, dietStyle[], complexity, notes}` |
| `mealRatings` | `{meal: stars}` — meals rated ≥4 are "loved, re-use"; ≤2 are "disliked, avoid". |
| `lifestyle` | `{allergies, memberDiets:{memberId:[...]}}` |
| `calEvents` | `[{date, title, person, start, end, allDay}]` — used to find each member's **work shifts** (see schedule rules). |
| `lockedMeals` + `mealPlan` | If a day is locked (`lockedMeals[day]===true`), keep that day's existing meal exactly as in the previous `mealPlan`. |

### Deriving work schedules from the calendar

For the next 7 days, scan `calEvents` for **work shifts** — events whose title contains any of: work, shift, office, on shift, opening, closing, morning/afternoon/evening/breakfast/lunch/dinner shift, am/pm shift, early/late shift, on duty. Match each event's `person` to a member by name. Parse `start`/`end` times and classify:

- start ≤ 9:00 → **at work for breakfast** → that person gets a grab-and-go breakfast.
- start ≤ 13:00 and (no end or end ≥ 12:00) → **at work for lunch** → packed/portable lunch.
- end ≥ 17:00 → **at work for dinner** → dinner is late/solo, use a quick or make-ahead option.
- No matching work event that day → **day off** → plan a proper sit-down meal.

## Planning window

Plan 7 days starting today. **If it's already 7pm or later, start tomorrow instead.** Use real weekday names (Monday–Sunday) for the keys, in the actual order of the next 7 days.

## Rules (apply exactly)

- Every person must have a breakfast AND a lunch entry every single day — never empty, null, or omitted. On early-work days use quick options like "Grab-and-go: granola bar & coffee", but always fill the field.
- Draw ingredients from **all** active flyers, not just one store; use the cheapest option when an item repeats.
- Match meals to work schedules (early start → quick breakfast + packed lunch; late finish → quick dinner).
- Dinner is always eaten together, under 40 minutes unless slow-cooker.
- Never repeat the same protein two nights in a row.
- Use pantry items first; only list genuinely needed items in `toBuy`.
- `toBuy` must cover all of that day's meals not already in the pantry, one item per entry.
- Honour allergies/restrictions and each member's diet. Respect `dietPrefs.avoid` absolutely.
- Estimate a realistic daily cost in CAD for the whole household. Assume Ontario, Canada.

## Output

Produce **two files** in the working/Home Planner folder:

1. `meal_plan_<YYYY-MM-DD>.md` — a friendly, readable week: each day's breakfasts (per person), lunches (per person), dinner with prep/cook time and estimated cost, followed by a **consolidated shopping list** grouped by store with prices and a weekly total.

2. `meal_plan_<YYYY-MM-DD>.json` — app-compatible, so it can be pasted/imported back into Home Hub later. Shape:

```json
{
  "mealPlan": {
    "Monday": {
      "<mk1>Breakfast": "Oatmeal with berries",
      "<mk2>Breakfast": "Greek yogurt & granola",
      "<mk1>Lunch": "Turkey sandwich",
      "<mk2>Lunch": "Caesar salad wrap",
      "dinner": "Chicken stir-fry",
      "estimatedCost": "~$18",
      "dinnerTag": "quick",
      "recipe": {
        "prepTime": "10 min",
        "cookTime": "25 min",
        "servings": "2",
        "ingredients": ["2 chicken breasts", "1 cup rice"],
        "steps": ["Cook rice", "Stir-fry chicken"]
      },
      "toBuy": [
        {"item": "chicken breast", "qty": "500g", "store": "FoodBasics", "price": 4.99},
        {"item": "sandwich bread", "qty": "1 loaf", "store": "Any", "price": null}
      ]
    }
  }
}
```

Key rules for the JSON:
- Replace `<mk1>`/`<mk2>` with the real lowercased-first-letter member names (e.g. `mattBreakfast`, `hollyLunch`). One pair of keys per member.
- `dinnerTag` is one of: `quick | slow-cooker | make-ahead | special | normal`.
- `price` is a number or `null`.
- Keys are real weekday names for the 7-day window.

## Consolidated shopping list

Build the shopping list from every day's `toBuy` (fall back to recipe ingredients if a day has no `toBuy`). Merge duplicate items (case-insensitive), keep the cheapest store/price seen, and group by store. This mirrors the app's `generateShoppingListFromPlan`.

## After generating

Offer to schedule a weekly run (e.g. Sunday morning) so the plan refreshes automatically, and remind the user that fresher flyers = better sale matching.
