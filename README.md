# Long Context Atlas

A static, shareable explorer for the accepted CLBench-Life RL synthetic long-context samples.

## What is public and what is private

`public/` is the only directory intended for deployment. It contains the policy-visible archive, task, response-format contract, document structure, and safe quality counts. It deliberately excludes canonical answers, evidence anchors, rubrics, blind-recovery details, audits, and generation provenance.

`private-review/` is generated locally from the same source files for reviewer inspection. It includes every JSON field and must **not** be published while the data is used for RL training.

## Refresh from node61

From this directory in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Sync-AcceptedSamples.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\Build-WebData.ps1
```

This downloads the current accepted run into `source-data/current`, then creates deployable files in `public/data` and the local-only inspector in `private-review`.

## Run locally

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Serve-Local.ps1
```

Open <http://127.0.0.1:4173>. The public explorer fetches data files, so opening `index.html` directly with `file://` is not supported.

For the full local reviewer, run:

```powershell
py -3 -m http.server 4174 --directory .\private-review
```

Then open <http://127.0.0.1:4174>.

## Publish

The recommended free host is GitHub Pages. Commit **only** the source files and the built `public/` folder; `.gitignore` prevents private raw/reviewer artifacts from being added. The workflow at `.github/workflows/deploy-pages.yml` deploys `public/` when GitHub Pages is enabled with the **GitHub Actions** source.

See [DEPLOY.md](DEPLOY.md) for the exact GitHub Pages and Cloudflare Pages steps.
