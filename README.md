# Information Structure Analyser

A web application for analysing information structure in academic text, built for use in linguistics research and academic writing pedagogy.

**Live app:** https://john6938.github.io/new_information_structure_detector/

## Remit

Analyse academic prose for four dimensions of information structure, rendering annotations inline with hover tooltips. Users toggle layers and levels, then export annotated text as TXT or PDF.

### Analysis layers

| Layer | What it detects | Visual channel |
|---|---|---|
| **End-weight** | Heavy initial / heavy final constituents; violations of the end-weight principle | Background colour (orange = violation, blue = compliant heavy-final) |
| **Information focus** | Cleft constructions, passivisation, sentence-final focal elements, emphasis and contrast markers | Bottom border (various styles) |
| **Information flow** | Given / new information tracking; anaphoric pronoun reference; definite vs indefinite NPs | Background colour (green = given, purple = new, blue = anaphor) — priority over end-weight |
| **Thematic development** | Constant theme, linear (zig-zag) theme, ruptured theme (Danes model) | Inset top-bar box-shadow (teal = constant, indigo = linear, red = ruptured, amber = rheme) |

### Analysis levels

- **Sentence** — inter-sentence patterns (flow, thematic progression, end-weight at clause boundary)
- **Clause** — subordinate clauses, heavy medial relatives, topic continuity/shift
- **Phrase** — heavy pre-modified NPs, definite/indefinite NPs, pronoun reference

### Export

- **TXT** — plain text with annotation summary appended
- **PDF** — colour-highlighted text with legend page (via jsPDF)

## Tech stack

- React 18 + TypeScript + Vite + Tailwind CSS
- Lucide React (icons)
- jsPDF (PDF export)
- GitHub Actions -> GitHub Pages deployment

## Key files

```
info-structure-client/
  src/
    types.ts                          # LayerId, LevelId, Annotation types
    sampleText.ts                     # Demo academic paragraph
    analysers/
      nlpUtils.ts                     # splitIntoSentences(), complexityScore()
      endWeight.ts                    # End-weight analyser
      informationFocus.ts             # Focus analyser
      informationFlow.ts              # Flow analyser
      thematicDevelopment.ts          # Thematic development analyser (Danes)
      index.ts                        # Runs all four analysers -> Annotation[]
    components/
      TextAnnotator.tsx               # Segment-based inline rendering + tooltips
      ExportButton.tsx                # TXT and PDF export
    App.tsx                           # Layer/level toggles, input/output modes
  public/
    favicon.svg                       # TNT Lab logo
.github/workflows/deploy.yml         # GitHub Pages CI/CD (triggers on main)
```

## Deployment

Two build targets:

| Target | BASE_URL |
|---|---|
| GitHub Pages | `/new_information_structure_detector/` |
| cPanel | `/` |

Deploy is triggered automatically on push to `main`.

---

## TODO

- [ ] **1. Check accuracy of each analysis layer at each level**
  - End-weight: sentence, clause, phrase
  - Information focus: cleft, passive, focal-final, emphasis, contrast
  - Information flow: given/new tracking, pronoun anaphora, definite/indefinite NPs, topic continuity
  - Thematic development: constant, linear, ruptured theme classification; rheme boundary detection
