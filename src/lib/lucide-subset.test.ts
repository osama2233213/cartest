import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = join(process.cwd(), "src");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(f) && !p.endsWith("lucide-subset.ts") ? [p] : [];
  });

describe("icon subset", () => {
  it("has every icon the app imports (run `npm run icons` if this fails)", () => {
    const subset = readFileSync(join(src, "lib", "lucide-subset.ts"), "utf8");
    const exported = new Set([...subset.matchAll(/ as (\w+)/g)].map((m) => m[1]));
    const missing: string[] = [];
    for (const file of walk(src)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']lucide-react["']/g)) {
        if (m[1]) continue;
        for (const part of m[2]!.split(",")) {
          const t = part.trim();
          if (!t || t.startsWith("type ")) continue;
          const name = t.split(/\s+as\s+/)[0]!.trim();
          if (!exported.has(name)) missing.push(`${name} (${file.replace(src, "src")})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
