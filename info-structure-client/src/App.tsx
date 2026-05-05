import { useState, useMemo, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import tntLogoUrl from './assets/tnt-logo.svg';
import { TextAnnotator } from './components/TextAnnotator';
import { ExportButton } from './components/ExportButton';
import { analyseText } from './analysers';
import { SAMPLE_TEXT } from './sampleText';
import type { LayerId, LevelId, Annotation } from './types';

type Mode = 'input' | 'output';

const ALL_LAYERS: LayerId[] = ['end-weight', 'focus', 'flow', 'thematic-dev'];
const ALL_LEVELS: LevelId[] = ['sentence', 'clause', 'phrase'];

const LAYER_META: Record<LayerId, { label: string; description: string; bgColor: string; accentColor: string }> = {
  'end-weight': {
    label: 'End-weight',
    description: 'Distribution of heavy and light constituents',
    bgColor: '#fed7aa',
    accentColor: '#ea580c',
  },
  focus: {
    label: 'Focus',
    description: 'Clefts, passives, focal position, emphasis',
    bgColor: '#fde68a',
    accentColor: '#d97706',
  },
  flow: {
    label: 'Flow',
    description: 'Given / new information and referential chains',
    bgColor: '#bbf7d0',
    accentColor: '#16a34a',
  },
  'thematic-dev': {
    label: 'Thematic Dev',
    description: 'Constant, linear, and ruptured theme patterns across sentences',
    bgColor: '#ccfbf1',
    accentColor: '#0d9488',
  },
};

const LEVEL_META: Record<LevelId, { label: string }> = {
  sentence: { label: 'Sentence' },
  clause:   { label: 'Clause' },
  phrase:   { label: 'Phrase' },
};

// Visual legend items shown in the output header strip
const LEGEND_ITEMS = [
  { label: 'heavy initial',  style: { backgroundColor: 'rgba(251,146,60,0.28)',  padding: '0 4px', borderRadius: 2 } },
  { label: 'heavy final',    style: { backgroundColor: 'rgba(96,165,250,0.18)',  padding: '0 4px', borderRadius: 2 } },
  { label: 'given',          style: { backgroundColor: 'rgba(34,197,94,0.22)',   padding: '0 4px', borderRadius: 2 } },
  { label: 'new',            style: { backgroundColor: 'rgba(168,85,247,0.20)',  padding: '0 4px', borderRadius: 2 } },
  { label: 'anaphor',        style: { backgroundColor: 'rgba(59,130,246,0.20)', padding: '0 4px', borderRadius: 2 } },
  { label: 'cleft',          style: { borderBottom: '2.5px solid #7c3aed', paddingBottom: 1 } },
  { label: 'passive',        style: { borderBottom: '2px dashed #475569',  paddingBottom: 1 } },
  { label: 'focal',          style: { borderBottom: '2.5px solid #d97706', paddingBottom: 1 } },
  { label: 'emphasis',       style: { borderBottom: '2px dotted #ea580c',  paddingBottom: 1 } },
  { label: 'contrast',       style: { borderBottom: '2px dotted #dc2626',  paddingBottom: 1 } },
  // Thematic development — top bar via inset box-shadow
  { label: 'T: opening',    style: { boxShadow: 'inset 0 3px 0 rgba(59,130,246,0.75)',   padding: '0 3px' } },
  { label: 'T: constant',   style: { boxShadow: 'inset 0 3px 0 rgba(20,184,166,0.85)',  padding: '0 3px' } },
  { label: 'T: linear',     style: { boxShadow: 'inset 0 3px 0 rgba(99,102,241,0.85)',  padding: '0 3px' } },
  { label: 'T: ruptured',   style: { boxShadow: 'inset 0 3px 0 rgba(239,68,68,0.85)',   padding: '0 3px' } },
  { label: 'Rheme',         style: { boxShadow: 'inset 0 2px 0 rgba(234,179,8,0.55)',   padding: '0 3px' } },
] as const;

export default function App() {
  const [mode, setMode]   = useState<Mode>('input');
  const [text, setText]   = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(ALL_LAYERS));
  const [activeLevels, setActiveLevels] = useState<Set<LevelId>>(new Set(ALL_LEVELS));

  const visibleCount = useMemo(
    () => annotations.filter(a => activeLayers.has(a.layer) && activeLevels.has(a.level)).length,
    [annotations, activeLayers, activeLevels]
  );

  const toggleLayer = (id: LayerId) =>
    setActiveLayers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleLevel = (id: LevelId) =>
    setActiveLevels(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'text/plain') return;
    const reader = new FileReader();
    reader.onload = ev => setText(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAnalyse = () => {
    if (!text.trim()) return;
    setAnnotations(analyseText(text));
    setMode('output');
  };

  // ── Input mode ─────────────────────────────────────────────────────────────
  if (mode === 'input') {
    return (
      <div className="min-h-full flex items-start justify-center bg-gray-50 p-3 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-5 sm:p-8 my-4">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <img src={tntLogoUrl} alt="TNT Lab" className="w-11 h-11 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold leading-tight text-gray-900">
                Information Structure Analyser
              </h1>
              <p className="text-sm text-gray-500">
                Visualise end-weight, information focus, and information flow in academic writing
              </p>
            </div>
          </div>

          {/* Layer toggles */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Analysis layers
            </p>
            <div className="flex gap-2 flex-wrap">
              {ALL_LAYERS.map(id => {
                const meta = LAYER_META[id];
                const active = activeLayers.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleLayer(id)}
                    style={active ? { backgroundColor: meta.bgColor, borderColor: meta.accentColor } : {}}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      active ? 'text-gray-800' : 'bg-gray-100 text-gray-400 border-gray-200'
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Level toggles */}
          <div className="mb-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Analysis level
            </p>
            <div className="flex gap-2 flex-wrap">
              {ALL_LEVELS.map(id => {
                const active = activeLevels.has(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleLevel(id)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      active
                        ? 'bg-blue-50 text-blue-700 border-blue-300 font-medium'
                        : 'bg-gray-100 text-gray-400 border-gray-200'
                    }`}
                  >
                    {LEVEL_META[id].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text controls */}
          <div className="flex gap-2 flex-wrap mb-3">
            <label className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white text-sm rounded-lg cursor-pointer hover:bg-blue-600 transition">
              <Upload size={15} />
              Upload .txt
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setText(SAMPLE_TEXT)}
              className="px-3 py-2 bg-purple-100 text-purple-700 text-sm rounded-lg hover:bg-purple-200 transition"
            >
              Load sample
            </button>
            <button
              onClick={() => setText('')}
              className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition"
            >
              Clear
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste your academic text here, upload a .txt file, or click 'Load sample'…"
            rows={12}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-base font-serif leading-relaxed"
          />

          {/* Analyse button */}
          <button
            onClick={handleAnalyse}
            disabled={!text.trim()}
            className="mt-3 w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition text-base"
          >
            Analyse Text
          </button>

          {/* What will be analysed */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              What will be analysed
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
              {ALL_LAYERS.map(id => (
                <div
                  key={id}
                  style={{ borderLeft: `3px solid ${LAYER_META[id].accentColor}` }}
                  className="pl-2 py-1"
                >
                  <p className="font-semibold text-gray-800 mb-0.5">{LAYER_META[id].label}</p>
                  <p>{LAYER_META[id].description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
            John Blake, Aston University. Version 2.0.
          </div>
        </div>
      </div>
    );
  }

  // ── Output mode ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* Header bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto gap-3 flex-wrap">

          {/* Logo + title + count */}
          <div className="flex items-center gap-2 shrink-0">
            <img src={tntLogoUrl} alt="TNT Lab" className="w-8 h-8" />
            <span className="font-semibold text-gray-900 hidden sm:block text-sm">
              Information Structure Analyser
            </span>
            <span className="text-xs text-gray-400">
              {visibleCount} annotation{visibleCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Layer + level toggles */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-400 mr-0.5">Layers:</span>
            {ALL_LAYERS.map(id => {
              const meta = LAYER_META[id];
              const active = activeLayers.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleLayer(id)}
                  style={
                    active
                      ? { backgroundColor: meta.bgColor, borderColor: meta.accentColor, color: '#374151' }
                      : {}
                  }
                  className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                    active ? '' : 'bg-gray-100 border-gray-200 text-gray-400'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}

            <span className="text-xs text-gray-400 ml-2 mr-0.5">Levels:</span>
            {ALL_LEVELS.map(id => {
              const active = activeLevels.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleLevel(id)}
                  className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-100 border-gray-200 text-gray-400'
                  }`}
                >
                  {LEVEL_META[id].label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ExportButton
              text={text}
              annotations={annotations}
              activeLayers={activeLayers}
              activeLevels={activeLevels}
            />
            <button
              onClick={() => setMode('input')}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition"
            >
              Edit text
            </button>
          </div>
        </div>
      </header>

      {/* Colour legend strip */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap max-w-screen-xl mx-auto text-xs text-gray-700">
          {LEGEND_ITEMS.map(item => (
            <span key={item.label} style={item.style}>
              {item.label}
            </span>
          ))}
          <span className="ml-auto text-gray-400 hidden sm:block">Hover for explanations</span>
        </div>
      </div>

      {/* Annotated text */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-screen-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-8">
          {activeLayers.size === 0 || activeLevels.size === 0 ? (
            <p className="text-gray-400 text-sm italic">
              Enable at least one layer and one level to see analysis.
            </p>
          ) : (
            <TextAnnotator
              text={text}
              annotations={annotations}
              activeLayers={activeLayers}
              activeLevels={activeLevels}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400 shrink-0">
        John Blake, Aston University. Version 2.0.
      </footer>
    </div>
  );
}
