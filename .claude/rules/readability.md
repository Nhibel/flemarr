# Readability

Applies project-wide (web, server, shared). Code is read far more often than it is written: optimise for the reader who opens the file for the first time.

**The test:** a developer new to the file understands every expression without decomposing it by hand. If understanding a line needs expert knowledge of a language corner or a mental stack of three conditions, rewrite it.

## Rules

- **No nested ternaries.** One level of `a ? b : c` is fine. Beyond that, use:
  - early returns / `if … else` in a function,
  - a lookup table (`Record<Kind, Label>`) when mapping a discriminant to a value,
  - a small component or helper when choosing between JSX branches.
  Enforced by eslint (`no-nested-ternary`).
- **Name non-trivial conditions.** `const isStale = resolved !== null && resolved.sourceKey !== sourceKey;` then `if (isStale)`, rather than four terms inline in a JSX attribute.
- **No clever one-liners.** No nested `reduce`, no chains of four-plus operators, no bitwise tricks, no comma expressions, no `!!` chains. A plain loop that reads top to bottom beats a dense pipeline.
- **Early returns over deep nesting.** Four levels of blocks maximum; flatten with guard clauses. Enforced by eslint (`max-depth` 4, and `complexity` 15 per function), tests excepted.
- **Explicit names.** No abbreviations outside the domain vocabulary (`dat`, `rom`, `crc`, `sha1`, `chd` are fine; `ctx`, `cfg`, `res` for a resolve result are not when a real word fits).
- **Discriminated unions get a `switch`.** Branching on `event.type`/`kind` uses a `switch` (exhaustive where it matters), not a long `if / else if` chain.
- **Comments say why, not what.** If the *what* needs a comment, the code needs rewriting.
