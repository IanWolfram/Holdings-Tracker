import { createServiceClient } from "@/lib/supabase/server";

export interface VaultNote {
  id: string;
  path: string;
  body: string;
  frontmatter: Record<string, unknown>;
  updatedAt: string;
}

/**
 * Abstraction over vault storage — filesystem or Postgres.
 * All methods are async because the Postgres backend requires it.
 */
export interface VaultStore {
  /** Read full file content (including YAML frontmatter). Returns null if not found. */
  read(path: string): Promise<string | null>;
  /** Write content. If frontmatter is not provided, it's auto-parsed from YAML in the content. */
  write(path: string, body: string, frontmatter?: Record<string, unknown>): Promise<void>;
  /** List filenames under a prefix (directory-like). */
  list(prefix: string): Promise<string[]>;
  /** Check if a note exists. */
  exists(path: string): Promise<boolean>;
  /** Delete a note. */
  delete(path: string): Promise<void>;
  /** Read structured note — body (without frontmatter) and parsed frontmatter. */
  readNote(path: string): Promise<VaultNote | null>;
  /** List notes under a prefix with their frontmatter for efficient bulk access. */
  listNotes(prefix: string): Promise<VaultNote[]>;
  /** Append content to an existing note (for log-style files). */
  append(path: string, content: string): Promise<void>;
}

// ── Shared frontmatter helpers ──

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { frontmatter, body } where body is the content after the --- delimiters.
 */
export function splitFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fm: Record<string, unknown> = {};
  let currentListKey: string | null = null;

  for (const line of match[1].split("\n")) {
    if (currentListKey && /^\s+-\s+/.test(line)) {
      const value = line.replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, "");
      const arr = fm[currentListKey];
      if (Array.isArray(arr)) arr.push(value);
      else (fm as Record<string, unknown>)[currentListKey] = [value];
      continue;
    }
    currentListKey = null;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    if (!key) continue;
    if (raw === "" || raw === "|" || raw === ">") {
      currentListKey = key;
      fm[key] = [];
      continue;
    }
    let value: unknown = raw.replace(/^["']|["']$/g, "");
    try { value = JSON.parse(value as string); } catch { /* keep as string */ }
    fm[key] = value;
  }

  return { frontmatter: fm, body: match[2] };
}

/**
 * Serialize a frontmatter object back to YAML-ish format for reconstruction.
 * This is a best-effort serializer — it handles the types we store, not arbitrary YAML.
 */
export function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${typeof item === "string" ? item : JSON.stringify(item)}`);
      }
    } else if (typeof value === "object") {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === "string") {
      if (value.includes(":") || value.includes("#") || value.includes('"') || value.includes("'")) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  return lines.join("\n");
}

/**
 * Reconstruct a full markdown file from body and frontmatter.
 */
export function reconstructMarkdown(body: string, frontmatter: Record<string, unknown>): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return body;
  return `---\n${serializeFrontmatter(frontmatter)}\n---\n${body}`;
}

// ── Filesystem implementation (single-user / Personal Mode) ──

import fs from "fs";
import { resolveVaultPath } from "@/lib/constants";
import nodePath from "path";

/** @deprecated Use SupabaseVaultStore via getVaultStore(userId) instead. FsVaultStore is only for local CLI scripts. */
export class FsVaultStore implements VaultStore {
  private root: string;

  constructor(vaultPath: string) {
    const resolved = resolveVaultPath(vaultPath);
    if (!resolved) throw new Error(`Cannot resolve vault path: ${vaultPath}`);
    this.root = resolved;
  }

  private full(p: string): string {
    const joined = nodePath.resolve(this.root, p);
    const rootWithSep = this.root.endsWith(nodePath.sep) ? this.root : this.root + nodePath.sep;
    if (joined !== this.root && !joined.startsWith(rootWithSep)) {
      throw new Error(`Vault path escapes root: ${p}`);
    }
    return joined;
  }

  async read(p: string): Promise<string | null> {
    try {
      return fs.readFileSync(this.full(p), "utf-8");
    } catch {
      return null;
    }
  }

  async write(p: string, body: string, _frontmatter?: Record<string, unknown>): Promise<void> {
    const full = this.full(p);
    fs.mkdirSync(nodePath.dirname(full), { recursive: true });
    const tmp = full + ".tmp";
    fs.writeFileSync(tmp, body, "utf-8");
    fs.renameSync(tmp, full);
  }

  async list(prefix: string): Promise<string[]> {
    const dir = this.full(prefix);
    try {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir, { withFileTypes: true }).map((e) => e.name);
    } catch {
      return [];
    }
  }

  async exists(p: string): Promise<boolean> {
    return fs.existsSync(this.full(p));
  }

  async delete(p: string): Promise<void> {
    try { fs.unlinkSync(this.full(p)); } catch { /* ignore */ }
  }

  async readNote(p: string): Promise<VaultNote | null> {
    const content = await this.read(p);
    if (content === null) return null;
    const { frontmatter, body } = splitFrontmatter(content);
    const stat = fs.statSync(this.full(p));
    return {
      id: p,
      path: p,
      body,
      frontmatter,
      updatedAt: stat.mtime.toISOString(),
    };
  }

  async listNotes(prefix: string): Promise<VaultNote[]> {
    const names = await this.list(prefix);
    const notes: VaultNote[] = [];
    for (const name of names) {
      if (!name.endsWith(".md") && !name.endsWith(".json")) continue;
      const notePath = prefix ? `${prefix}/${name}` : name;
      const note = await this.readNote(notePath);
      if (note) notes.push(note);
    }
    return notes;
  }

  async append(p: string, content: string): Promise<void> {
    const full = this.full(p);
    fs.mkdirSync(nodePath.dirname(full), { recursive: true });
    if (!fs.existsSync(full)) {
      fs.writeFileSync(full, content, "utf-8");
    } else {
      fs.appendFileSync(full, content, "utf-8");
    }
  }
}

// ── Supabase implementation (multi-tenant / Cloud Mode) ──

/** PostgREST caps a single select at 1,000 rows; page in chunks of this size. */
const SUPABASE_PAGE_SIZE = 1000;

export class SupabaseVaultStore implements VaultStore {
  constructor(private userId: string) {}

  /**
   * Select every row matching a path prefix, paging past PostgREST's 1,000-row
   * cap. Ordered by path so pages are stable; without this, prefixes holding
   * more than 1,000 notes (e.g. news/) silently lose an arbitrary subset.
   */
  private async selectAllByPrefix<T>(columns: string, prefix: string): Promise<T[]> {
    const supabase = createServiceClient();
    const rows: T[] = [];
    for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("vault_notes")
        .select(columns)
        .eq("user_id", this.userId)
        .like("path", `${prefix}%`)
        .order("path", { ascending: true })
        .range(from, from + SUPABASE_PAGE_SIZE - 1);
      if (error || !data) break;
      rows.push(...(data as T[]));
      if (data.length < SUPABASE_PAGE_SIZE) break;
    }
    return rows;
  }

  async read(p: string): Promise<string | null> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("vault_notes")
      .select("body, frontmatter")
      .eq("user_id", this.userId)
      .eq("path", p)
      .single();

    if (error || !data) return null;
    return reconstructMarkdown(data.body, data.frontmatter as Record<string, unknown>);
  }

  async write(p: string, body: string, frontmatter?: Record<string, unknown>): Promise<void> {
    // Auto-parse frontmatter from content if not explicitly provided
    const parsed = frontmatter
      ? { frontmatter, body }
      : splitFrontmatter(body);

    const supabase = createServiceClient();
    const { error } = await supabase.from("vault_notes").upsert(
      {
        user_id: this.userId,
        path: p,
        body: parsed.body,
        frontmatter: parsed.frontmatter,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,path" },
    );

    if (error) throw new Error(`Failed to write vault note ${p}: ${error.message}`);
  }

  async list(prefix: string): Promise<string[]> {
    const data = await this.selectAllByPrefix<{ path: string }>("path", prefix);
    // Strip prefix and return just the next path segment (filename or first dir)
    const seen = new Set<string>();
    return data.map((row) => {
      const relative = row.path.slice(prefix.length + (prefix.endsWith("/") ? 0 : 1));
      return relative.split("/")[0];
    }).filter((name) => name && !seen.has(name) && seen.add(name));
  }

  async exists(p: string): Promise<boolean> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("vault_notes")
      .select("id")
      .eq("user_id", this.userId)
      .eq("path", p)
      .single();
    return !error && !!data;
  }

  async delete(p: string): Promise<void> {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("vault_notes")
      .delete()
      .eq("user_id", this.userId)
      .eq("path", p);
    if (error) throw new Error(`Failed to delete vault note ${p}: ${error.message}`);
  }

  async readNote(p: string): Promise<VaultNote | null> {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("vault_notes")
      .select("id, path, body, frontmatter, updated_at")
      .eq("user_id", this.userId)
      .eq("path", p)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      path: data.path,
      body: data.body,
      frontmatter: (data.frontmatter as Record<string, unknown>) ?? {},
      updatedAt: data.updated_at,
    };
  }

  async listNotes(prefix: string): Promise<VaultNote[]> {
    const data = await this.selectAllByPrefix<{
      id: string;
      path: string;
      body: string;
      frontmatter: unknown;
      updated_at: string;
    }>("id, path, body, frontmatter, updated_at", prefix);
    return data.map((row) => ({
      id: row.id,
      path: row.path,
      body: row.body,
      frontmatter: (row.frontmatter as Record<string, unknown>) ?? {},
      updatedAt: row.updated_at,
    }));
  }

  async append(p: string, content: string): Promise<void> {
    // Supabase doesn't have a native append, so read-modify-write
    const existing = await this.read(p);
    const updated = existing === null ? content : existing + content;
    await this.write(p, updated);
  }
}

// ── Factory ──

export async function getVaultStore(userId: string): Promise<VaultStore> {
  return new SupabaseVaultStore(userId);
}