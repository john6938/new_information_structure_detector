import type { Annotation, LevelId } from '../types';
import { splitIntoSentences } from './nlpUtils';

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
  'since', 'while', 'though', 'thus', 'hence', 'therefore', 'about', 'into',
  'after', 'before', 'between', 'through', 'during', 'over', 'under',
  'above', 'below', 'well', 'just', 'even', 'still', 'already', 'often',
  'always', 'never', 'further', 'rather', 'quite', 'simply', 'merely',
  'largely', 'mainly', 'now', 'then', 'such', 'many', 'much', 'few',
  'their', 'same', 'different', 'first', 'second', 'last', 'next', 'new',
  'old', 'good', 'great', 'large', 'small', 'high', 'low', 'long', 'wide',
]);

function extractContentWordPositions(
  sentText: string,
  sentStart: number
): Array<{ word: string; start: number; end: number }> {
  const results: Array<{ word: string; start: number; end: number }> = [];
  const re = /\b([a-zA-Z]{4,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentText)) !== null) {
    const lower = m[1].toLowerCase();
    if (!STOP_WORDS.has(lower)) {
      results.push({
        word: lower,
        start: sentStart + m.index,
        end: sentStart + m.index + m[1].length,
      });
    }
  }
  return results;
}

export function analyseInformationFlow(text: string, activeLevels: Set<LevelId>): Annotation[] {
  const annotations: Annotation[] = [];
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return annotations;

  // ── Sentence-level: given / new content words ─────────────────────────────
  if (activeLevels.has('sentence')) {
    const seenWords = new Map<string, number>(); // word → chainId
    let nextChainId = 1;

    for (const sent of sentences) {
      const positions = extractContentWordPositions(sent.text, sent.start);

      for (const { word, start, end } of positions) {
        if (seenWords.has(word)) {
          const chainId = seenWords.get(word)!;
          annotations.push({
            start,
            end,
            layer: 'flow',
            level: 'sentence',
            role: 'given',
            chainId,
            tooltip: `Given information (chain #${chainId}): this concept was introduced earlier in the text. Its recurrence signals referential continuity and contributes to discourse cohesion.`,
          });
        } else {
          const chainId = nextChainId++;
          seenWords.set(word, chainId);
          annotations.push({
            start,
            end,
            layer: 'flow',
            level: 'sentence',
            role: 'new',
            chainId,
            tooltip: `New information (chain #${chainId}): this concept is introduced here for the first time. In well-structured prose, new information typically appears in sentence-final position.`,
          });
        }
      }

      // Mark anaphoric pronouns and demonstratives (not sentence-initial)
      const anaphorRe = /\b(it|its|this|these|those|they|them|their|such)\b/gi;
      let am: RegExpExecArray | null;
      while ((am = anaphorRe.exec(sent.text)) !== null) {
        if (am.index < 3) continue; // skip sentence-initial position
        annotations.push({
          start: sent.start + am.index,
          end: sent.start + am.index + am[0].length,
          layer: 'flow',
          level: 'sentence',
          role: 'pronoun-ref',
          tooltip: `Anaphoric reference: "${am[0]}" refers back to a previously mentioned entity or concept, linking sentences into a coherent discourse chain.`,
        });
      }
    }
  }

  // ── Phrase-level: definite = given, indefinite = new ─────────────────────
  if (activeLevels.has('phrase')) {
    // Definite NPs → given information
    const defRe = /\bthe\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\b/g;
    let dm: RegExpExecArray | null;
    while ((dm = defRe.exec(text)) !== null) {
      annotations.push({
        start: dm.index,
        end: dm.index + dm[0].length,
        layer: 'flow',
        level: 'phrase',
        role: 'given',
        tooltip: `Definite NP: "the" signals that the referent is recoverable from context — the reader is expected to identify the entity. Definite NPs typically encode given (already established) information.`,
      });
    }

    // Indefinite NPs → new information
    const indefRe = /\b(a|an)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\b/g;
    let im: RegExpExecArray | null;
    while ((im = indefRe.exec(text)) !== null) {
      annotations.push({
        start: im.index,
        end: im.index + im[0].length,
        layer: 'flow',
        level: 'phrase',
        role: 'new',
        tooltip: `Indefinite NP: "a/an" introduces a referent for the first time — this is typically new information being added to the discourse.`,
      });
    }
  }

  // ── Clause-level: topic continuity across sentences ───────────────────────
  if (activeLevels.has('clause') && sentences.length >= 2) {
    // Track the subject of each sentence (approx: first NP)
    let prevSubject = '';
    let chainId = 0;

    for (const sent of sentences) {
      // Approximate subject: first 1–3 words before first verb
      const subjectMatch = sent.text.match(/^([A-Za-z][\w\s]{2,30}?)\s+(?:is|are|was|were|has|have|had|will|would|can|could|may|might|should)\b/);
      const currentSubject = subjectMatch
        ? subjectMatch[1].toLowerCase().trim()
        : sent.text.split(/\s+/).slice(0, 2).join(' ').toLowerCase();

      if (
        prevSubject &&
        currentSubject &&
        (currentSubject.includes(prevSubject.slice(0, 6)) ||
          prevSubject.includes(currentSubject.slice(0, 6)))
      ) {
        // Topic is maintained — annotate the sentence-initial subject span
        const subEnd = subjectMatch
          ? sent.start + subjectMatch[1].length
          : sent.start + currentSubject.length;
        annotations.push({
          start: sent.start,
          end: subEnd,
          layer: 'flow',
          level: 'clause',
          role: 'given',
          chainId,
          tooltip: `Topic continuity (chain #${chainId}): the subject of this sentence continues the topic of the previous sentence. Maintained topics typically appear in subject position, encoding given information.`,
        });
      } else {
        // Topic shift
        chainId++;
        const subEnd = subjectMatch
          ? sent.start + subjectMatch[1].length
          : sent.start + currentSubject.length;
        if (prevSubject) {
          annotations.push({
            start: sent.start,
            end: subEnd,
            layer: 'flow',
            level: 'clause',
            role: 'new',
            chainId,
            tooltip: `Topic shift (chain #${chainId}): the sentence introduces a new topic or discourse referent in subject position. Topic shifts mark the introduction of new information into the discourse frame.`,
          });
        }
      }
      prevSubject = currentSubject;
    }
  }

  return annotations;
}
