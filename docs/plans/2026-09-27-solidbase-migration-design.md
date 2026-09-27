# SolidBase Migration — Design

Date: 2026-09-27
Status: Approved (styling amendment: Tailwind)

## Goal

Convert the fumadocs (React / TanStack Start) site to SolidBase (SolidJS), keeping full feature parity: index page, Daily Special Calculator, Hero Shard Calculator.

## Approach

Replace-in-place on an isolated branch: worktree `.worktrees/solidbase-migration`, branch `solidbase-migration`. Main stays untouched until the branch is green and merged.

## Steps

1. **Prep**: gitignore `.worktrees/` (commit on main) → create worktree + branch
2. **Scaffold**: `bun create solid@latest <name> -s -t with-solidbase` into `/tmp/opencode`, move contents to worktree root (old `src/`, `content/`, root configs deleted; `docs/`, `.gitignore` skeleton kept), `bun install`, dev smoke test, commit
3. **Tailwind**: ensure Tailwind is wired (template's setup, else add `@tailwindcss/vite`); calculators styled with Tailwind utility classes, using solidbase CSS vars where handy — no `fd-*` classes
4. **Port libs unchanged**: the three pure-TS libs + test files; `bun test` must stay 26/26
5. **Rewrite calculators in Solid**: `useState` → `createSignal`, same UI structure/logic
6. **Port content**: index + both calculator MDX pages; register `<DailySpecialCalculator />` / `<HeroShardCalculator />` through solidbase's MDX component mechanism; map/drop fumadocs-only features (`Cards`, icon frontmatter) to solidbase equivalents
7. **Verify**: bun test, scaffold's typecheck/lint scripts, SSR check of all three routes
8. **Finish**: merge via finishing-a-development-branch

## Discover-at-scaffold

SolidBase MDX component registration API, theme CSS variables, frontmatter/icon support, route + TOC conventions — resolved from generated files, not guessed.

## Out of scope

Design/visual redesign beyond framework equivalence; content wording changes.
