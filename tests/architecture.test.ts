import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture guard: which src layers may import which.
 *
 * Layers (bottom-up):
 *   core      — provider-agnostic contracts and helpers. Depends on nothing internal.
 *   drivers/X — one folder per provider. May use core and its own folder only.
 *   routing,
 *   templates — pure policy over core. May use core only.
 *   policies  — reusable middleware/delivery policies. May use core and itself.
 *   testing   — fakes and contract helpers. May use core and itself, never drivers.
 *   root      — composition layer (index, factory, manager, public facades). Unrestricted.
 *
 * A violation means a layer reached across its boundary; fix the dependency
 * direction instead of widening the allow-list unless ARCHITECTURE.md agrees.
 */

const SRC = resolve(import.meta.dirname, "../src");

type ImportKind = "type" | "value";

interface Rule {
  applies: (file: string) => boolean;
  allows: (file: string, target: string, kind: ImportKind) => boolean;
}

const sameDriver = (file: string, target: string): boolean =>
  file.startsWith("drivers/") && target.startsWith(`drivers/${file.split("/")[1]}/`);

const rules: Rule[] = [
  { applies: (f) => f.startsWith("core/"), allows: (_f, t) => t.startsWith("core/") },
  {
    applies: (f) => f.startsWith("drivers/"),
    allows: (f, t) => t.startsWith("core/") || sameDriver(f, t),
  },
  {
    applies: (f) => f.startsWith("routing/") || f.startsWith("templates/"),
    allows: (_f, t) => t.startsWith("core/"),
  },
  {
    applies: (f) => f.startsWith("policies/"),
    allows: (_f, t) => t.startsWith("core/") || t.startsWith("policies/"),
  },
  {
    applies: (f) => f.startsWith("testing/"),
    allows: (_f, t) => t.startsWith("core/") || t.startsWith("testing/"),
  },
];

function* tsFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) yield* tsFiles(path);
    else if (entry.name.endsWith(".ts")) yield path;
  }
}

function relativeImports(file: string): { target: string; kind: ImportKind }[] {
  const text = readFileSync(file, "utf8");
  const statement =
    /(?:^|\n)\s*(?:import|export)\b([^;\n]*?)from\s*['"](\.[^'"]*)['"]|\bimport\(\s*['"](\.[^'"]*)['"]\s*\)/g;
  const imports: { target: string; kind: ImportKind }[] = [];
  for (const match of text.matchAll(statement)) {
    const spec = match[2] ?? match[3]!;
    const typeOnly =
      match[1] !== undefined
        ? match[1].trimStart().startsWith("type")
        : /(?:^|\W)typeof\s*$/.test(text.slice(Math.max(0, match.index! - 16), match.index!));
    const target = relative(SRC, resolve(file, "..", spec.replace(/\.js$/, "")))
      .split("\\")
      .join("/");
    imports.push({ target, kind: typeOnly ? "type" : "value" });
  }
  return imports;
}

describe("architecture", () => {
  it("keeps every import inside its layer boundary", () => {
    const violations: string[] = [];
    for (const file of tsFiles(SRC)) {
      const fileRel = relative(SRC, file).split("\\").join("/");
      if (!fileRel.includes("/")) continue; // root files are the composition layer
      for (const { target, kind } of relativeImports(file)) {
        for (const rule of rules) {
          if (rule.applies(fileRel) && !rule.allows(fileRel, target, kind)) {
            violations.push(`${fileRel} -> ${target} [${kind}]`);
          }
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
