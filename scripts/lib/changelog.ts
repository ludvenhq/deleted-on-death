/** The body of one version's section in CHANGELOG.md, for the GitHub release notes. */
export function changelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## ') || line.startsWith('['));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return body === '' ? null : body;
}
