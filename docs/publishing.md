# Publishing checklist

## Website

`site/` is a static, mobile-friendly product site prepared for GitHub Pages at `https://eliseiromanuk229-ai.github.io/x-browser/`. The `pages.yml` workflow deploys it when `main` is pushed. GitHub Pages must be enabled for the repository using GitHub Actions before the first deployment can succeed.

Before using a different hostname:

1. Choose and control a domain or a public project-hosting URL.
2. Replace all `eliseiromanuk229-ai.github.io` URLs with the final canonical HTTPS URL.
3. Rename `sitemap.xml.template` to `sitemap.xml` and update it to the canonical URL.
4. Keep the privacy and code-signing pages accurate. Do not claim SignPath participation before acceptance.

## Search engines

After the site is live, verify ownership separately with Google Search Console, Bing Webmaster Tools, and Yandex Webmaster; then submit the sitemap. Crawling and indexing are controlled by each search engine and cannot be guaranteed. Apple is an identity provider here, not a general web search engine.

## Public release

Build from a tagged source revision, publish source and release notes, and upload the installer/package to the public release page. Publish SHA-256 hashes. Do not publish an unsigned binary as an accepted SignPath build.

## Authentication

Provider sign-in needs a real HTTPS domain, an account service and session policy, separately registered applications at each provider, redirect URIs, and server-side secrets. See `oauth-setup.md`. Never put client secrets or signing keys in the website or repository.
