# PR Quality Report Demo

Default-branch target repository for a `pull_request_target` cache-poisoning demo.

This branch is intentionally the base project, not the attacker kit. The fork PR supplies the suspicious code.

## Chain

1. A fork PR changes normal project files.
2. The base repository's `pull_request_target` workflow checks out the fork PR code.
3. That workflow runs `npm install` and saves `node_modules` with `actions/cache`.
4. The fork PR's install hook patches `node_modules/left-pad/index.js`.
5. A trusted release workflow automatically starts after the PR quality workflow completes.
6. The release workflow runs normal release code with `contents: write`.
7. The release code imports `left-pad`; if the cache was poisoned, the patched package executes with the release workflow's authority.

The release workflow itself does not contain a marker-commit step. In the demo PR, the cached package attempts the harmless same-repository `hehe.txt` commit.

## Base Project

The project depends on a real npm package:

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

That script imports and calls `left-pad`. Clean dependency state produces only a release report. Poisoned cached dependency state executes the patched package first.

## Workflows

### `.github/workflows/pr-ci.yml`

- trigger: `push` to `main` or `poc`, plus manual `workflow_dispatch`
- checks out repository code
- runs `npm install`
- has `contents: read`

This is deliberately not a fork-PR workflow. GitHub may hold `pull_request` workflows from forks for maintainer approval, which adds noise to this demo. The fork-triggered workflow in this repository is the `pull_request_target` quality report below.

### `.github/workflows/pr-quality-report.yml`

- trigger: `pull_request_target`
- checks out fork PR code
- restores/saves `node_modules` with key `node-modules-left-pad-v1`
- runs `npm install`
- has `contents: read`, `pull-requests: read`, `issues: write`

The mistake is not a direct secret leak. The mistake is letting untrusted fork code write dependency state into a cache namespace later consumed by trusted automation.

### `.github/workflows/release-report.yml`

- trigger: automatic `workflow_run` after `PR Quality Report`, plus manual `workflow_dispatch`
- restores `node_modules` with key `node-modules-left-pad-v1`
- runs `npm run release:notes`
- has `contents: write`

This simulates trusted release/reporting automation that consumes cached dependency state after PR automation finishes.

## Attacker Material

The helper generator and older local simulator are not on this default branch. They live on the separate `poc` branch so this branch stays realistic as the target repository.

For the live demo, the fork PR should add only:

- a `postinstall` script in `package.json`
- `scripts/attacker-postinstall.mjs`

That fork-side script patches:

```text
node_modules/left-pad/index.js
```

The patched package still behaves like `left-pad`, but when later imported by the release workflow it writes proof and attempts the harmless `hehe.txt` marker commit.

## Expected Results

In the PR quality workflow summary, the fork-side proof should show:

```json
{
  "eventName": "pull_request_target",
  "packagePatched": "left-pad",
  "patchedFile": "node_modules/left-pad/index.js"
}
```

After that workflow completes, `Release Report` should start automatically. If the cache restored correctly, the release proof should show:

```json
{
  "message": "Patched npm package executed inside trusted release workflow.",
  "package": "left-pad",
  "eventName": "workflow_run",
  "contentsWriteDemo": true,
  "markerFile": "hehe.txt",
  "gitPushAttempted": true
}
```

If branch protection or repository settings block the push, the proof artifact should include the git error. That is still a useful result: it shows the cached code reached the trusted workflow boundary, but repository controls stopped the write.

## Cache Note

GitHub Actions caches are immutable. If the cache key already exists from a previous clean run, the PR cannot overwrite it.

For repeated demos, bump this key in both workflows:

```text
node-modules-left-pad-v1
```

For example:

```text
node-modules-left-pad-v2
```

## Safety Boundaries

- Do not add real credentials.
- The demo does not require repository secrets.
- The payload does not print secret values.
- The payload does not call an external collection endpoint.
- The marker action is limited to `hehe.txt` in the same disposable repository.
