# PR Quality Report Demo

Disposable GitHub Actions demo for the subtler `pull_request_target` cache-poisoning pattern:

1. A fork PR runs code in a target-repository workflow.
2. The fork code patches a real installed npm package in `node_modules`.
3. `actions/cache` persists the modified `node_modules`.
4. A later trusted release workflow restores that cache.
5. The release workflow executes the patched package with `contents: write`.
6. The patched package attempts to commit `hehe.txt` to `main` using the trusted workflow's checkout credentials.

This is closer to the Mini Shai-Hulud / TanStack shape than a demo that simply passes a secret directly into `npm install`. This version does not need a fake secret.

## Base repository setup

Create a new public repository from this directory.

Do not add real tokens, cloud credentials, npm credentials, database URLs, Docker credentials, or production secrets.

Push the repository:

```bash
git remote add origin git@github.com:YOUR_ACCOUNT/YOUR_REPO.git
git push -u origin main
```

## Real package used in the demo

The base project depends on the real npm package:

```json
{
  "dependencies": {
    "left-pad": "1.3.0"
  }
}
```

The release workflow runs:

```bash
npm run release:notes
```

That script imports and calls `left-pad`. If `node_modules/left-pad/index.js` has been poisoned through cache, the release script executes the modified package code.

## Workflows in the base repository

### `.github/workflows/pr-ci.yml`

Normal PR CI:

- trigger: `pull_request`
- checks out PR code
- runs `npm install`

This is the normal lower-authority place to run PR code.

### `.github/workflows/pr-quality-report.yml`

Realistic-looking mistake:

- trigger: `pull_request_target`
- checks out fork PR code
- restores/saves `node_modules` with key `node-modules-left-pad-v1`
- runs `npm install`

The mistake is that fork PR code can modify dependency state in `node_modules`, and the target-repository workflow can save that state into a cache key later used by the release workflow.

### `.github/workflows/release-report.yml`

Trusted release/report workflow:

- trigger: manual `workflow_dispatch`
- permission: `contents: write`
- restores `node_modules` with key `node-modules-left-pad-v1`
- runs `npm run release:notes`
- does not contain a marker-commit step

This simulates a trusted release job consuming cached dependency state that was written by an untrusted PR path.

## Fork-side reproduction

From a separate GitHub account:

```bash
git clone git@github.com:FORK_OWNER/YOUR_REPO.git
cd YOUR_REPO
git switch -c useful-fix
node scripts/write-attacker-payload.mjs
git add package.json scripts/attacker-postinstall.mjs
git commit -m "Improve project setup"
git push origin useful-fix
```

Open a pull request from the fork back to the base repository.

## What the fork changes

The fork does not edit the workflow.

It changes normal project files:

- `package.json`
- `scripts/attacker-postinstall.mjs`

The generated `postinstall` runs after dependencies install. It patches:

```text
node_modules/left-pad/index.js
```

The patched `left-pad` still returns padded strings, but it also writes proof when the release workflow later imports it:

- `.poc-proof/release-proof.json`
- `hehe.txt`

It then tries to commit and push only `hehe.txt` back to the same repository. No secret values are printed and there is no external exfiltration endpoint.

## Expected first result: PR workflows

The normal PR workflow should show something like:

```json
{
  "eventName": "pull_request",
  "packagePatched": "left-pad",
  "patchedFile": "node_modules/left-pad/index.js"
}
```

The PR quality report workflow should show:

```json
{
  "eventName": "pull_request_target",
  "packagePatched": "left-pad",
  "patchedFile": "node_modules/left-pad/index.js"
}
```

The important part is that the target workflow did not need a secret in the install step. It only needed to let fork code modify cached dependency state.

## Expected second result: release workflow

After the PR quality report workflow completes, run this manually in the base repository:

```text
Actions -> Release Report -> Run workflow
```

If the cache was saved and restored, the release workflow should execute the patched `left-pad` package and show:

```json
{
  "message": "Patched npm package executed inside trusted release workflow.",
  "package": "left-pad",
  "eventName": "workflow_dispatch",
  "contentsWriteDemo": true,
  "markerFile": "hehe.txt",
  "gitPushAttempted": true,
  "gitPushSucceeded": true
}
```

The release workflow itself does not have a commit step. If branch protection allows the workflow token to push, the patched package code should create the marker commit. If branch protection blocks the push, the release proof artifact should show the git error.

That is the trust-boundary failure:

> The PR workflow planted modified dependency state. The trusted workflow later restored and executed that state with repository write authority.

## If the release workflow misses the cache

GitHub Actions caches are immutable. If the cache key already exists from an earlier clean run, the PR cannot overwrite it.

For repeated demos, bump this key in both workflows:

```text
node-modules-left-pad-v1
```

For example:

```text
node-modules-left-pad-v2
```

Then open a fresh fork PR.

## Why this resembles the Mini Shai-Hulud class

The direct beginner demo is:

```yaml
on: pull_request_target
steps:
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.pull_request.head.sha }}
  - run: npm install
```

That is obvious once you know the rule.

The subtler chain is:

```text
fork PR code -> target workflow execution -> poisoned dependency cache -> trusted release restore -> release authority available
```

This repo demonstrates that chain with a real npm package (`left-pad`), cached `node_modules`, and a harmless same-repository `hehe.txt` marker commit attempted by the cached package code.

## Safety boundaries

- Do not add real credentials.
- The payload does not print secret values.
- The payload does not call an external collection endpoint.
- The payload writes only `.poc-proof/`, patches `node_modules/left-pad/index.js`, creates `hehe.txt`, and attempts a same-repository `git push` during the release workflow.

## Local simulator

The `poc/` directory contains the earlier explicit simulator:

```bash
cd poc
npm run poc:safe-target
npm run poc:pr-ci
npm run poc:vulnerable
```

Use that when you want the simpler first-principles version before showing the dependency-cache demo.
