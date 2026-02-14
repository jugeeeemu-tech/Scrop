---
name: commit
description: Plan and execute atomic Conventional Commits from staged and unstaged changes. Use when the user asks to create commits, split a large change into logical commits, improve commit messages, or produce git-cliff friendly history.
---

# Commit

## Goal

Create clean commit history with one logical change per commit.

## Workflow

1. Inspect all current changes before staging anything.
- Run `git status --short`, `git diff --stat`, `git diff --cached --stat`, and `git log --oneline -5`.
- Identify staged and unstaged scope.

2. Group files into atomic logical units.
- Keep each commit focused on one feature, fix, refactor, or chore.
- Split unrelated file groups into separate commits.

3. Present a commit plan and wait for approval.
- Use this format:

```text
## Commit Plan

### Commit 1: fix(scope): concise subject
Files:
- path/to/file1
- path/to/file2

### Commit 2: test(scope): concise subject
Files:
- path/to/test-file
```

4. Execute after explicit user approval.
- If regrouping is needed, run `git reset HEAD` to unstage first.
- For each planned commit, run `git add <files>` then `git commit -m "<message>"`.
- Use non-interactive git commands only.

5. Verify final state.
- Run `git log --oneline -n <N>` and `git status --short`.
- Report created commits and remaining changes.

## Conventional Commit Rules

- Format: `<type>(<scope>): <subject>`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Write subject in imperative mood, lowercase start, no trailing period, max 50 chars
- Add body only when it clarifies why the change exists
- Add footer for issue links or breaking changes when needed

Breaking change format:

```text
feat(api)!: change auth model

BREAKING CHANGE: describe migration impact
```

## Guardrails

- Never stage unrelated files to "make it pass."
- Never amend, rebase, or force-push unless the user explicitly requests it.
- Stop and ask if file grouping is ambiguous.
