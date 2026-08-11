# Free public deployment

## Recommended: GitHub Pages

GitHub Pages gives a durable free address in the form:

```text
https://<your-github-user>.github.io/<repository-name>/
```

1. Create a new public GitHub repository, for example `long-context-atlas`.
2. Copy this `Web4longcontext` project into that repository.
3. Run the data build script and verify that `public/data/catalog.json` exists.
4. Check `git status` before committing. `source-data/` and `private-review/` must remain ignored. Do not force-add them.
5. Push the `main` branch.
6. In GitHub repository settings, open **Pages**, set **Build and deployment / Source** to **GitHub Actions**.
7. The included workflow deploys the `public/` directory. The Pages settings panel shows the final URL after the first successful run.

The URL is publicly readable. Anyone can inspect downloaded public JSON, so do not put reward-side fields in `public/data`.

## Alternative: Cloudflare Pages

Cloudflare Pages provides a free `<project>.pages.dev` address.

1. Create a Cloudflare account and connect the same GitHub repository.
2. Create a Pages project with no build command and `public` as the output directory.
3. After the first deployment, use the supplied `*.pages.dev` URL or attach a custom domain you own.

Use either host, not both. A custom domain is not free unless you already own the domain; GitHub Pages and `pages.dev` are free public subdomains.
