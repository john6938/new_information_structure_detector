export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

export function splitIntoSentences(text: string): SentenceSpan[] {
  const results: SentenceSpan[] = [];
  let sentStart = 0;
  let i = 0;

  while (i < text.length) {
    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      // Consume consecutive terminal punctuation
      let j = i + 1;
      while (j < text.length && '.!?'.includes(text[j])) j++;

      // Determine what follows
      const after = text.slice(j);
      const boundaryMatch = after.match(/^(\s+)([A-Z"'\u2018\u201C])/);
      const isEnd = j >= text.length;

      // Avoid splitting on abbreviations (Mr. Dr. etc.)
      const prevWord = text.slice(Math.max(0, i - 15), i).match(/\b([A-Za-z]+)$/)?.[1] ?? '';
      const isAbbrev =
        prevWord.length <= 2 ||
        /^(Mr|Mrs|Ms|Dr|Prof|St|vs|etc|eg|ie|Fig|Vol|No|pp|ed|eds|al|ibid|op|cit)$/i.test(prevWord);

      if (!isAbbrev && (boundaryMatch || isEnd)) {
        const raw = text.slice(sentStart, j);
        const trimmed = raw.trim();
        const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
        if (trimmed && wordCount >= 3) {
          const leadingSpaces = raw.length - raw.trimStart().length;
          results.push({
            text: trimmed,
            start: sentStart + leadingSpaces,
            end: sentStart + leadingSpaces + trimmed.length,
          });
        }
        sentStart = boundaryMatch ? j + boundaryMatch[1].length : j;
        i = sentStart;
        continue;
      }
    }
    i++;
  }

  // Any remaining text
  const raw = text.slice(sentStart);
  const trimmed = raw.trim();
  if (trimmed && trimmed.split(/\s+/).filter(Boolean).length >= 2) {
    const leadingSpaces = raw.length - raw.trimStart().length;
    results.push({
      text: trimmed,
      start: sentStart + leadingSpaces,
      end: sentStart + leadingSpaces + trimmed.length,
    });
  }

  return results;
}

export function complexityScore(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Subordinate clause markers add processing load
  const subclauses = (
    text.match(/\b(that|which|who|whom|whose|where|when|because|although|since|if|unless|while|whereas|though|provided|given)\b/gi) || []
  ).length;

  // Prepositional phrases add complexity
  const preps = (
    text.match(/\b(of|in|on|at|by|for|with|about|through|between|among|within|across|beyond|despite|regarding|concerning|following|including|throughout|alongside|according)\b/gi) || []
  ).length;

  // Long nominalised words are typically heavier
  const nominals = words.filter(w =>
    /(?:tion|sion|ment|ness|ity|ance|ence|ism|ology|ography|isation|ization)$/i.test(w)
  ).length;

  return wordCount + subclauses * 2 + preps * 0.5 + nominals * 0.5;
}
