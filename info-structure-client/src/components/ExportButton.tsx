import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, File } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Annotation, LayerId, LevelId } from '../types';

interface Props {
  text: string;
  annotations: Annotation[];
  activeLayers: Set<LayerId>;
  activeLevels: Set<LevelId>;
}

interface PdfSegment {
  text: string;
  bgColor: [number, number, number] | null;
  underlineColor: [number, number, number] | null;
  topBarColor: [number, number, number] | null;
  topBarThick: number;
}

function buildPdfSegments(
  text: string,
  annotations: Annotation[],
  activeLayers: Set<LayerId>,
  activeLevels: Set<LevelId>
): PdfSegment[] {
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

    const flowAnn = covering.find(a => a.layer === 'flow');
    const ewAnn = covering.find(a => a.layer === 'end-weight');
    const focusAnn = covering.find(a => a.layer === 'focus');

    let bgColor: [number, number, number] | null = null;
    let underlineColor: [number, number, number] | null = null;

    if (flowAnn) {
      if (flowAnn.role === 'given') bgColor = [200, 240, 210];
      else if (flowAnn.role === 'new') bgColor = [225, 210, 245];
      else if (flowAnn.role === 'pronoun-ref') bgColor = [210, 225, 245];
    } else if (ewAnn) {
      if (ewAnn.role === 'heavy-initial') bgColor = [255, 218, 185];
      else if (ewAnn.role === 'heavy-final') bgColor = [210, 225, 255];
    }

    if (focusAnn) {
      if (focusAnn.role === 'cleft') underlineColor = [124, 58, 237];
      else if (focusAnn.role === 'passive') underlineColor = [71, 85, 105];
      else if (focusAnn.role === 'contrast') underlineColor = [220, 38, 38];
      else underlineColor = [217, 119, 6];
    }

    let topBarColor: [number, number, number] | null = null;
    let topBarThick = 0.5;
    const tdAnn = covering.find(a => a.layer === 'thematic-dev');
    if (tdAnn) {
      topBarThick = tdAnn.role === 'rheme' ? 0.3 : 0.55;
      switch (tdAnn.role) {
        case 'theme-first':    topBarColor = [59, 130, 246];   break;
        case 'constant-theme': topBarColor = [20, 184, 166];   break;
        case 'linear-theme':   topBarColor = [99, 102, 241];   break;
        case 'ruptured-theme': topBarColor = [239, 68, 68];    break;
        case 'rheme':          topBarColor = [202, 138, 4];    break;
        default: break;
      }
    }

    return { text: text.slice(start, end), bgColor, underlineColor, topBarColor, topBarThick };
  });
}

export function ExportButton({ text, annotations, activeLayers, activeLevels }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exportTXT = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'information-structure-analysis.txt';
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const usableW = pageW - margin * 2;
    const fontSize = 10;
    const lineH = 5.5;

    // ── Title ──────────────────────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Information Structure Analysis', margin, 20);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}  |  John Blake, Aston University`,
      margin, 26
    );

    // ── Legend ─────────────────────────────────────────────────────────────
    let y = 34;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('Colour key:', margin, y);
    y += 4;

    type RGB = [number, number, number];
    const legendItems: Array<{ label: string; bg: RGB | null; ul: RGB | null; tb: RGB | null }> = [
      { label: 'End-weight violation — heavy initial constituent', bg: [255, 218, 185], ul: null, tb: null },
      { label: 'End-weight — correctly heavy final constituent',   bg: [210, 225, 255], ul: null, tb: null },
      { label: 'Flow — given information (sentence)',              bg: [200, 240, 210], ul: null, tb: null },
      { label: 'Flow — new information (sentence)',                bg: [225, 210, 245], ul: null, tb: null },
      { label: 'Flow — anaphoric reference',                       bg: [210, 225, 245], ul: null, tb: null },
      { label: 'Focus — cleft construction',                       bg: null, ul: [124, 58, 237],  tb: null },
      { label: 'Focus — passive voice',                            bg: null, ul: [71, 85, 105],   tb: null },
      { label: 'Focus — sentence-final / emphasis / contrast',     bg: null, ul: [217, 119, 6],   tb: null },
      { label: 'Thematic Dev — theme (opening)',  bg: null, ul: null, tb: [59, 130, 246]  },
      { label: 'Thematic Dev — constant theme',   bg: null, ul: null, tb: [20, 184, 166]  },
      { label: 'Thematic Dev — linear theme',     bg: null, ul: null, tb: [99, 102, 241]  },
      { label: 'Thematic Dev — ruptured theme',   bg: null, ul: null, tb: [239, 68, 68]   },
      { label: 'Thematic Dev — rheme',            bg: null, ul: null, tb: [202, 138, 4]   },
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const item of legendItems) {
      if (item.bg) {
        doc.setFillColor(item.bg[0], item.bg[1], item.bg[2]);
        doc.rect(margin, y - 2.5, 5, 3, 'F');
      }
      if (item.ul) {
        doc.setDrawColor(item.ul[0], item.ul[1], item.ul[2]);
        doc.setLineWidth(0.4);
        doc.line(margin, y + 0.3, margin + 5, y + 0.3);
      }
      if (item.tb) {
        doc.setDrawColor(item.tb[0], item.tb[1], item.tb[2]);
        doc.setLineWidth(0.55);
        doc.line(margin, y - 2.8, margin + 5, y - 2.8);
      }
      doc.setTextColor(60, 60, 60);
      doc.text(item.label, margin + 7, y);
      y += 4;
    }

    y += 3;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // ── Annotated text ─────────────────────────────────────────────────────
    doc.setFontSize(fontSize);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);

    const segments = buildPdfSegments(text, annotations, activeLayers, activeLevels);
    let x = margin;

    const getWordWidth = (word: string) =>
      (doc.getStringUnitWidth(word) * fontSize) / doc.internal.scaleFactor;

    for (const seg of segments) {
      const parts = seg.text.split('\n');
      for (let pi = 0; pi < parts.length; pi++) {
        if (pi > 0) {
          x = margin;
          y += parts[pi - 1] === '' ? lineH * 0.6 : lineH;
          if (y > pageH - margin) { doc.addPage(); y = margin + lineH; }
        }

        const tokens = parts[pi].match(/\S+|\s+/g) ?? [];
        for (const token of tokens) {
          const w = getWordWidth(token);
          if (token.trim() === '') { x += w; continue; }

          // Word wrap
          if (x + w > margin + usableW) {
            x = margin;
            y += lineH;
            if (y > pageH - margin) { doc.addPage(); y = margin + lineH; }
          }

          // Background
          if (seg.bgColor) {
            doc.setFillColor(seg.bgColor[0], seg.bgColor[1], seg.bgColor[2]);
            doc.rect(x, y - 3.8, w, 4.5, 'F');
          }

          // Underline (focus)
          if (seg.underlineColor) {
            doc.setDrawColor(seg.underlineColor[0], seg.underlineColor[1], seg.underlineColor[2]);
            doc.setLineWidth(0.35);
            doc.line(x, y + 0.8, x + w, y + 0.8);
          }

          // Top bar (thematic development)
          if (seg.topBarColor) {
            doc.setDrawColor(seg.topBarColor[0], seg.topBarColor[1], seg.topBarColor[2]);
            doc.setLineWidth(seg.topBarThick);
            doc.line(x, y - 3.5, x + w, y - 3.5);
          }

          doc.setTextColor(0, 0, 0);
          doc.text(token, x, y);
          x += w;
        }
      }
    }

    doc.save('information-structure-analysis.pdf');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition font-medium"
      >
        <Download size={14} />
        Export
        <ChevronDown
          size={13}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[160px] z-40 overflow-hidden">
          <button
            onClick={exportTXT}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
          >
            <FileText size={14} className="text-gray-400 shrink-0" />
            Download .txt
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-100 text-left"
          >
            <File size={14} className="text-gray-400 shrink-0" />
            Download .pdf
          </button>
        </div>
      )}
    </div>
  );
}
