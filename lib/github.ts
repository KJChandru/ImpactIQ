/**
 * GitHub repository intake — fetches a public repo as a ZIP (server-side, no
 * CORS) so the deterministic Module A pipeline can take over. Code is only ever
 * downloaded and parsed, never executed.
 */

export class GithubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubError";
  }
}

export interface GithubTarget {
  owner: string;
  repo: string;
  ref?: string; // branch/tag/sha, if specified
}

/** Accepts full URLs, `.git` URLs, `/tree/<ref>` URLs, and `owner/repo[@ref]`. */
export function parseGithubTarget(input: string): GithubTarget | null {
  const s = input.trim().replace(/\.git$/, "");

  const url = s.match(/github\.com[/:]([^/\s]+)\/([^/#?\s]+)(?:\/tree\/([^/#?\s]+))?/i);
  if (url) return { owner: url[1], repo: url[2], ref: url[3] };

  const shorthand = s.match(/^([\w.-]+)\/([\w.-]+)(?:@([\w.\-/]+))?$/);
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2], ref: shorthand[3] };

  return null;
}

/**
 * Download a GitHub repo's default (or specified) branch as a ZIP.
 * @throws GithubError with a user-facing message.
 */
export async function fetchGithubZip(input: string, maxBytes: number): Promise<Uint8Array> {
  const target = parseGithubTarget(input);
  if (!target) {
    throw new GithubError("That doesn't look like a GitHub repository URL.");
  }

  const ref = target.ref ? `/${encodeURIComponent(target.ref)}` : "";
  const api = `https://api.github.com/repos/${target.owner}/${target.repo}/zipball${ref}`;

  let res: Response;
  try {
    res = await fetch(api, {
      headers: {
        "User-Agent": "ImpactIQ",
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      redirect: "follow",
    });
  } catch {
    throw new GithubError("Could not reach GitHub. Check the URL or try a ZIP upload.");
  }

  if (res.status === 404) throw new GithubError("Repository not found — is it private?");
  if (res.status === 403) {
    throw new GithubError("GitHub rate limit reached. Try again later or upload a ZIP.");
  }
  if (!res.ok) throw new GithubError(`GitHub returned ${res.status}.`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new GithubError(`Repository is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB).`);
  }
  return bytes;
}
