export type LayerId = 'end-weight' | 'focus' | 'flow' | 'thematic-dev';
export type LevelId = 'phrase' | 'clause' | 'sentence';

export interface Annotation {
  start: number;
  end: number;
  layer: LayerId;
  level: LevelId;
  role: string;
  chainId?: number;
  tooltip: string;
}
