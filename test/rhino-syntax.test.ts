import { describe, expect, it } from 'vitest';
import { findRhinoProblems } from '../scripts/lib/rhino-syntax.ts';

const wrap = (body: string): string => `(() => {\n${body}\n})();\n`;
const messages = (code: string): string[] => findRhinoProblems(code).map((p) => p.message);

describe('findRhinoProblems', () => {
  it('passes what release Rhino runs', () => {
    const code = wrap(
      [
        'const a = 1; let b = [a, 2];',
        'const o = { a: a, f: function () { return 1; }, g() { return 2; } };',
        'const { x, y: [z] } = { x: 1, y: [2] };',
        'for (const v of b) { console.info(`v=${v}`); }',
        'const square = (n) => n ** 2;',
        'function* gen() { yield 1; }',
      ].join('\n'),
    );
    expect(findRhinoProblems(code)).toEqual([]);
  });

  it.each([
    ['spread in calls', 'f(...args);', 'spread'],
    ['spread in arrays', 'const a = [...b];', 'spread'],
    ['object spread', 'const a = { ...b };', 'spread'],
    ['rest parameters', 'function f(...args) {}', 'rest'],
    ['rest in destructuring', 'const { a, ...others } = b;', 'rest'],
    ['default parameters', 'function f(a = 1) {}', 'default values'],
    ['defaults in destructuring', 'const { a = 1 } = b;', 'default values'],
    ['classes', 'class A {}', '`class`'],
    ['async functions', 'async function f() {}', '`async`'],
    ['async arrows', 'const f = async () => 1;', '`async`'],
    ['shorthand properties', 'const o = { a };', 'shorthand'],
    ['computed keys', 'const o = { [k]: 1 };', 'computed keys'],
    ['optional chaining', 'const v = a?.b;', 'optional chaining'],
    ['nullish coalescing', 'const v = a ?? 1;', '`??`'],
    ['logical assignment', 'a ||= 1;', 'logical assignment'],
    ['BigInt', 'const n = 1n;', 'BigInt'],
  ])('rejects %s', (_name, body, expected) => {
    expect(messages(wrap(body)).join(' / ')).toContain(expected);
  });

  it.each([
    ['a loop body', 'for (let i = 0; i < 3; i++) { const v = i; f(v); }'],
    ['a for-of body', 'for (const x of xs) { const y = x; f(y); }'],
    ['an if inside a loop', 'while (a) { if (b) { const v = 1; f(v); } }'],
    ['an if block next to a closure', 'if (a) { const v = 1; g(() => v); }'],
    ['a try block', 'try { const v = f(); g(v); } catch (e) { g(e); }'],
  ])('rejects a const in %s, which breaks on Rhino', (_name, body) => {
    expect(messages(wrap(body))).toEqual([
      'a `const` inside a block breaks on every Rhino build (in a loop it keeps its first ' +
        'value, next to a closure it throws a redeclaration error); use `let`',
    ]);
  });

  it('allows const at the top of a function, in a loop head, and let in any block', () => {
    expect(messages(wrap('const a = f(); for (const x of xs) { let y = x; g(y); }'))).toEqual([]);
    expect(messages(wrap('if (a) { let v = 1; g(() => v); }'))).toEqual([]);
    expect(
      messages(wrap('for (const x of xs) { g(function () { const z = x; return z; }); }')),
    ).toEqual([]);
  });

  it('rejects top-level declarations, which would leak into the shared scope', () => {
    expect(messages('const a = 1;\n')).toEqual([
      "top-level VariableDeclaration: the bundle must leak nothing into KubeJS's shared scope",
    ]);
  });

  it('allows a "use strict" directive and the wrapping call', () => {
    expect(findRhinoProblems(`"use strict";\n${wrap('const a = 1;')}`)).toEqual([]);
  });

  it('reports the line and column of the problem', () => {
    expect(findRhinoProblems(wrap('const a = 1;\nf(...a);'))).toEqual([
      { line: 3, column: 3, message: 'spread (`...x`) does not run on release Rhino' },
    ]);
  });

  it('reports code that does not parse', () => {
    expect(messages('(() => {')[0]).toMatch(/^does not parse/);
  });
});
