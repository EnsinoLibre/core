# Contributing to core

Thanks for taking a look. This repo is the EnsinoLibre worksheet builder, and it's still early: most of the UI is placeholder scaffolding waiting to become real. That makes it a good place to make a meaningful first contribution.

For org-wide contribution norms (code of conduct, PR etiquette, how EnsinoLibre repos generally work), see the [org-wide CONTRIBUTING guide](https://github.com/ensinolibre/.github/blob/main/CONTRIBUTING.md). This file covers what's specific to `core`.

## Dev setup

```
git clone https://github.com/ensinolibre/core.git
cd core
npm install
npm run dev
```

The app opens at `http://localhost:5173`. There's no backend to run alongside it yet.

## Code style

- TypeScript, in strict mode. Please don't loosen `tsconfig.json`'s strict settings to work around a type error, fix the type instead.
- Components are functional components with hooks, no class components.
- Styling is plain CSS per component (each component folder has its own `.css` file), or CSS modules if a component's styles start colliding with others. There's no CSS-in-JS setup here.
- Keep placeholder components' TODO comments up to date. If you start implementing something a TODO describes, update or remove the comment as part of your PR.

## Turning a placeholder into something real

A lot of the highest-value work here is picking up one of the placeholder components and building it out. For example:

- **Canvas drag-and-drop.** `src/components/Canvas/Canvas.tsx` currently just renders an empty state. The real version needs to hold a `Worksheet` (see `src/lib/worksheet-model.ts`) as state, accept blocks dragged from the Palette, and let a teacher reorder them. `dnd-kit` is a reasonable library to reach for here, but it's not a hard requirement, if you have a good reason to use something else, open an issue first to discuss it.
- **Inspector editing.** Once a block can be selected on the Canvas, `src/components/Inspector/Inspector.tsx` needs to render that block's `Editor` component from `@ensinolibre/blocks` and wire up changes back into the worksheet.
- **Palette wiring.** `src/components/Palette/Palette.tsx` has a hardcoded list of block type names. Once `@ensinolibre/blocks` is installed, swap that for the real `blockRegistry` export.

If you're not sure where to start, look for issues labeled `good first issue`, or ask in [discussions](https://github.com/orgs/ensinolibre/discussions).

## Before opening a PR

- Run `npm run lint` (type-checks the project) and make sure it passes.
- Keep PRs focused. If you find yourself touching the Canvas, Inspector, and Palette all in one PR, it's probably worth splitting up.
