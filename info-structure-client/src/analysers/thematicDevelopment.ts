import type { Annotation, LevelId } from '../types';
import { splitIntoSentences } from './nlpUtils';

// Auxiliary and common main verbs used to locate the theme/rheme boundary
const VERB_RE =
  /^(is|are|was|were|has|have|had|will|would|could|should|may|might|must|can|do|does|did|seem|seems|seemed|appear|appears|appeared|remain|remains|remained|become|becomes|became|include|includes|included|contain|contains|show|shows|showed|suggest|suggests|indicated?|demonstrate[sd]?|require[sd]?|provide[sd]?|involve[sd]?|examine[sd]?|explore[sd]?|consider[sd]?|analyse[sd]?|analyze[sd]?|investigate[sd]?|reveal[sd]?|argue[sd]?|claim[sd]?|propose[sd]?|note[sd]?|find|finds|found|conclude[sd]?|explain[sd]?|describe[sd]?|represent[sd]?|reflect[sd]?|relate[sd]?|contribute[sd]?|affect[sd]?|influence[sd]?|increase[sd]?|decrease[sd]?|depend[sd]?|vary|varies|lead[sd]?|result[sd]?|make[sd]?|makes|use[sd]?|uses|develop[sd]?)s?$/i;

function findThemeEnd(sentText: string): number {
  const tokens: Array<{ word: string; start: number }> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentText)) !== null) tokens.push({ word: m[0], start: m.index });
  for (let i = 1; i < tokens.length - 1; i++) {
    const clean = tokens[i].word.replace(/[^a-zA-Z]/g, '');
    if (VERB_RE.test(clean)) return tokens[i].start;
  }
  return Math.floor(sentText.length * 0.35);
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'it', 'its',
  'this', 'that', 'these', 'those', 'they', 'them', 'their', 'he', 'she',
  'we', 'you', 'me', 'my', 'our', 'your', 'his', 'her', 'who', 'which',
  'what', 'when', 'where', 'how', 'also', 'not', 'no', 'so', 'if', 'then',
  'than', 'more', 'most', 'very', 'too', 'only', 'both', 'each', 'other',
  'some', 'any', 'all', 'there', 'here', 'however', 'although', 'because',
  'since', 'while', 'though', 'thus', 'hence', 'therefore', 'about',
  'into', 'after', 'before', 'between', 'through', 'over', 'well', 'just',
  'even', 'still', 'already', 'often', 'always', 'never', 'rather', 'quite',
  'simply', 'mainly', 'such', 'many', 'much', 'few', 'same', 'different',
]);

// Pronouns that typically signal anaphoric reference
const ANAPHORIC_PRONOUNS = new Set([
  'it', 'its', 'this', 'these', 'those', 'they', 'them', 'their', 'such',
  'here', 'there',
]);

function contentWordsOf(text: string): Set<string> {
  const result = new Set<string>();
  const re = /\b([a-zA-Z]{4,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lower = m[1].toLowerCase();
    if (!STOP_WORDS.has(lower)) result.add(lower);
  }
  return result;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const w of a) if (b.has(w)) return true;
  return false;
}

function startsWithAnaphor(themeText: string): boolean {
  const first = themeText.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? '';
  return ANAPHORIC_PRONOUNS.has(first);
}

interface SentData {
  theme:      { start: number; end: number; text: string };
  rheme:      { start: number; end: number; text: string };
  themeWords: Set<string>;
  rhemeWords: Set<string>;
}

export function analyseThematicDevelopment(text: string, activeLevels: Set<LevelId>): Annotation[] {
  if (!activeLevels.has('sentence')) return [];

  const annotations: Annotation[] = [];
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return annotations;

  // ── Build theme / rheme spans for every sentence ─────────────────────────
  const sentData: SentData[] = sentences.map(sent => {
    const splitPos = findThemeEnd(sent.text);
    const themeText = sent.text.slice(0, splitPos);
    const rhemeText = sent.text.slice(splitPos);
    return {
      theme:      { start: sent.start, end: sent.start + splitPos, text: themeText },
      rheme:      { start: sent.start + splitPos, end: sent.end, text: rhemeText },
      themeWords: contentWordsOf(themeText),
      rhemeWords: contentWordsOf(rhemeText),
    };
  });

  // ── Classify each theme relative to the previous sentence ────────────────
  type Role = 'theme-first' | 'constant-theme' | 'linear-theme'  | 'ruptured-theme';
  const roles: Role[] = sentData.map(() => 'theme-first');
  const chainIds: number[] = sentData.map(() => 1);
  let chain = 1;

  for (let i = 1; i < sentData.length; i++) {
    const curr = sentData[i];
    const prev = sentData[i - 1];
    const anaphor = startsWithAnaphor(curr.theme.text);

    const sameTheme  = overlaps(curr.themeWords, prev.themeWords);
    const fromRheme  = overlaps(curr.themeWords, prev.rhemeWords);

    if (sameTheme || (anaphor && !fromRheme)) {
      roles[i]    = 'constant-theme';
      chainIds[i] = chain;              // same chain continues
    } else if (fromRheme || anaphor) {
      chain++;
      roles[i]    = 'linear-theme';
      chainIds[i] = chain;
    } else {
      chain++;
      roles[i]    = 'ruptured-theme';
      chainIds[i] = chain;
    }
  }

  // ── Build annotations ─────────────────────────────────────────────────────
  const themeTooltips: Record<Role, string> = {
    'theme-first':
      `Theme (opening): the point of departure of the opening sentence — the entity or concept from which the discourse begins.`,
    'constant-theme':
      `Constant theme: this sentence departs from the same or closely related theme as the previous sentence. The same entity or topic is maintained as the point of departure, creating strong topical continuity.`,
    'linear-theme':
      `Linear theme (zig-zag progression): the theme of this sentence is drawn from the rheme of the previous sentence. This rheme→theme movement — T1→R1; T2(=R1)→R2 — advances the argument cohesively, carrying new information forward as the next starting point.`,
    'ruptured-theme':
      `Ruptured theme: this sentence introduces a theme with no clear lexical connection to the previous sentence's theme or rheme. This signals a potential topic break — consider whether a transitional phrase or bridging sentence would improve cohesion.`,
  };

  for (let i = 0; i < sentData.length; i++) {
    const { theme, rheme } = sentData[i];
    const role = roles[i];
    const chainId = chainIds[i];

    // Theme span
    if (theme.text.trim().length > 0) {
      annotations.push({
        start: theme.start,
        end: theme.end,
        layer: 'thematic-dev',
        level: 'sentence',
        role,
        chainId,
        tooltip: themeTooltips[role],
      });
    }

    // Rheme span — always annotate (shows what might become next theme)
    if (rheme.text.trim().length > 4) {
      annotations.push({
        start: rheme.start,
        end: rheme.end,
        layer: 'thematic-dev',
        level: 'sentence',
        role: 'rheme',
        chainId,
        tooltip: `Rheme: the informational content of the sentence — what is predicated of the theme. In developed (linear) thematic progression, content from the rheme is picked up as the theme of the next sentence.`,
      });
    }
  }

  return annotations;
}
