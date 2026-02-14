---
name: release
description: Prepare and publish Scrop GitHub releases end-to-end for scrop-server. Use when the user asks to choose the next version from commit history, update release versions and changelog, build release assets, create release commits and tags, open a draft GitHub Release, and publish it safely.
---

# Release

## Goal

Run a full release workflow for `scrop-server`:
1. Analyze commits since the latest release tag.
2. Recommend SemVer bump (`patch`, `minor`, `major`).
3. Let the user choose the final version.
4. Update project versions and release docs.
5. Build and package release assets.
6. Create release commit, tag, and draft release.
7. Publish after explicit confirmation.

## Scope

- Target repository: Scrop.
- Target artifact: `scrop-server-vX.Y.Z-linux-x86_64.tar.gz` and matching `.sha256`.
- Update release metadata files and generated assets only.
- Do not touch feature code unrelated to release prep.

## Execution Mode

- Execute release workflow commands outside sandbox because DNS resolution can fail in sandbox in this environment.
- For release-critical terminal commands, set `sandbox_permissions="require_escalated"` proactively instead of waiting for failure.
- Network-sensitive commands include:
  - `git fetch`, `git ls-remote`, `git push`
  - `gh auth status`, `gh release view/create/edit`

## Workflow

1. Verify release prerequisites.
- Run `gh auth status`.
- Run `git remote get-url origin` and ensure it points to the Scrop repository.
- Run `git fetch --tags origin`.
- Ensure working tree is suitable for release prep with `git status --short`.

2. Resolve release diff range.
- Set target commit to `HEAD` unless the user specifies another commit.
- Find latest version tag: `base_tag=$(git tag --list --sort=-v:refname 'v*' | head -n1)`.
- Stop and ask the user for explicit bootstrap versioning if no `v*` tags exist.
- Compute range: `"${base_tag}..${target_commit}"`.

3. Classify commit history and recommend SemVer bump.
- Read commits from the range with `git log --format='%s%n%b' "${base_tag}..${target_commit}"`.
- Determine highest bump:
  - `major` if any commit subject has `!` before `:` (example `feat!:`) or body contains `BREAKING CHANGE`.
  - else `minor` if any subject starts with `feat`.
  - else `patch`.
- If range is empty, recommend not releasing.
- Build candidates from `base_tag=vA.B.C`:
  - patch: `vA.B.(C+1)`
  - minor: `vA.(B+1).0`
  - major: `v(A+1).0.0`
- Present the three candidates and mark the recommended one.
- Collect the user decision with `request_user_input` when available; otherwise ask directly in chat.

4. Prepare release version.
- Require final tag format `vX.Y.Z`.
- Derive `version=X.Y.Z`.
- Update version fields:
  - `scrop-server/Cargo.toml`
  - `scrop-capture/Cargo.toml`
  - `src-tauri/Cargo.toml`
  - `package.json` (`npm version --no-git-tag-version "$version"` is acceptable)
- Update README release references to the new tag and filenames.
- Regenerate changelog with target tag:
  - `git-cliff --tag "${tag}" -o CHANGELOG.md`
- Verify `CHANGELOG.md` now contains `## [X.Y.Z] - YYYY-MM-DD`.

5. Build and package assets.
- Run `npm run build:server`.
- Build artifact package:
  - `asset="scrop-server-${tag}-linux-x86_64.tar.gz"`
  - `tar -czf "${asset}" -C target/release scrop-server`
- Build checksum:
  - `sha256sum "${asset}" > "${asset}.sha256"`
- Verify checksum:
  - `sha256sum -c "${asset}.sha256"`

6. Validate release state before tag and release creation.
- Validate version consistency across manifests (`X.Y.Z`):
  - `scrop-server/Cargo.toml`
  - `scrop-capture/Cargo.toml`
  - `src-tauri/Cargo.toml`
  - `package.json`
- Validate changelog section and extract notes for release body.
- Abort if local tag already exists: `git rev-parse -q --verify "refs/tags/${tag}"`.
- Abort if remote tag already exists: `git ls-remote --tags origin "refs/tags/${tag}"`.
- Abort if release already exists: `gh release view "${tag}"`.
- Ensure expected release files exist:
  - `scrop-server-${tag}-linux-x86_64.tar.gz`
  - `scrop-server-${tag}-linux-x86_64.tar.gz.sha256`

7. Commit release preparation changes.
- Stage release-related file updates.
- Commit with Conventional Commit message:
  - `git commit -m "chore(release): prepare ${tag}"`

8. Create draft release.
- Push release prep commit:
  - `git push origin HEAD`
- Create annotated tag: `git tag -a "${tag}" -m "release: ${tag}"`.
- Push tag: `git push origin "${tag}"`.
- Create draft release:
  - `gh release create "${tag}" "scrop-server-${tag}-linux-x86_64.tar.gz" "scrop-server-${tag}-linux-x86_64.tar.gz.sha256" --draft --title "${tag}" --notes-file "${notes_file}"`
- Confirm draft content with `gh release view "${tag}"`.

9. Publish only after explicit confirmation.
- Ask user confirmation after showing draft summary.
- Publish by flipping draft flag:
  - `gh release edit "${tag}" --draft=false`

## Changelog Extraction Example

Use this extraction pattern after choosing `version="X.Y.Z"` and regenerating changelog:

```bash
notes_file="/tmp/release-notes-v${version}.md"
awk -v v="$version" '
  $0 ~ "^## \\[" v "\\] - " { in_section=1 }
  in_section && /^## \[/ && $0 !~ "^## \\[" v "\\] - " { exit }
  in_section { print }
' CHANGELOG.md > "$notes_file"
test -s "$notes_file"
```

## Guardrails

- Use draft-first flow every time.
- Use changelog section as release body; do not switch to auto-generated notes unless explicitly requested.
- Stop immediately on version mismatch, missing changelog section, missing assets, or existing tag/release conflicts.
- Abort if release prep changes include unrelated feature code.
- Do not delete or overwrite tags/releases unless the user explicitly requests destructive recovery steps.

## Validation Scenarios

1. Trigger on requests like "release to GitHub", "publish vX.Y.Z", or "$release".
2. Recommend `patch` when range has no `feat` and no breaking markers.
3. Recommend `minor` when range includes `feat` and no breaking markers.
4. Recommend `major` when `BREAKING CHANGE` or `!` marker is present.
5. Update all manifest versions and verify they match selected `X.Y.Z`.
6. Regenerate changelog and verify `CHANGELOG.md` includes `## [X.Y.Z]`.
7. Build tarball and checksum with tag-specific filenames.
8. Refuse new release creation when tag or release already exists.
