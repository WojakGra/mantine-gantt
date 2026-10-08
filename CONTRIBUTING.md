# Contributing to mantine-gantt

Thanks for helping out. Bug reports, fixes, docs and feature ideas are all welcome.
By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs**: open an issue with a minimal reproduction (CodeSandbox or StackBlitz).
- **Features**: open a feature request first so we can agree on the API before you write code.
- **Security issues**: don't open a public issue. See [SECURITY.md](SECURITY.md).

## Setup

You need Node 24 (see `.nvmrc`) and Yarn 4.

```bash
corepack enable
yarn
```

## Repository layout

- `package/`: the published library. All component source is in `package/src/Gantt/`.
- `docs/`: the Next.js docs site.

## Development

```bash
yarn dev        # docs site, for manual testing
yarn storybook  # Storybook on http://localhost:8271
yarn jest       # unit and integration tests
```

## Before opening a pull request

Run the same checks CI runs:

```bash
yarn build
yarn test   # syncpack + prettier + typecheck + eslint/stylelint + jest
```

If formatting fails, run `yarn prettier:write`. Prettier also sorts imports, so don't reorder them by hand.

## Guidelines

- `Gantt` is a Mantine component built on the Styles API. Use `factory`, `useProps`, `useStyles` and `getStyles('selector')`, and don't put inline `className` or `style` on internal elements. A new selector needs an entry in the `GanttStylesNames` union in `types.ts` and a matching class in `Gantt.module.css`. See [CLAUDE.md](CLAUDE.md) and `.agents/skills/mantine-custom-components/` for details.
- Do date and pixel math in `utils.ts` with `effectiveColumnWidth`, and cover it with tests in `utils.test.ts`.
- Add or update tests for any change in behavior. Update the docs or stories when the public API changes.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), e.g. `feat(Gantt): add baseline bars` or `fix(Docs): …`.
- Don't bump the version in `package/package.json`. The maintainer handles releases.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
