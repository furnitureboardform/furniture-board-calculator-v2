Run the simplify skill first to review changed code, fix any issues found, then commit and push.

Steps:
1. Run `git status` and `git diff` to see what changed.
2. Run the `simplify` skill on the changed files — review for code quality, reuse, and efficiency. Fix any issues found before proceeding.
3. Re-run `git diff` after fixes to confirm the final state of changes.
4. Run `git log --oneline -5` to match the commit message style.
5. Stage only relevant changed files (never .env or credentials).
6. Write a commit message following this project's convention:
   - Format: `<type>: <short description in English, imperative mood>`
   - Types: `feat` (new feature), `fix` (bug fix), `refactor` (restructure without behavior change), `docs`, `chore`
   - Subject line: max ~72 chars, lowercase after the colon, no period at the end
   - No body or footer needed for simple changes
   - Examples from this repo:
     - `feat: add plinth support for boxkuchenny and fix rotation-aware positioning`
     - `fix: correct front panel position and width for rotated boxkuchenny`
     - `refactor: unify counters, dedupe PANEL_T, add architecture docs`
   - Never add `Co-Authored-By` or any AI attribution
7. Run `npx tsc --noEmit` to check for TypeScript errors. Fix any errors before proceeding.
8. Commit using a HEREDOC so formatting is correct.
9. Push to the current branch with `git push`.

If $ARGUMENTS is provided, use it as the commit message instead of auto-generating one.
