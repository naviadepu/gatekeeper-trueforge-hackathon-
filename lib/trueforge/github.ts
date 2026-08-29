/**
 * Minimal unauthenticated GitHub reads + a deterministic package.json patcher.
 *
 * The open-PR agent turn commits a file through the GitHub connector, and small
 * models are unreliable at reproducing a whole file verbatim. So we fetch the
 * real manifest and compute the patched version here, in code, then hand the
 * agent the exact bytes to commit.
 */

export interface ManifestFile {
  /** Raw file text. */
  content: string;
  /** Blob sha — required by `create_or_update_file`. */
  sha: string;
}

export interface UpgradeChange {
  /** Package name, or `overrides/<pkg>` for a transitive pin. */
  name: string;
  to: string;
}

/** Read `package.json` from a public repo's default branch. No token needed. */
export async function fetchPackageJson(repo: string): Promise<ManifestFile> {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/package.json`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "gatekeeper" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Could not read package.json from ${repo} (GitHub ${res.status}).`);
  }
  const body = (await res.json()) as { content: string; encoding: string; sha: string };
  const content = Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8").toString("utf8");
  return { content, sha: body.sha };
}

/**
 * Apply the approved upgrades to a package.json string and return the new text.
 * Preserves 2-space indentation and key order; appends `overrides` if needed.
 */
export function patchPackageJson(content: string, changes: UpgradeChange[]): string {
  const pkg = JSON.parse(content) as Record<string, unknown>;

  for (const { name, to } of changes) {
    if (name.includes("/")) {
      const dep = name.split("/").pop() as string;
      const overrides = (pkg.overrides && typeof pkg.overrides === "object" ? pkg.overrides : {}) as Record<
        string,
        string
      >;
      overrides[dep] = to;
      pkg.overrides = overrides;
      continue;
    }
    const inDeps = pkg.dependencies && typeof pkg.dependencies === "object" && name in (pkg.dependencies as object);
    const inDev = pkg.devDependencies && typeof pkg.devDependencies === "object" && name in (pkg.devDependencies as object);
    if (inDev && !inDeps) {
      (pkg.devDependencies as Record<string, string>)[name] = to;
    } else {
      const deps = (pkg.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {}) as Record<
        string,
        string
      >;
      deps[name] = to;
      pkg.dependencies = deps;
    }
  }

  const trailingNewline = content.endsWith("\n") ? "\n" : "";
  return JSON.stringify(pkg, null, 2) + trailingNewline;
}
