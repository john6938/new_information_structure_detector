import type { Annotation, LevelId } from '../types';
import { splitIntoSentences } from './nlpUtils';

const EMPHASIS_MARKERS = [
  'particularly', 'especially', 'notably', 'crucially', 'importantly',
  'significantly', 'primarily', 'mainly', 'chiefly', 'fundamentally',
  'essentially', 'centrally', 'above all', 'most importantly', 'critically',
  'specifically', 'precisely', 'exactly', 'indeed', 'in particular',
  'above all', 'first and foremost', 'most significantly',
];

const CONTRAST_MARKERS = [
  'however', 'nevertheless', 'nonetheless', 'yet', 'still',
  'whereas', 'although', 'though', 'even though', 'by contrast',
  'on the contrary', 'on the other hand', 'conversely', 'rather',
  'instead', 'despite', 'in spite of', 'notwithstanding',
  'in contrast', 'that said', 'having said that',
];

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

export function analyseInformationFocus(text: string, activeLevels: Set<LevelId>): Annotation[] {
  const annotations: Annotation[] = [];
  const sentences = splitIntoSentences(text);

  for (const sent of sentences) {

    // ── Cleft constructions ───────────────────────────────────────────────────
    if (activeLevels.has('sentence') || activeLevels.has('clause')) {
      const cleftRe = /\b[Ii]t\s+(?:is|was|were|has been)\s+(.{3,60}?)\s+(?:that|who|which)\b/g;
      let m: RegExpExecArray | null;
      while ((m = cleftRe.exec(sent.text)) !== null) {
        annotations.push({
          start: sent.start + m.index,
          end: sent.start + m.index + m[0].length,
          layer: 'focus',
          level: 'clause',
          role: 'cleft',
          tooltip: `Cleft construction: "It is/was … that/who" brings the highlighted element into focal prominence by extracting it from the clause. This structure explicitly marks information focus and is typically used to contrast or emphasise key material.`,
        });
      }
    }

    // ── Passive voice ─────────────────────────────────────────────────────────
    if (activeLevels.has('sentence') || activeLevels.has('clause')) {
      const passiveRe =
        /\b(?:is|are|was|were|has been|have been|had been|will be|would be|can be|could be|should be|may be|might be)\s+\w+(?:ed|en|wn|lt|ught|nt)\b/gi;
      let m: RegExpExecArray | null;
      while ((m = passiveRe.exec(sent.text)) !== null) {
        annotations.push({
          start: sent.start + m.index,
          end: sent.start + m.index + m[0].length,
          layer: 'focus',
          level: 'clause',
          role: 'passive',
          tooltip: `Passive construction: the agent is demoted or omitted, shifting focus to the grammatical subject (the patient or result). Passives are common in academic writing to foreground processes, findings, or objects rather than their agents.`,
        });
      }
    }

    // ── Sentence-final focal element ──────────────────────────────────────────
    if (activeLevels.has('sentence')) {
      // The last 2–5 content words before terminal punctuation carry information focus
      const finalRe = /\b(\w+(?:\s+\w+){1,4})\s*[.!?]*\s*$/;
      const fm = sent.text.match(finalRe);
      if (fm && fm[1]) {
        const phraseWords = fm[1].trim().split(/\s+/).length;
        if (phraseWords >= 2) {
          const lastIdx = sent.text.lastIndexOf(fm[1]);
          if (lastIdx >= 0) {
            annotations.push({
              start: sent.start + lastIdx,
              end: sent.start + lastIdx + fm[1].length,
              layer: 'focus',
              level: 'sentence',
              role: 'focal-final',
              tooltip: `Sentence-final position: this element occupies the position of highest information focus. In English, new and important information is conventionally placed at the end of a clause or sentence, where readers expect the informational peak.`,
            });
          }
        }
      }
    }

    // ── Emphasis markers ──────────────────────────────────────────────────────
    if (activeLevels.has('sentence') || activeLevels.has('phrase')) {
      for (const marker of EMPHASIS_MARKERS) {
        const re = new RegExp(`\\b${escapeForRegex(marker)}\\b`, 'gi');
        let m: RegExpExecArray | null;
        while ((m = re.exec(sent.text)) !== null) {
          annotations.push({
            start: sent.start + m.index,
            end: sent.start + m.index + m[0].length,
            layer: 'focus',
            level: 'phrase',
            role: 'emphasis',
            tooltip: `Emphasis marker: "${m[0]}" foregrounds the surrounding material as especially important or focal. Lexical signals like this guide reader attention and mark the writer's evaluation of information prominence.`,
          });
        }
      }
    }

    // ── Contrast markers ──────────────────────────────────────────────────────
    if (activeLevels.has('sentence') || activeLevels.has('clause')) {
      for (const marker of CONTRAST_MARKERS) {
        const re = new RegExp(`\\b${escapeForRegex(marker)}\\b`, 'gi');
        let m: RegExpExecArray | null;
        while ((m = re.exec(sent.text)) !== null) {
          annotations.push({
            start: sent.start + m.index,
            end: sent.start + m.index + m[0].length,
            layer: 'focus',
            level: 'clause',
            role: 'contrast',
            tooltip: `Contrast marker: "${m[0]}" signals a shift in discourse direction. Contrast markers often introduce or precede focal information, as the writer is foregrounding a new or opposing perspective relative to what came before.`,
          });
        }
      }
    }
  }

  return annotations;
}
