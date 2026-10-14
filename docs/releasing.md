# Releasing

Versions follow [Semantic Versioning](https://semver.org). Before 1.0, a minor version may change
rules and default numbers; every such change is in the changelog.

## 1. Prepare on `dev`

1. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, add a fresh empty
   `## [Unreleased]` above it, and add the compare link at the bottom.
2. Set the version: `npm version x.y.z --no-git-tag-version`.
3. `npm run verify`, then commit: `Release x.y.z`.

## 2. Merge to `main`

Open a pull request from `dev` to `main`. CI runs on it. A maintainer merges it.

## 3. Tag

```sh
git checkout main && git pull
git tag vx.y.z
git push origin vx.y.z
```

The Release workflow checks that the tag matches `package.json` and that the changelog has the
section, runs `npm run verify`, and opens a **draft** GitHub release with the jar, the plain
script and `SHA256SUMS`, with the changelog section as its notes.

## 4. Test the release jar in a clean game

Download the jar from the draft release. In a new NeoForge 1.21.1 instance with only KubeJS and
KubeLoader added by the app:

- [ ] The game starts and a new world opens.
- [ ] A new world shows the `BLOCKS LEFT 200` bar; dying on grass shows `GRASS BLOCK` and the
      grass around you disappears.
- [ ] `logs/kubejs/server.log` has `Deleted on Death x.y.z loaded` and no errors.
- [ ] The rules in `docs/rules.md` that changed in this version behave as written.

Then publish the draft release.

## 5. Upload to CurseForge and Modrinth

Upload the same jar to both, on the `ludvenhq` accounts.

| Field        | Value                                                |
| ------------ | ---------------------------------------------------- |
| File         | `deleted-on-death-x.y.z.jar`                         |
| Version name | `x.y.z`                                              |
| Release type | Release (Beta for 0.x if the rules are still moving) |
| Game version | 1.21.1                                               |
| Loader       | NeoForge                                             |
| Environment  | Client and server                                    |
| Dependencies | KubeJS (required), KubeLoader (required)             |
| Changelog    | The section from `CHANGELOG.md`                      |

Each platform must declare the dependencies on every version (Modrinth's rules require it), or
the apps will not install them. CurseForge does not allow donation links on the project page.
