# pull_request_target POC

This is a local, harmless reproduction of the main `pull_request_target` mistake.

It shows three cases:

1. `pull_request_target` metadata-only: safe shape.
2. `pull_request` CI: PR code runs, but with low authority.
3. `pull_request_target` plus PR-head checkout plus `npm install`: vulnerable shape.

No real secrets are used. The scripts set fake environment variables so you can see the trust-boundary problem without exfiltrating anything.

## Run it

From this directory:

```bash
npm run poc:safe-target
npm run poc:pr-ci
npm run poc:vulnerable
```

Or run the scripts directly:

```bash
node scripts/simulate-safe-target-run.mjs
node scripts/simulate-pull-request-ci-run.mjs
node scripts/simulate-vulnerable-target-run.mjs
```

Outputs are written to:

```text
.runs/
```

Clean up:

```bash
npm run poc:clean
```

## What the vulnerable run proves

The vulnerable simulator does this:

```yaml
on: pull_request_target

steps:
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.pull_request.head.sha }}

  - run: npm install
```

Locally, the simulator copies `fork-pr/` into the runner workspace and runs `npm install`.

The fork PR's `package.json` contains:

```json
{
  "scripts": {
    "postinstall": "node scripts/postinstall.js"
  }
}
```

That `postinstall` script is attacker-controlled PR code. In the vulnerable run it sees the fake privileged context and writes a proof file.

This is the entire point:

> `pull_request_target` is not the bug by itself. The bug is executing fork-controlled code inside the privileged target-repository context.

## What the safe run proves

The safe target simulator has fake write authority, but it never checks out or executes `fork-pr/`. It only writes a pretend PR comment payload.

That shape is what `pull_request_target` is for:

- label a PR
- comment on a PR
- close a PR
- inspect PR metadata
- enforce policy

## What the normal PR CI run proves

The normal `pull_request` simulator executes the same fork-controlled `postinstall`, but it does not provide fake repository secrets. That is the safer place to run PR code.

Real GitHub fork PRs still need careful permissions, but this is the correct separation:

- `pull_request`: run untrusted code with low authority
- `pull_request_target`: do privileged metadata work without running untrusted code

