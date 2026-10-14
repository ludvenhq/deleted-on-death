import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** A Java 21+ JDK from JAVA_HOME or PATH, or null. The checks run Java single-file programs. */
export function findJava(): string | null {
  const candidates: string[] = [];
  const javaHome = process.env.JAVA_HOME;
  if (javaHome !== undefined && javaHome !== '') {
    candidates.push(join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'));
  }
  candidates.push('java');
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  return null;
}

/** Java or, when there is none: skip with a warning locally, fail in CI. */
export function requireJava(checkName: string): string {
  const java = findJava();
  if (java !== null) return java;
  const message = `${checkName}: no Java found (set JAVA_HOME to a Java 21+ JDK)`;
  if (process.env.CI !== undefined) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`${message}. SKIPPED here; CI runs it.`);
  process.exit(0);
}
