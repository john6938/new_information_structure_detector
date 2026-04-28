import { useState, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import type { Annotation, LayerId, LevelId } from '../types';

interface Segment {
  start: number;
  end: number;
  text: string;
  annotations: Annotation[];
}

interface TooltipState {
  annotations: Annotation[];
  x: number;
  y: number;
  above: boolean;
}

const LAYER_LABELS: Record<LayerId, string> = {
  'end-weight':   'End-weight',
  focus:          'Focus',
  flow:           'Flow',
  'thematic-dev': 'Thematic Dev',
};

const LAYER_ACCENT: Record<LayerId, string> = {
  'end-weight':   '#fb923c',
  focus:          '#f59e0b',
  flow:           '#4ade80',
  'thematic-dev': '#2dd4bf',
};

const ROLE_LABELS: Record<string, string> = {
  'heavy-initial':  'heavy initial',
  'heavy-final':    'heavy final',
  cleft:            'cleft',
  passive:          'passive',
  'focal-final':    'sentence-final focus',
  emphasis:         'emphasis marker',
  contrast:         'contrast marker',
  given:            'given',
  new:              'new',
  'pronoun-ref':    'anaphoric reference',
  'theme-first':    'theme (opening)',
  'constant-theme': 'constant theme',
  'linear-theme':   'linear theme',
  'ruptured-theme': 'ruptured theme',
  rheme:            'rheme',
};

function buildSegments(
  text: string,
  annotations: Annotation[],
  activeLayers: Set<LayerId>,
  activeLevels: Set<LevelId>
): Segment[] {
  const active = annotations.filter(
    a => activeLayers.has(a.layer) && activeLevels.has(a.level)
  );

  const boundaries = new Set<number>([0, text.length]);
  for (const ann of active) {
    const s = Math.max(0, Math.min(ann.start, text.length));
    const e = Math.max(0, Math.min(ann.end, text.length));
    if (s < e) { boundaries.add(s); boundaries.add(e); }
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  return sorted.slice(0, -1).map((start, i) => {
    const end = sorted[i + 1];
    const covering = active.filter(a => a.start <= start && a.end >= end);
    return { start, end, text: text.slice(start, end), annotations: covering };
  });
}

function computeStyle(annotations: Annotation[]): CSSProperties {
  if (annotations.length === 0) return {};

  // Visual channel priority:
  //   background  → flow > end-weight
  //   borderBottom → focus (independent channel)

  const flowAnn = annotations.find(a => a.layer === 'flow');
  const ewAnn = annotations.find(a => a.layer === 'end-weight');
  const focusAnn = annotations.find(a => a.layer === 'focus');

  let bg = '';
  let borderBottom = '';

  if (flowAnn) {
    if (flowAnn.role === 'given') bg = 'rgba(34,197,94,0.22)';
    else if (flowAnn.role === 'new') bg = 'rgba(168,85,247,0.20)';
    else if (flowAnn.role === 'pronoun-ref') bg = 'rgba(59,130,246,0.20)';
  } else if (ewAnn) {
    if (ewAnn.role === 'heavy-initial') bg = 'rgba(251,146,60,0.28)';
    else if (ewAnn.role === 'heavy-final') bg = 'rgba(96,165,250,0.18)';
  }

  if (focusAnn) {
    switch (focusAnn.role) {
      case 'cleft':       borderBottom = '2.5px solid #7c3aed'; break;
      case 'passive':     borderBottom = '2px dashed #475569'; break;
      case 'focal-final': borderBottom = '2.5px solid #d97706'; break;
      case 'emphasis':    borderBottom = '2px dotted #ea580c'; break;
      case 'contrast':    borderBottom = '2px dotted #dc2626'; break;
      default:            borderBottom = '2px solid #d97706'; break;
    }
  }

  // Thematic development — independent top-bar channel via inset box-shadow
  const tdAnn = annotations.find(a => a.layer === 'thematic-dev');
  let boxShadow = '';
  if (tdAnn) {
    switch (tdAnn.role) {
      case 'theme-first':    boxShadow = 'inset 0 3px 0 rgba(59,130,246,0.75)';  break;
      case 'constant-theme': boxShadow = 'inset 0 3px 0 rgba(20,184,166,0.85)';  break;
      case 'linear-theme':   boxShadow = 'inset 0 3px 0 rgba(99,102,241,0.85)';  break;
      case 'ruptured-theme': boxShadow = 'inset 0 3px 0 rgba(239,68,68,0.85)';   break;
      case 'rheme':          boxShadow = 'inset 0 2px 0 rgba(234,179,8,0.55)';   break;
      default: break;
    }
  }

  return {
    backgroundColor: bg || undefined,
    borderBottom: borderBottom || undefined,
    boxShadow: boxShadow || undefined,
    borderRadius: bg || boxShadow ? '2px' : undefined,
    cursor: annotations.length > 0 ? 'help' : undefined,
    paddingBottom: borderBottom ? '1px' : undefined,
  };
}

export function TextAnnotator({
  text,
  annotations,
  activeLayers,
  activeLevels,
}: {
  text: string;
  annotations: Annotation[];
  activeLayers: Set<LayerId>;
  activeLevels: Set<LevelId>;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => setTooltip(null), 300);
  }, [clearHide]);

  const segments = useMemo(
    () => buildSegments(text, annotations, activeLayers, activeLevels),
    [text, annotations, activeLayers, activeLevels]
  );

  return (
    <div className="relative">
      <div className="text-base leading-loose font-serif whitespace-pre-wrap select-text text-gray-800">
        {segments.map((seg, idx) => {
          if (seg.annotations.length === 0) {
            return <span key={idx}>{seg.text}</span>;
          }
          return (
            <span
              key={idx}
              style={computeStyle(seg.annotations)}
              onMouseEnter={e => {
                clearHide();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const above = rect.top > 200;
                setTooltip({
                  annotations: seg.annotations,
                  x: rect.left + rect.width / 2,
                  y: above ? rect.top - 10 : rect.bottom + 10,
                  above,
                });
              }}
              onMouseLeave={scheduleHide}
            >
              {seg.text}
            </span>
          );
        })}
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl max-w-sm text-sm pointer-events-auto"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: tooltip.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            minWidth: '240px',
          }}
          onMouseEnter={clearHide}
          onMouseLeave={scheduleHide}
        >
          {tooltip.annotations.map((ann, i) => (
            <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-gray-700' : ''}>
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: LAYER_ACCENT[ann.layer] }}
              >
                {LAYER_LABELS[ann.layer]}
                {' — '}
                {ROLE_LABELS[ann.role] ?? ann.role}
                {ann.chainId !== undefined ? ` #${ann.chainId}` : ''}
              </p>
              <p className="text-gray-200 leading-snug text-xs">{ann.tooltip}</p>
            </div>
          ))}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-transparent ${
              tooltip.above
                ? 'bottom-0 translate-y-full border-t-8 border-t-gray-900'
                : 'top-0 -translate-y-full border-b-8 border-b-gray-900'
            }`}
          />
        </div>
      )}
    </div>
  );
}
