import {
  splitFrontmatter,
  reconstructMarkdown,
  type VaultNote,
  type VaultStore,
} from "@/lib/vault/store";
import type { PredictionStore } from "@/lib/predictions/store";

/**
 * Map-backed VaultStore for tests. Mirrors SupabaseVaultStore semantics:
 * write() auto-parses frontmatter when not supplied, read() reconstructs the
 * full markdown, listNotes*() filter by path prefix.
 *
 * By default it has NO predictionStore(), so prediction functions use the JSON
 * path (matching FsVaultStore). Pass a PredictionStore to exercise the
 * table-delegation branch instead.
 */
export class InMemoryVaultStore implements VaultStore {
  private notes = new Map<string, { body: string; frontmatter: Record<string, unknown>; updatedAt: string }>();

  constructor(private predictions?: PredictionStore) {}

  predictionStore(): PredictionStore | undefined {
    return this.predictions;
  }

  async read(p: string): Promise<string | null> {
    const note = this.notes.get(p);
    if (!note) return null;
    return reconstructMarkdown(note.body, note.frontmatter);
  }

  async write(p: string, body: string, frontmatter?: Record<string, unknown>): Promise<void> {
    const parsed = frontmatter ? { frontmatter, body } : splitFrontmatter(body);
    this.notes.set(p, {
      body: parsed.body,
      frontmatter: parsed.frontmatter,
      updatedAt: new Date().toISOString(),
    });
  }

  async list(prefix: string): Promise<string[]> {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of this.notes.keys()) {
      if (!p.startsWith(prefix)) continue;
      const relative = p.slice(prefix.length + (prefix.endsWith("/") ? 0 : 1));
      const name = relative.split("/")[0];
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
    return out;
  }

  async exists(p: string): Promise<boolean> {
    return this.notes.has(p);
  }

  async delete(p: string): Promise<void> {
    this.notes.delete(p);
  }

  async readNote(p: string): Promise<VaultNote | null> {
    const note = this.notes.get(p);
    if (!note) return null;
    return { id: p, path: p, body: note.body, frontmatter: note.frontmatter, updatedAt: note.updatedAt };
  }

  async listNotes(prefix: string): Promise<VaultNote[]> {
    const out: VaultNote[] = [];
    for (const [p, note] of this.notes) {
      if (!p.startsWith(prefix)) continue;
      out.push({ id: p, path: p, body: note.body, frontmatter: note.frontmatter, updatedAt: note.updatedAt });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async listNotesMeta(prefix: string): Promise<VaultNote[]> {
    return (await this.listNotes(prefix)).map((n) => ({ ...n, body: "" }));
  }

  async append(p: string, content: string): Promise<void> {
    const existing = await this.read(p);
    await this.write(p, existing === null ? content : existing + content);
  }
}
