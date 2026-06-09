/**
 * Roster join — fills `party` + `bioguide_id` on parsed trade rows.
 *
 * Source: `@unitedstates/congress-legislators` (current + historical), the
 * canonical open dataset of every member with bioguide id, party, chamber,
 * state, and district. We index it and resolve each filing's member by the
 * **stable seat identifier** (House: state+district; Senate: state) with a
 * last-name fallback — keying on the seat avoids name-variant misses.
 *
 * House PTRs carry `StateDst` (e.g. "AL04") in the XML index; Senate search
 * rows carry only the member name, so Senate resolves by name (+ chamber).
 * One member files one PTR, so resolution is per-filing, not per-row.
 */

import type { Party } from "./types";

const ROSTER_BASE = "https://unitedstates.github.io/congress-legislators";
const UA = "PulseHoldingsTracker/1.0 (+congress disclosure ingest)";

export interface RosterMatch {
  bioguideId: string;
  party: Party | null;
}

interface Term {
  type: string; // "rep" | "sen"
  state: string;
  district?: number;
  party?: string;
  start?: string;
  end?: string;
}
interface Legislator {
  id: { bioguide: string };
  name: { first: string; last: string; official_full?: string };
  terms: Term[];
}

function normParty(p: string | undefined): Party | null {
  if (!p) return null;
  if (/^republican/i.test(p)) return "R";
  if (/^democrat/i.test(p)) return "D";
  return "I"; // Independent / minor parties / caucusing independents
}

/** Normalize a surname for matching: drop diacritics, suffixes, punctuation. */
function normLast(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z]/g, "")
    .trim();
}

/** Party from the member's most recent term (their current/final affiliation). */
function latestParty(leg: Legislator): Party | null {
  for (let i = leg.terms.length - 1; i >= 0; i--) {
    const p = normParty(leg.terms[i].party);
    if (p) return p;
  }
  return null;
}

export class Roster {
  private repSeat = new Map<string, Legislator[]>(); // `${state}${district}`
  private byLast = new Map<string, Legislator[]>(); // normalized last name

  constructor(legislators: Legislator[]) {
    for (const leg of legislators) {
      if (!leg?.id?.bioguide || !leg.terms?.length) continue;
      push(this.byLast, normLast(leg.name.last), leg);
      for (const t of leg.terms) {
        if (t.type === "rep") push(this.repSeat, `${t.state}${t.district ?? 0}`, leg);
      }
    }
  }

  /** House: join on state+district (from "AL04"), disambiguate by last name. */
  resolveHouse(stateDst: string, lastName: string): RosterMatch | null {
    const m = stateDst.match(/^([A-Z]{2})(\d+)$/);
    const last = normLast(lastName);
    let candidates: Legislator[] = [];
    if (m) candidates = this.repSeat.get(`${m[1]}${parseInt(m[2], 10)}`) ?? [];

    let pick = disambiguate(candidates, last);
    // Fallback: name match among reps in the same state (redistricting, typos).
    if (!pick && m) {
      pick = disambiguate(
        (this.byLast.get(last) ?? []).filter((l) =>
          l.terms.some((t) => t.type === "rep" && t.state === m[1]),
        ),
        last,
      );
    }
    if (!pick) pick = disambiguate(this.byLast.get(last) ?? [], last, "rep");
    return pick ? { bioguideId: pick.id.bioguide, party: latestParty(pick) } : null;
  }

  /** Senate: join by last name among senators, disambiguate by first name. */
  resolveSenate(firstName: string, lastName: string): RosterMatch | null {
    const last = normLast(lastName);
    const senators = (this.byLast.get(last) ?? []).filter((l) =>
      l.terms.some((t) => t.type === "sen"),
    );
    let pick: Legislator | undefined;
    if (senators.length === 1) pick = senators[0];
    else if (senators.length > 1) {
      const fi = firstName.trim().toLowerCase()[0];
      pick =
        senators.find((l) => l.name.first.toLowerCase().startsWith(firstName.trim().toLowerCase())) ??
        senators.find((l) => l.name.first.toLowerCase()[0] === fi) ??
        mostRecent(senators);
    }
    return pick ? { bioguideId: pick.id.bioguide, party: latestParty(pick) } : null;
  }
}

function push<T>(map: Map<string, T[]>, key: string, val: T): void {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}

/** Choose one legislator from candidates, preferring a last-name match then recency. */
function disambiguate(candidates: Legislator[], last: string, requireType?: string): Legislator | undefined {
  let pool = candidates;
  if (requireType) pool = pool.filter((l) => l.terms.some((t) => t.type === requireType));
  if (pool.length === 0) return undefined;
  if (pool.length === 1) return pool[0];
  const byName = pool.filter((l) => normLast(l.name.last) === last);
  if (byName.length === 1) return byName[0];
  return mostRecent(byName.length ? byName : pool);
}

/** Pick the legislator with the latest-ending term. */
function mostRecent(pool: Legislator[]): Legislator {
  return pool.reduce((best, l) => {
    const e = l.terms.at(-1)?.end ?? "";
    const be = best.terms.at(-1)?.end ?? "";
    return e > be ? l : best;
  });
}

/** Fetch + parse current and historical legislators and build the index. */
export async function loadRoster(): Promise<Roster> {
  const fetchOne = async (name: string): Promise<Legislator[]> => {
    const res = await fetch(`${ROSTER_BASE}/${name}`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`[congress/roster] ${name} → HTTP ${res.status}`);
    return (await res.json()) as Legislator[];
  };
  const [current, historical] = await Promise.all([
    fetchOne("legislators-current.json"),
    fetchOne("legislators-historical.json"),
  ]);
  // Current first so it wins on equal-recency ties.
  return new Roster([...current, ...historical]);
}
