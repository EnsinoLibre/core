# core

This is the EnsinoLibre worksheet builder, the flagship app in the EnsinoLibre project. Teachers drag blocks onto a canvas to build, customize, and share worksheets.

Full guides live in [ensinolibre/docs](https://github.com/ensinolibre/docs). This README covers the basics of running and understanding this repo.

## Screenshots

<!-- add a screenshot to docs/screenshots/ and reference it here -->

There's no visual design to show yet. This repo is still a skeleton (see Quick start below), so screenshots will land here once the builder actually has a UI worth looking at.

## Quick start

```
git clone https://github.com/ensinolibre/core.git
cd core
npm install
npm run dev
```

The app opens at `http://localhost:5173`.

Note: this is currently a skeleton. The Palette, Canvas, and Inspector panes render placeholder content, not the real drag-and-drop builder. The project is in early bootstrapping, and this scaffold is the starting point for building out those features.

## Architecture overview

The stack is Vite, React, and TypeScript.

The intended data flow, once the placeholders become real:

- **Palette** (`src/components/Palette`) lists the block types available to drag onto a worksheet. It reads this list from the `blocks` package.
- **Canvas** (`src/components/Canvas`) holds the worksheet currently being built. Its state is a `Worksheet`, the type defined in `src/lib/worksheet-model.ts`, and it's where drag-and-drop lands new blocks and reorders existing ones.
- **Inspector** (`src/components/Inspector`) edits whatever block is selected on the Canvas, by rendering that block's own `Editor` component from the `blocks` package.
- **Share and grade** (`src/lib/share.ts` and `src/lib/grading.ts`) turn a finished worksheet into something a teacher can hand out and later grade. Both are stubs right now.

## The block library

Worksheet blocks, things like multiple choice questions, fill-in-the-blank, and short answer, live in a separate package so they can be developed and versioned independently of the builder UI. See [ensinolibre/blocks](https://github.com/ensinolibre/blocks).

Design tokens and shared UI foundations (colors, spacing, base components) live in [ensinolibre/design-system](https://github.com/ensinolibre/design-system). This repo's `package.json` lists both `@ensinolibre/blocks` and `@ensinolibre/design-system` as dependencies. Those point at the versions published from their respective repos, so `npm install` won't resolve them until those packages are published.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup and code style. Good first issues are labeled [`good first issue`](https://github.com/ensinolibre/core/labels/good%20first%20issue).

## Get help

Questions, ideas, or just want to say hello? Head to [EnsinoLibre discussions](https://github.com/orgs/ensinolibre/discussions).
