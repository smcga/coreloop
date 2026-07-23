import { FrameworkError } from "./errors";

export interface CanonicalOptions {
  readonly excludeKeys?: readonly string[];
}

/** RFC-8259-compatible JSON with recursively sorted object keys. */
export function canonicalJson(
  value: unknown,
  options: CanonicalOptions = {},
): string {
  const excluded = new Set(options.excludeKeys ?? []);
  const visit = (input: unknown, path: string, stack: Set<object>): string => {
    if (input === null) return "null";
    if (typeof input === "string" || typeof input === "boolean")
      return JSON.stringify(input);
    if (typeof input === "number") {
      if (!Number.isFinite(input)) fail(path, input);
      return JSON.stringify(input);
    }
    if (typeof input !== "object" || input === undefined) fail(path, input);
    const object = input as object;
    if (stack.has(object)) fail(path, "circular reference");
    stack.add(object);
    let result: string;
    if (Array.isArray(input))
      result = `[${input.map((item, i) => visit(item, `${path}[${i}]`, stack)).join(",")}]`;
    else {
      const record = input as Record<string, unknown>;
      result = `{${Object.keys(record)
        .filter((key) => !excluded.has(key))
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${visit(record[key], `${path}.${key}`, stack)}`,
        )
        .join(",")}}`;
    }
    stack.delete(object);
    return result;
  };
  return visit(value, "$", new Set());
}

function fail(path: string, actual: unknown): never {
  throw new FrameworkError(
    "canonicalisation-failure",
    `Unsupported canonical value at ${path}`,
    { path, actual: typeof actual },
  );
}

/** Stable dependency-free FNV-1a 32-bit text hash. Not cryptographic. */
export function stableHash(value: unknown, options?: CanonicalOptions): string {
  const text = canonicalJson(value, options);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}
