import { callMlxRaw } from "./brain";
import { CATALYST_TYPES, type CatalystType } from "../types/predictions";

export interface CatalystClassificationInput {
  headline?: string;
  summary?: string;
  reason?: string;
  verdict?: string;
}

const CATALYST_RULES: Array<{ type: CatalystType; patterns: RegExp[] }> = [
  {
    type: "govt-contract",
    patterns: [
      /\b(contract|award|awarded|procurement|government|federal|pentagon|dod|nasa|usda|agency)\b/i,
    ],
  },
  {
    type: "analyst-upgrade",
    patterns: [
      /\b(upgrade|upgraded|raises?\s+price\s+target|reiterates?\s+buy|outperform|overweight)\b/i,
    ],
  },
  {
    type: "analyst-downgrade",
    patterns: [
      /\b(downgrade|downgraded|cuts?\s+price\s+target|underperform|underweight|neutral\s+rating)\b/i,
    ],
  },
  {
    type: "earnings-beat",
    patterns: [
      /\b(earnings\s+beat|beats?\s+expectations|beats?\s+estimates|raises?\s+guidance|revenue\s+beat)\b/i,
    ],
  },
  {
    type: "earnings-miss",
    patterns: [
      /\b(earnings\s+miss|misses?\s+expectations|misses?\s+estimates|cuts?\s+guidance|guidance\s+cut)\b/i,
    ],
  },
  {
    type: "regulatory",
    patterns: [
      /\b(sec|cftc|doj|regulator|regulatory|lawsuit|sues?|investigation|probe|approval|license|ban|antitrust)\b/i,
    ],
  },
  {
    type: "m-and-a",
    patterns: [
      /\b(acquisition|acquire|acquires|acquired|merger|merge|buyout|takeover)\b/i,
    ],
  },
  {
    type: "macro",
    patterns: [
      /\b(cpi|inflation|fomc|fed|interest\s+rate|rates|yield|payrolls|gdp|recession|dxy|macro)\b/i,
    ],
  },
  {
    type: "technical",
    patterns: [
      /\b(rsi|sma|moving\s+average|breakout|support|resistance|technical|chart)\b/i,
    ],
  },
  {
    type: "leadership",
    patterns: [
      /\b(ceo|cfo|chairman|executive|founder|resign|resigns|resigned|appoint|appointed|management\s+change)\b/i,
    ],
  },
  {
    type: "product-launch",
    patterns: [
      /\b(launch|launches|launched|unveil|unveils|release|releases|rollout|introduce|introduced|beta)\b/i,
    ],
  },
  {
    type: "partnership",
    patterns: [
      /\b(partnership|partners?\s+with|collaboration|joint\s+venture|alliance|integrat(e|ion)\s+with)\b/i,
    ],
  },
];

const CATALYST_TYPE_SET = new Set<string>(CATALYST_TYPES);

function normalizeCatalystType(value: string): CatalystType | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  const aliases: Record<string, CatalystType> = {
    "government-contract": "govt-contract",
    "gov-contract": "govt-contract",
    "analyst-raise": "analyst-upgrade",
    "analyst-cut": "analyst-downgrade",
    "earnings-upside": "earnings-beat",
    "earnings-downside": "earnings-miss",
    "m&a": "m-and-a",
    "m-and-a": "m-and-a",
    "product": "product-launch",
  };

  const candidate = aliases[normalized] ?? normalized;
  return CATALYST_TYPE_SET.has(candidate) ? (candidate as CatalystType) : null;
}

function sortedUnique(types: Iterable<CatalystType>): CatalystType[] {
  const unique = [...new Set(types)];
  unique.sort((a, b) => CATALYST_TYPES.indexOf(a) - CATALYST_TYPES.indexOf(b));
  return unique;
}

function buildText(input: CatalystClassificationInput): string {
  return [input.headline, input.summary, input.reason, input.verdict]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n")
    .trim();
}

export function classifyCatalystTypes(input: CatalystClassificationInput): CatalystType[] {
  const text = buildText(input);
  if (!text) return ["other"];

  const hits: CatalystType[] = [];
  for (const rule of CATALYST_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      hits.push(rule.type);
    }
  }

  if (hits.length > 0) {
    return sortedUnique(hits);
  }

  const verdict = input.verdict?.toUpperCase();
  if (verdict === "BUY" || verdict === "SELL") {
    return ["technical"];
  }

  return ["other"];
}

export async function classifyCatalystTypesWithModelFallback(
  input: CatalystClassificationInput
): Promise<CatalystType[]> {
  const regexTypes = classifyCatalystTypes(input);
  if (!(regexTypes.length === 1 && regexTypes[0] === "other")) {
    return regexTypes;
  }

  const text = buildText(input);
  if (!text) return regexTypes;

  const systemPrompt =
    "Classify stock-news catalysts using only this enum: " +
    CATALYST_TYPES.join(", ") +
    ". Return strict JSON array, e.g. [\"govt-contract\",\"analyst-upgrade\"].";

  const userMessage = `Text:\n${text}\n\nOutput JSON array only.`;
  const raw = await callMlxRaw(systemPrompt, userMessage);
  if (!raw) return regexTypes;

  try {
    const first = raw.indexOf("[");
    const last = raw.lastIndexOf("]");
    if (first === -1 || last === -1 || last <= first) return regexTypes;
    const parsed = JSON.parse(raw.slice(first, last + 1)) as unknown;
    if (!Array.isArray(parsed)) return regexTypes;

    const normalized = parsed
      .map((value) => (typeof value === "string" ? normalizeCatalystType(value) : null))
      .filter((value): value is CatalystType => value !== null);

    return normalized.length > 0 ? sortedUnique(normalized) : regexTypes;
  } catch {
    return regexTypes;
  }
}