# Contributing to core

Thanks for helping build the EnsinoLibre worksheet builder. For org-wide norms (code of conduct, PR etiquette), see the [org-wide guide](https://github.com/EnsinoLibre/.github/blob/main/CONTRIBUTING.md). This file covers what's specific to `core`.

## Dev setup

```
git clone https://github.com/EnsinoLibre/core.git
cd core
npm install
npm run dev      # http://localhost:3210/site/index.html
```

There's no build step — the app is plain HTML, CSS and ES modules. There's no backend.

## Code style

- Plain ES modules, no framework. Pure logic (`validator.js`, `analog.js`, `prompt-builder.js`) must stay DOM-free so it runs under Node in the test suite.
- All worksheet data is untrusted: render it with `textContent`, never `innerHTML`. The one audited exception is `image-hotspot`'s inline SVG, which is validated and mounted via a data URI.
- Style against the design-system tokens (via the `--oc-*` bridge in `styles.css`), never hardcoded colours or spacing. If you need a token that doesn't exist, add it to [design-system](https://github.com/EnsinoLibre/design-system).
- Keep the app self-contained: no CDN links, no runtime external dependencies. Third-party libraries are vendored under `site/assets/vendor/`.

## Before opening a PR

- Run `npm test` and make sure all tests pass. The suite cross-checks that the validator, renderer, analog emitter, prompt contracts, JSON Schema and docs all cover the same set of activity types — so adding a type touches all of them by design.
- Adding or changing an activity type? Update its page in [docs](https://github.com/EnsinoLibre/docs) with a live example, and mirror the contract in [blocks](https://github.com/EnsinoLibre/blocks).

## Get help

Post in [org discussions](https://github.com/orgs/EnsinoLibre/discussions).
