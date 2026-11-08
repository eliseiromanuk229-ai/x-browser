# X Browser

X Browser is an early, open-source desktop browser shell built with Electron and Chromium. It has a dark start page, multiple tabs, a tab overview, bookmarks, local history, quick links, and configurable toolbar and tab placement.

## Public project

- Source repository: https://github.com/eliseiromanuk229-ai/x-browser
- Project website: https://eliseiromanuk229-ai.github.io/x-browser/
- Website sitemap: https://eliseiromanuk229-ai.github.io/x-browser/sitemap.xml
- License: MIT

## Status

- Windows x64 desktop prototype; a Linux x64 packaging command and CI build are configured.
- No public installer is currently released. Android and iPhone need separate native app projects; Electron does not package apps for those platforms.
- Current desktop executable is unsigned. It is not a SignPath Foundation release.
- No X Browser account, cloud sync, or external identity-provider login is implemented yet.
- There is no public desktop release download yet.
- Search engines can crawl the live website, but each search engine controls whether and when it indexes pages.

## Run from source

1. Install Node.js 24 LTS.
2. Open `app` in a terminal.
3. Run `npm install` once.
4. Run `npm start`.
5. To package a Windows x64 folder, run `npm run package`.

The application stores bookmarks, history, and website cookies in the local Electron profile. Search terms are sent to Google; other page requests go to the sites the user opens. See [the privacy notice](site/privacy.html).

## Project files

- `app/` — Electron application source.
- `site/` — responsive product website and policy pages.
- `docs/publishing.md` — publishing and search-engine setup notes.
- `docs/signpath-eligibility.md` — current SignPath Foundation eligibility gaps.
- `docs/oauth-setup.md` — requirements for Google, Microsoft, Apple, and Yandex sign-in.

## License

The project source is licensed under the MIT License. Electron and Chromium retain their own licenses, bundled with their respective distributions.
