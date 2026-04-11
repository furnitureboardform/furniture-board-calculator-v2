# Project: Furniture Board Calculator v2

React + TypeScript app for calculating furniture board cuts and generating order reports.

## Stack
- React 18, TypeScript, Vite
- Key files: `src/types.ts`, `src/App.tsx`, `src/builders.ts`, `src/computeElements.ts`

## Response Rules (follow strictly to minimize token usage)

1. **Be terse** — one sentence max per idea. No preamble, no trailing summaries.
2. **No restating the user's request** — jump straight to the solution.
3. **Read before editing** — always read a file before modifying it.
4. **Edit, don't rewrite** — use Edit tool for targeted changes; Write only for new files.
5. **No unsolicited improvements** — fix only what was asked; no cleanup, no extra comments.
6. **No docstrings or type annotations** on untouched code.
7. **No error handling for impossible scenarios** — trust React/TS guarantees.
8. **Parallel tool calls** — run independent reads/searches simultaneously.
9. **Skip confirmations for local reversible edits** — just do it.
10. **Polish language** — respond in Polish unless code/commands require English.
11. **No Co-Authored-By** — never add `Co-Authored-By: Claude` or any Claude/Anthropic attribution to commit messages.
12. **Code review before commit/push** — before every `git commit` or `git push`, run the `simplify` skill to review changed code for quality issues, then fix any found problems before proceeding.

## Build Errors Policy
- **Unused variables** — delete them; never suppress with eslint-disable or prefix with `_`.
- **Verify usage before finishing** — after every edit, scan all newly introduced variables (including destructured ones) and confirm each is referenced. If not used, remove it before calling the edit done.
- Fix only the reported lines; don't touch surrounding code.

## Code Conventions
- Components in `src/` with matching `.css` files
- Types defined in `src/types.ts`
- Business logic in `src/builders.ts`, `src/computeElements.ts`, `src/factories.ts`
