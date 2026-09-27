# Top Heroes Fan Site (Astro) — Design

Date: 2026-09-27
Status: Approved

## Goal

Rebuild Top Heroes as a fan site with full design freedom: Astro (static) + MDX + Pagefind search, interactive calculators as Solid islands. Replaces the fumadocs app; supersedes the abandoned SolidBase spike (worktree removed; Solid calculator components preserved and reused).

## Stack

- Astro (static output), `@astrojs/mdx`, `@astrojs/solid`, Tailwind v4
- Pagefind for search (`pagefind --site dist` post-build, search page uses Pagefind browser UI; indexes built output only)
- `bun test` — calculator libs + tests port unchanged (26/26 gate)

## Structure

```
src/
  pages/index.astro                    — free-design home
  pages/daily-special-calculator.mdx   — content + Solid island (client:load)
  pages/hero-shard-calculator.mdx      — content + Solid island (client:load)
  pages/search.astro                   — Pagefind UI
  components/                          — Solid islands (from solidbase worktree)
  layouts/Base.astro                   — custom nav/footer, no docs chrome
  styles/global.css                    — Tailwind
```

## Port plan

1. Scaffold `bun create astro@latest` (minimal + solid,mdx,tailwind) into worktree `.worktrees/astro-fansite` (branch off main, replace-in-place as before)
2. Libs + tests unchanged → 26/26
3. Solid components: import path tweaks only
4. Content MDX reused; pages get free-form layouts
5. Pagefind: dev dep + `postbuild` script + search page
6. Verify: tests, `astro check` (if typescript), `astro build` + pagefind index, preview smoke test
7. Merge decision via finishing-a-development-branch

## Out of scope

Visual design beyond a clean baseline (iterate later), analytics, i18n.
