import type { Annotation, LevelId } from '../types';
import { splitIntoSentences, complexityScore } from './nlpUtils';

// Common auxiliaries and main verbs found in academic prose
const VERB_RE =
  /^(is|are|was|were|has|have|had|will|would|could|should|may|might|must|can|do|does|did|seem|seems|seemed|appear|appears|appeared|remain|remains|remained|become|becomes|became|include|includes|included|contain|contains|contained|show|shows|showed|suggest|suggests|suggested|indicate|indicates|indicated|demonstrate|demonstrates|demonstrated|require|requires|required|provide|provides|provided|enable|enables|enabled|allow|allows|allowed|involve|involves|involved|identify|identifies|identified|examine|examines|examined|explore|explores|explored|consider|considers|considered|analyse|analyses|analysed|analyze|analyzes|analyzed|investigate|investigates|investigated|reveal|reveals|revealed|highlight|highlights|highlighted|argue|argues|argued|claim|claims|claimed|propose|proposes|proposed|note|notes|noted|find|finds|found|conclude|concludes|concluded|explain|explains|explained|describe|describes|described|represent|represents|represented|reflect|reflects|reflected|focus|focuses|focused|relate|relates|related|contribute|contributes|contributed|affect|affects|affected|influence|influences|influenced|increase|increases|increased|decrease|decreases|decreased|improve|improves|improved|reduce|reduces|reduced|depend|depends|depended|vary|varies|varied|differ|differs|differed|result|results|resulted|lead|leads|led|play|plays|played|make|makes|made|take|takes|took|give|gives|gave|help|helps|helped|use|uses|used|form|forms|formed|develop|develops|developed)s?$/i;

function findVerbSplitPos(sentText: string): number {
  const tokens: Array<{ word: string; start: number }> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentText)) !== null) {
    tokens.push({ word: m[0], start: m.index });
  }

  // Search from 2nd token onward (skip sentence-initial word)
  for (let i = 1; i < tokens.length - 1; i++) {
    const clean = tokens[i].word.replace(/[^a-zA-Z]/g, '');
    if (VERB_RE.test(clean)) {
      return tokens[i].start;
    }
  }

  // Fallback: roughly 35% into sentence (subjects tend to be shorter than predicates)
  return Math.floor(sentText.length * 0.35);
}

export function analyseEndWeight(text: string, activeLevels: Set<LevelId>): Annotation[] {
  const annotations: Annotation[] = [];
  const sentences = splitIntoSentences(text);

  for (const sent of sentences) {
    const wordCount = sent.text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 6) continue;

    // ── Sentence level ────────────────────────────────────────────────────────
    if (activeLevels.has('sentence')) {
      const verbPos = findVerbSplitPos(sent.text);
      const initial = sent.text.slice(0, verbPos);
      const final = sent.text.slice(verbPos);

      const initWords = initial.trim().split(/\s+/).filter(Boolean).length;
      const finalWords = final.trim().split(/\s+/).filter(Boolean).length;

      if (initWords >= 3 && finalWords >= 3) {
        const initScore = complexityScore(initial);
        const finalScore = complexityScore(final);

        if (initScore > finalScore * 1.35) {
          annotations.push({
            start: sent.start,
            end: sent.start + verbPos,
            layer: 'end-weight',
            level: 'sentence',
            role: 'heavy-initial',
            tooltip: `End-weight concern: this opening constituent (complexity ${Math.round(initScore)}) is heavier than what follows (${Math.round(finalScore)}). In English, heavier constituents are expected sentence-finally. Consider restructuring so that the more complex material appears at the end.`,
          });
        } else if (finalScore > initScore * 1.35 && finalWords >= 4) {
          annotations.push({
            start: sent.start + verbPos,
            end: sent.end,
            layer: 'end-weight',
            level: 'sentence',
            role: 'heavy-final',
            tooltip: `Good end-weight: the sentence-final constituent (complexity ${Math.round(finalScore)}) is appropriately heavier than the opening (${Math.round(initScore)}). This light-to-heavy progression supports readability and places informational weight where readers expect it.`,
          });
        }
      }
    }

    // ── Clause level ─────────────────────────────────────────────────────────
    if (activeLevels.has('clause')) {
      // Sentence-initial adverbial clause: "Although X, Y"
      const subMatch = sent.text.match(
        /^(Although|Though|Even though|While|Whereas|Since|Because|If|Unless|When|Before|After)\b(.{10,}?),\s*/i
      );
      if (subMatch) {
        const subClause = subMatch[0];
        const mainClause = sent.text.slice(subMatch[0].length);
        const subScore = complexityScore(subClause);
        const mainScore = complexityScore(mainClause);
        if (subScore > mainScore * 1.25) {
          annotations.push({
            start: sent.start,
            end: sent.start + subClause.length,
            layer: 'end-weight',
            level: 'clause',
            role: 'heavy-initial',
            tooltip: `Clause end-weight: the initial subordinate clause (complexity ${Math.round(subScore)}) is heavier than the main clause (${Math.round(mainScore)}). A shorter subordinate clause before a longer main clause would improve end-weight balance.`,
          });
        }
      }

      // Heavy medial relative clause (interrupts the main clause)
      const relRe = /,\s*(which|who|that)\s+([^,]{25,}),/gi;
      let rm: RegExpExecArray | null;
      while ((rm = relRe.exec(sent.text)) !== null) {
        const relScore = complexityScore(rm[0]);
        const remainder = sent.text.slice(0, rm.index) + sent.text.slice(rm.index + rm[0].length);
        const mainScore = complexityScore(remainder);
        if (relScore > mainScore * 0.55) {
          annotations.push({
            start: sent.start + rm.index,
            end: sent.start + rm.index + rm[0].length,
            layer: 'end-weight',
            level: 'clause',
            role: 'heavy-initial',
            tooltip: `Heavy embedded clause: this relative clause (complexity ${Math.round(relScore)}) interrupts the main clause, increasing processing load. Moving it to the end of the sentence would improve information flow.`,
          });
        }
      }
    }

    // ── Phrase level ─────────────────────────────────────────────────────────
    if (activeLevels.has('phrase')) {
      // Detect heavily pre-modified NPs: Det + 3+ modifiers + nominalized head
      const heavyNPRe =
        /\b(?:the|a|an|this|these|those|such|each|every)\s+(?:[a-z][\w-]*\s+){3,}[a-z]+(?:ion|ity|ment|ness|ance|ence|ing|tion|al|ism|ist)\b/gi;
      let nm: RegExpExecArray | null;
      while ((nm = heavyNPRe.exec(sent.text)) !== null) {
        const npWordCount = nm[0].trim().split(/\s+/).length;
        if (npWordCount >= 5) {
          annotations.push({
            start: sent.start + nm.index,
            end: sent.start + nm.index + nm[0].length,
            layer: 'end-weight',
            level: 'phrase',
            role: 'heavy-initial',
            tooltip: `Heavy pre-modification: this noun phrase (${npWordCount} words) stacks multiple pre-modifiers before the head noun. Consider post-modifying with a relative clause or prepositional phrase instead, to ease processing.`,
          });
        }
      }
    }
  }

  return annotations;
}
