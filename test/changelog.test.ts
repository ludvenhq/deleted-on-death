import { describe, expect, it } from 'vitest';
import { changelogSection } from '../scripts/lib/changelog.ts';

const changelog = `# Changelog

## [Unreleased]

## [0.2.0] - 2026-11-01

### Changed

- Bigger zombies.

## [0.1.0] - 2026-10-20

### Added

- Everything.

[0.2.0]: https://github.com/ludvenhq/deleted-on-death/compare/v0.1.0...v0.2.0
`;

describe('changelogSection', () => {
  it('returns one version section without its heading', () => {
    expect(changelogSection(changelog, '0.2.0')).toBe('### Changed\n\n- Bigger zombies.');
  });

  it('stops at the link references after the last section', () => {
    expect(changelogSection(changelog, '0.1.0')).toBe('### Added\n\n- Everything.');
  });

  it('returns null for a missing or empty section', () => {
    expect(changelogSection(changelog, '9.9.9')).toBeNull();
    expect(changelogSection(changelog, 'Unreleased')).toBeNull();
  });
});
