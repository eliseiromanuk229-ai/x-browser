# X Browser

X Browser is an early, open-source Windows browser shell built with Electron and Chromium. It has a dark start page, multiple tabs, a tab overview, bookmarks, local history, quick links, and configurable toolbar and tab placement.

## Status

- Windows x64 desktop prototype. No Android or iPhone release yet.
- The current executable is unsigned and is blocked by some Windows 11 security settings. It is not a SignPath Foundation release.
- No X Browser account, cloud sync, or external identity-provider login is implemented yet.
- No public project URL, release page, or store listing is active yet. Add the final public URLs here before submitting a SignPath application or announcing a release.

## Run from source

1. Install Node.js 24 LTS.
2. Open `app` in a terminal.
3. Run `npm install` once.
4. Run `npm start`.
5. To package a Windows x64 folder, run `npm run package`.

The application stores bookmarks, history, and website cookies in the local Electron profile. Search terms are sent to Google; other page requests go to the sites the user opens. See [the privacy notice](site/privacy.html).

## Project files

- `app/` — Electron application source.
- `site/` — responsive product website and draft policy pages.
- `docs/publishing.md` — publishing and search-engine setup notes.
- `docs/signpath-eligibility.md` — current SignPath Foundation eligibility gaps.
- `docs/oauth-setup.md` — requirements for Google, Microsoft, Apple, and Yandex sign-in.

## License

The project source is licensed under the MIT License. Electron and Chromium retain their own licenses, bundled with their respective distributions.

## Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md). A public repository, issue tracker, code review workflow, and release history must be created before accepting outside contributions.
