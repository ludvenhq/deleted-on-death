# Contributing

Thanks for helping. Deleted on Death is small on purpose: one idea, played well and easy to film.

## Ideas and rule changes

Open an [issue](https://github.com/ludvenhq/deleted-on-death/issues/new/choose) before writing code
for a new mechanic or a change to the rules. The test for any idea: can a viewer see it on screen
within three seconds? A change nobody can see in a clip is usually not worth its complexity.

## Bugs

A bug is anything the game does differently from [docs/rules.md](docs/rules.md). The bug form asks
for your versions and the relevant part of `logs/kubejs/server.log`.

## Code

1. Set up with [docs/development.md](docs/development.md). `npm run verify` must be green.
2. Write strict TypeScript inside the Rhino subset; ESLint tells you at the line when something
   would not run on release Rhino. [The Rhino rules](docs/development.md#the-rhino-rules) list
   what to write instead.
3. Keep the rules pure and unit tested; keep the game glue thin. A new event handler gets a case
   in `test/rhino/scenario.js`.
4. Try it in the game and say in the pull request what you tested.
5. Add a line under `## [Unreleased]` in `CHANGELOG.md`, and update `docs/rules.md` if a rule or a
   number changed.
6. Open the pull request against `dev`. `main` is what is released.

Commit messages say what changed and why, in plain words: `Deleted regrowers are swept again every
minute, so grass that spreads back is gone again`.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
