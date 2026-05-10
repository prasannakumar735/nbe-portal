# Cursor rules — authoring guide (NBE Portal)

Use this when adding or editing `.cursor/rules/*.mdc` files.

## When to use `alwaysApply: true`

Use **sparingly** — these inject into **every** Agent chat and slow responses.

**Good candidates:**

- Short, stable **architecture** constraints that prevent entire classes of bugs (auth lifecycle, framing/security defaults, Strict Mode async rules).
- Boundaries that almost every change could violate if forgotten.

**Poor candidates:**

- Feature copy, component layout details, one-off bug retrospectives, long bulleted UX specs, or anything tied to a folder tree.

**Rule of thumb:** if a rule is longer than ~60 lines or only matters when touching certain paths, **do not** make it global — scope it with `globs`.

## When to use `globs`

Set `alwaysApply: false` and add **specific** path patterns:

- Prefer directory globs: `"app/client/**"`, `"components/quotes/**"`.
- Add **`lib/...`** when shared logic belongs to the same feature.
- Avoid overly broad globs like `"**/*.tsx"` — they recreate global behaviour.

Multiple rules may match one file; keep overlaps **small** and **non-contradictory**.

## What should **not** become a rule

- Chat summaries, ticket narratives, or “we fixed bug X on date Y” notes → use git history or `docs/`.
- Duplicates of README / existing docs → link from a short rule instead of pasting.
- Volatile implementation steps (“step 3 run this SQL”) → migrations + code.
- Large slabs of marketing copy → keep in components or a content module; rules should summarize **patterns**, not full prose.

## Keeping rules token-efficient

1. **Bullet + imperative** (“Use X for Y”) over long explanation.
2. **One home per topic** — merge fragments; cross-reference filenames instead of repeating paragraphs.
3. **Archive or delete** rules when the codebase no longer matches; stale rules harm agents more than no rule.
4. **Prefer five consolidated scoped rules** over many tiny always-on files.

## Checklist before merging

- [ ] Could this be scoped with `globs` instead of global?
- [ ] Does another `.mdc` already say this? → Merge or delete duplicate.
- [ ] Under ~40 lines per major section? → Split by domain or scope paths tighter.
- [ ] Still true on `main`? → Remove obsolete migrations/setup notes where possible.
