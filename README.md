# PR Quality Report Demo

Disposable GitHub Actions demo for the subtler `pull_request_target` failure mode:

1. A fork PR runs code in a target-repository workflow.
2. That run does not receive the fake release secret.
3. The fork code writes executable state into a shared cache.
4. A later trusted release workflow restores the cache and executes that state with the fake release secret present.

This is closer to the Mini Shai-Hulud / TanStack shape than a demo that simply passes a secret directly into `npm install`.

## Base repository setup

Create a new public repository from this directory and add one fake repository secret:

```text
POC_FAKE_SECRET=fake-secret-for-demo-only
```

Do not add real tokens, cloud credentials, npm credentials, database URLs, Docker credentials, or production secrets.

Push the repository:

```bash
git remote add origin git@github.com:YOUR_ACCOUNT/YOUR_REPO.git
git push -u origin main
```

## Workflows in the base repository

### `.github/workflows/pr-ci.yml`

Normal PR CI:

- trigger: `pull_request`
- checks out PR code
- runs `npm install`
- does not receive `POC_FAKE_SECRET`

This is the normal low-authority place to run PR code.

### `.github/workflows/pr-quality-report.yml`

Realistic-looking mistake:

- trigger: `pull_request_target`
- checks out fork PR code
- restores/saves `.ci-cache` with key `quality-report-tools-v1`
- runs `npm install`
- does not receive `POC_FAKE_SECRET`

The obvious direct secret leak is not present. The mistake is that fork PR code can write cached executable state from inside a target-repository workflow.

### `.github/workflows/release-report.yml`

Trusted release/report workflow:

- trigger: manual `workflow_dispatch`
- restores `.ci-cache` with key `quality-report-tools-v1`
- runs `.ci-cache/reporter.mjs` if it exists
- receives `POC_FAKE_SECRET`

This simulates a trusted release job consuming cache state that was written by an untrusted PR path.

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

The generated `postinstall` does two things:

1. Writes `.poc-proof/proof.json` showing it ran during the PR workflows.
2. Writes `.ci-cache/reporter.mjs`, which is meant to be restored and executed later by the release workflow.

No network requests are made. No secret values are printed.

## Expected first result: PR workflows

The normal PR workflow should show:

```json
{
  "eventName": "pull_request",
  "fakeSecretPresentDuringInstall": false,
  "cachedReporterWritten": true
}
```

The PR quality report workflow should show:

```json
{
  "eventName": "pull_request_target",
  "fakeSecretPresentDuringInstall": false,
  "cachedReporterWritten": true
}
```

The important part is that the target workflow did not need a secret in the install step. It only needed to let fork code write state into a cache that a later trusted workflow will use.

## Expected second result: release workflow

After the PR quality report workflow completes, run this manually in the base repository:

```text
Actions -> Release Report -> Run workflow
```

If the cache was saved and restored, the release workflow should execute the cached reporter and show:

```json
{
  "message": "Cached reporter executed inside trusted release workflow.",
  "eventName": "workflow_dispatch",
  "fakeSecretPresent": true,
  "releaseReportingTokenPresent": true
}
```

That is the more subtle trust-boundary failure:

> The PR workflow did not leak a secret directly. It planted executable state. The trusted workflow later restored and executed that state with release authority.

## If the release workflow misses the cache

GitHub Actions caches are immutable. If the cache key already exists from an earlier clean run, the PR cannot overwrite it.

For repeated demos, bump this key in both workflows:

```text
quality-report-tools-v1
```

For example:

```text
quality-report-tools-v2
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
fork PR code -> target workflow execution -> poisoned cache -> trusted release restore -> release credential/OIDC available
```

This repo demonstrates that chain with a fake release secret and a cached reporter.

## Safety boundaries

- Use only `POC_FAKE_SECRET`.
- Do not add real credentials.
- The payload records only whether a fake secret is present.
- The payload does not print secret values.
- The payload does not send network requests.
- The payload writes only `.poc-proof/` and `.ci-cache/reporter.mjs`.

## Local simulator

The `poc/` directory contains the earlier explicit simulator:

```bash
cd poc
npm run poc:safe-target
npm run poc:pr-ci
npm run poc:vulnerable
```

Use that when you want the simpler first-principles version before showing the cache-chain demo.
