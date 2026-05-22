# `pull_request_target` GitHub POC

Disposable GitHub repository for demonstrating the main `pull_request_target` failure mode.

The POC shows:

1. `pull_request_target` can safely do metadata-only work.
2. `pull_request` can run PR code with low authority.
3. `pull_request_target` becomes dangerous when it checks out fork PR code and runs it.

Use a disposable public repository. Do not add real secrets.

## Setup

1. Create a new GitHub repository from this directory.
2. Add one fake repository secret:

   ```text
   POC_FAKE_SECRET=fake-secret-for-demo-only
   ```

3. Push the base repository.
4. From a separate GitHub account, fork the repository.
5. In the fork, create a branch that adds the attacker payload:

   ```bash
   node scripts/write-attacker-payload.mjs
   git add package.json scripts/attacker-postinstall.mjs
   git commit -m "Add harmless PR change"
   git push origin attacker-postinstall-poc
   ```

6. Open a pull request from the fork branch to the base repo.

## What should happen

Three workflows are included.

### 1. Safe target workflow

File:

```text
.github/workflows/safe-pull-request-target.yml
```

It runs on `pull_request_target`, but it does not check out or run PR code. It only writes a small summary explaining that metadata-only target workflows are the safe shape.

### 2. Normal PR CI workflow

File:

```text
.github/workflows/normal-pull-request-ci.yml
```

It runs on `pull_request`, checks out PR code, and runs `npm install`. The attacker-controlled `postinstall` runs, but normal fork PRs do not receive repository secrets.

Expected proof:

```json
{
  "eventName": "pull_request",
  "fakeSecretPresent": false
}
```

### 3. Vulnerable target workflow

File:

```text
.github/workflows/vulnerable-pull-request-target.yml
```

It runs on `pull_request_target`, checks out the fork PR head SHA, and runs `npm install` while a fake secret is present.

Expected proof:

```json
{
  "eventName": "pull_request_target",
  "fakeSecretPresent": true
}
```

That is the bug class: fork-controlled code ran inside the privileged target-repository workflow context.

## Important safety notes

- Use only the fake `POC_FAKE_SECRET`.
- Do not add cloud, npm, Docker, GitHub PAT, database, or production secrets.
- Do not run this workflow in a real project.
- The attacker script does not print secret values. It records only whether the fake secret is present.
- The vulnerable workflow intentionally leaves checkout credentials persisted so the proof can show whether token-backed git credentials are present. It does not print those credentials.

## Why this recreates the Shai-Hulud class

The first failure in the Shai-Hulud/TanStack-style chain is not mysterious:

```yaml
on: pull_request_target

steps:
  - uses: actions/checkout@v4
    with:
      repository: ${{ github.event.pull_request.head.repo.full_name }}
      ref: ${{ github.event.pull_request.head.sha }}

  - run: npm install
```

If the PR changes `package.json` and adds a `postinstall`, that PR code executes in the target workflow.

The full supply-chain incident then chained this kind of trust-boundary break with cache poisoning and release/OIDC publishing. This POC stops at the first boundary break.

## Local simulator

The `poc/` directory contains a local simulator that proves the same concept without GitHub.

```bash
cd poc
npm run poc:safe-target
npm run poc:pr-ci
npm run poc:vulnerable
```

