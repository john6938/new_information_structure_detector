import type { Annotation, LevelId } from '../types';
import { analyseEndWeight } from './endWeight';
import { analyseInformationFocus } from './informationFocus';
import { analyseInformationFlow } from './informationFlow';
import { analyseThematicDevelopment } from './thematicDevelopment';

// Run all analysers over all levels.
// Filtering by active layers/levels is done at render time in TextAnnotator.
export function analyseText(text: string): Annotation[] {
  const allLevels: Set<LevelId> = new Set(['sentence', 'clause', 'phrase']);
  return [
    ...analyseEndWeight(text, allLevels),
    ...analyseInformationFocus(text, allLevels),
    ...analyseInformationFlow(text, allLevels),
    ...analyseThematicDevelopment(text, allLevels),
  ];
}
