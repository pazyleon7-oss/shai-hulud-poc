# PR Quality Report Demo

This repository is a disposable GitHub Actions demo for understanding why `pull_request_target` can be dangerous when it is used as if it were normal pull request CI.

The base repository looks like a small project with two PR workflows:

- `.github/workflows/pr-ci.yml`
- `.github/workflows/pr-quality-report.yml`

The fork pull request makes the case for why one of those workflows crosses the trust boundary.

## Base repository setup

Create a new public repository from this directory and add one fake secret:

```text
POC_FAKE_SECRET=fake-secret-for-demo-only
```

Do not add any real tokens, cloud credentials, npm credentials, database URLs, Docker credentials, or production secrets.

Push the repository:

```bash
git remote add origin git@github.com:YOUR_ACCOUNT/YOUR_REPO.git
git push -u origin main
```

## Fork-side reproduction

From a separate GitHub account:

1. Fork the repository.
2. Clone the fork.
3. Create a branch.
4. Add the harmless payload.

```bash
git switch -c useful-fix
node scripts/write-attacker-payload.mjs
git add package.json scripts/attacker-postinstall.mjs
git commit -m "Improve project setup"
git push origin useful-fix
```

Open a pull request from the fork back to the base repository.

## What the fork changes

The fork does not edit the workflow.

It only changes normal project files:

- `package.json`
- `scripts/attacker-postinstall.mjs`

The change adds a `postinstall` hook:

```json
{
  "scripts": {
    "postinstall": "node scripts/attacker-postinstall.mjs"
  }
}
```

That is enough because both workflows run `npm install`.

## Expected result

The normal PR workflow runs under `pull_request`.

It checks out the fork code and executes the `postinstall`, but the fake repository secret should not be present:

```json
{
  "eventName": "pull_request",
  "fakeSecretPresent": false
}
```

The quality report workflow runs under `pull_request_target`.

It also checks out the fork code and executes the same `postinstall`, but this time the fake repository secret is present:

```json
{
  "eventName": "pull_request_target",
  "fakeSecretPresent": true
}
```

That is the trust-boundary failure.

## Why this is realistic

The risky workflow is not named like an exploit. It looks like a common automation goal:

- run PR checks
- work for fork pull requests
- write a PR report/comment
- use a repository secret for reporting/authentication

The unsafe decision is here:

```yaml
on:
  pull_request_target:

steps:
  - uses: actions/checkout@v4
    with:
      repository: ${{ github.event.pull_request.head.repo.full_name }}
      ref: ${{ github.event.pull_request.head.sha }}

  - run: npm install
```

That turns untrusted fork files into code running inside the base repository's privileged workflow context.

## Safety boundaries

This POC is intentionally non-destructive:

- The only secret should be `POC_FAKE_SECRET`.
- The payload records only whether the fake secret is present.
- The payload records whether token-backed checkout credentials appear to be configured.
- The payload does not print secret values.
- The payload does not send network requests.
- The payload writes only `.poc-proof/proof.json` and the GitHub step summary.

## Local simulator

The `poc/` directory contains the earlier explicit simulator:

```bash
cd poc
npm run poc:safe-target
npm run poc:pr-ci
npm run poc:vulnerable
```

Use that when you want a more obvious teaching version before showing the GitHub fork demo.

