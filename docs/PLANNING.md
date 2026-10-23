# DocFlow — Product Architecture & Phase 0 Plan

> Temporary product name: **DocFlow** — configurable via environment variable.
> Status: **Awaiting approval before implementation.**

---

## 1. Proposed System Architecture

### 1.1 High-Level Topology

```
                    ┌─────────────┐
                    │   Nginx     │  TLS, rate limiting, security headers
                    │  (reverse   │  static assets
                    │   proxy)    │
                    └──────┬──────┘
                           │
              ┌────────────┼──────────────────┐
              │            │                  │
     ┌────────▼───┐  ┌─────▼─────┐  ┌────────▼──────────┐
     │  Web App   │  │  API      │  │  Python Worker    │
     │  (React    │  │  (Node.js │  │  (FastAPI)        │
     │   + Vite)  │  │   Fastify)│  │  OCR, table det.  │
     │  static    │  │           │  └────────┬──────────┘
     │  build)    │  │           │           │
     └────────────┘  └─────┬─────┘  ┌────────▼──────────┐
                           │        │  LibreOffice Worker│
                           │        │  (unoserver)       │
                           │        │  PDF↔DOCX/ODT conv │
                           │        └────────┬──────────┘
              ┌────────────┼─────────────────┤
              │            │                 │
     ┌────────▼───┐  ┌─────▼─────┐  ┌──────▼──────┐
     │ PostgreSQL │  │   Redis   │  │  Storage    │
     │  (data)    │  │ (sessions,│  │  (S3-compat │
     │            │  │  queues,  │  │   abstraction│
     │            │  │  cache)   │  │   — local FS│
     └────────────┘  └───────────┘  │   initially)│
                                    └─────────────┘
```

### 1.2 Service Breakdown

| Service | Technology | Role |
|---------|-----------|------|
| Web App | React 18 + TypeScript + Vite | SPA: editor, dashboard, marketing |
| API | Node.js + Fastify | Auth, projects, billing, admin, file orchestration |
| Python Worker | FastAPI + BullMQ consumer | OCR (Tesseract), table extraction, PDF processing |
| LibreOffice Worker | unoserver + LibreOffice headless | High-fidelity PDF↔DOCX/ODT conversion, complex layout rendering |
| PostgreSQL | 16+ | Users, projects metadata, billing, audit logs |
| Redis | 7+ (or Valkey) | OTP sessions, rate limiting, job queues, cache |
| Storage | S3-compatible abstraction over local FS | Original PDFs, exports, user assets |
| Nginx | Reverse proxy | TLS, security headers, static serving |
| Scheduler | Node.js cron | Cleanup expired files, backups, quota resets |

### 1.3 Frontend Architecture

```
src/
├── engine/              # Editor engine (framework-agnostic core)
│   ├── document-model/  # Internal document model, schema, migrations
│   ├── pdf/             # PDF.js integration, rendering, import/export
│   ├── canvas/          # Canvas overlay, object manipulation
│   ├── table/           # Table/spreadsheet engine
│   ├── history/         # Undo/redo via command/patch log
│   ├── text/            # Text shaping, font management, multilingual
│   └── workers/         # Web Workers for heavy processing
├── state/               # Zustand stores, API state (TanStack Query)
├── api/                 # API client, auth, types
├── ui/                  # React components
│   ├── editor/          # Main editor shell
│   ├── panels/          # Sidebar, inspector, toolbar
│   ├── modes/           # PDF Layout, Document, Table mode components
│   ├── shared/          # Design system components
│   └── marketing/       # Landing, pricing, feature pages
├── hooks/               # Custom React hooks
├── lib/                 # Utilities, i18n, storage
└── types/               # Shared TypeScript types
```

### 1.4 Data Flow — PDF Import

```
User drops PDF
  → Frontend validates MIME + size + magic bytes
  → Uploads to API (signed URL)
  → API enqueues processing job
  → Python worker:
      1. Validates PDF structure (not encrypted/decompression bomb)
      2. Renders page previews
      3. Classifies pages: digital / scanned / mixed
      4. Extracts text + coordinates + fonts (pdfplumber)
      5. Groups glyphs → runs → lines → paragraphs → blocks
      6. Detects tables (camelot/pdfplumber)
      7. Runs OCR if scanned (Tesseract with Bangla+English)
      8. Matches/substitutes fonts
      9. Builds internal document model (JSON)
     10. Stores model + original PDF in storage
  → Frontend receives model + page render URLs
  → Editor loads
```

### 1.5 Data Flow — PDF Export

```
User clicks Export
  → Frontend serializes internal document model
  → Sends to API (or processes client-side for simple cases)
  → Worker:
      1. Loads original PDF as base layer
      2. Applies edits (text, images, annotations, tables)
      3. Shapes multilingual text (HarfBuzz)
      4. Embeds/subsets fonts
      5. Flattens redactions (removes underlying content)
      6. Validates output PDF
  → Returns signed download URL
```

---

## 2. Proposed Internal Document Model

### 2.1 Design Principles

- **JSON-based**, stored in PostgreSQL as JSONB and in IndexedDB for guests
- **Schema-versioned** with migration functions
- **Separate from original PDF** — original is a fallback layer
- **Operation-based history** — not full-document snapshots
- **Confidence-scored** — each extracted element carries a confidence value
- **Source-typed** — elements know if they were extracted, OCR'd, or user-added

### 2.2 Schema (TypeScript — Abbreviated)

```typescript
interface DocFlowProject {
  id: string;                    // UUID
  schemaVersion: number;         // For migrations
  name: string;
  locale: string;                // Primary locale
  createdAt: string;             // ISO 8601
  updatedAt: string;
  originalPdfRef: string;        // Storage key for original PDF
  pageRenderRefs: string[];      // Storage keys for page preview images
  pages: Page[];
  fonts: FontReference[];        // Fonts used in this project
  history: OperationEntry[];     // Operation log for undo/redo
  metadata: ProjectMetadata;
}

interface Page {
  id: string;
  index: number;
  width: number;                 // PDF points (1/72 inch)
  height: number;
  rotation: 0 | 90 | 180 | 270;
  pageType: 'digital' | 'scanned' | 'mixed';
  backgroundRef: string;         // Rendered page image (fallback layer)
  elements: PageElement[];       // Ordered by z-index
  confidence: number;            // 0-1, overall page reconstruction confidence
}

type PageElement =
  | TextBlock | ImageElement | ShapeElement
  | TableElement | FormField | Annotation | SignatureElement;

interface BaseElement {
  id: string;
  type: ElementType;
  bbox: BoundingBox;             // { x, y, width, height } in page coords
  transform: Transform;          // { rotate, scaleX, scaleY, skewX, skewY }
  zIndex: number;
  locked: boolean;
  visible: boolean;
  sourceType: 'extracted' | 'ocr' | 'added' | 'imported';
  confidence: number;            // 0-1, null for user-added
}

interface TextBlock extends BaseElement {
  type: 'text';
  paragraphs: Paragraph[];
  style: TextStyle;
  overflow: 'visible' | 'hidden' | 'warn';
}

interface Paragraph {
  id: string;
  runs: TextRun[];
  alignment: 'left' | 'center' | 'right' | 'justify';
  direction: 'ltr' | 'rtl';
  lineHeight: number;
  spaceBefore: number;
  spaceAfter: number;
  indent: number;
}

interface TextRun {
  text: string;
  fontId: string;                // Reference to FontReference
  fontSize: number;
  fontWeight: number;            // 100-900
  fontStyle: 'normal' | 'italic';
  color: string;                 // Hex or rgba
  opacity: number;
  underline: boolean;
  strikethrough: boolean;
  language: string;              // BCP-47 tag: 'bn', 'en', 'ar', 'hi'
  shapedGlyphs?: ShapedGlyph[];  // Cached after shaping
}

interface TableElement extends BaseElement {
  type: 'table';
  rows: TableRow[];
  columns: TableColumn[];
  cells: TableCell[];            // Flattened grid
  hasFormulas: boolean;          // Only true for user-created tables
  sourceTableIndex?: number;
}

interface TableCell {
  id: string;
  rowIndex: number;
  colIndex: number;
  rowspan: number;
  colspan: number;
  value: string;
  formula?: string;              // Only for user-created tables
  style: CellStyle;
  merged: boolean;
}

interface FontReference {
  id: string;
  family: string;
  subfamily: string;
  source: 'embedded' | 'system' | 'bundled' | 'substituted';
  originalFontName?: string;
  substitutedFrom?: string;
  license: string;
  embeddable: boolean;
  weight: number;
  isItalic: boolean;
  supportsScripts: string[];     // ['latin', 'bengali', 'arabic', ...]
}

interface BoundingBox { x: number; y: number; width: number; height: number; }
interface Transform { rotate: number; scaleX: number; scaleY: number; skewX: number; skewY: number; }

interface OperationEntry {
  id: string;
  timestamp: string;
  type: string;                  // 'add', 'delete', 'modify', 'move', etc.
  targetId: string;
  patch: object;                 // JSON patch (RFC 6902 style)
  inversePatch: object;          // For undo
}
```

### 2.3 Schema Versioning

```typescript
const SCHEMA_VERSION = 1;
const migrations: Record<number, (project: any) => any> = {};
function migrateProject(project: any): DocFlowProject {
  let current = project;
  while (current.schemaVersion < SCHEMA_VERSION) {
    const migrator = migrations[current.schemaVersion + 1];
    if (!migrator) throw new Error(`No migration from v${current.schemaVersion}`);
    current = migrator(current);
    current.schemaVersion++;
  }
  return current;
}
```

---

## 3. Phase 0 Implementation Plan

### 3.1 Objective

Prove that the core technology works: multilingual PDF editing with correct Bangla shaping, table detection/editing, and round-trip export — all in the browser.

### 3.2 Scope

| Feature | In Scope | Out of Scope |
|---------|----------|-------------|
| PDF upload + render | Yes | Cloud storage |
| Text selection + editing | Yes | Document Mode reflow |
| Bangla + English text | Yes | OCR |
| Font shaping + embedding | Yes | Font marketplace |
| Image + signature placement | Yes | Advanced image editing |
| Simple table detection | Yes | CSV/XLSX import |
| Spreadsheet-style table editing | Yes | Formulas |
| Undo/redo | Yes | Tracked changes |
| Internal project save (IndexedDB) | Yes | Cloud projects |
| Project reopen | Yes | Dashboard |
| PDF export | Yes | Multiple export profiles |
| Server-side processing | No (client-side first) | — |
| Auth/billing | No | — |

### 3.3 Implementation Milestones

**M0.1 — Project Scaffold & Build System**
- Vite + React + TypeScript project
- ESLint, Prettier, Vitest setup
- Docker dev environment (frontend only for Phase 0)
- Basic app shell (header, empty canvas, sidebar)

**M0.2 — PDF Rendering**
- Integrate PDF.js
- Upload via drag-and-drop
- Render pages to canvas
- Page thumbnail sidebar
- Zoom controls

**M0.3 — Text Extraction & Selection**
- Extract text with coordinates using PDF.js
- Overlay selectable text boxes on canvas
- Click-to-edit existing text
- Add new text boxes
- Basic text formatting (font, size, color, bold, italic)

**M0.4 — Multilingual Text Engine**
- Integrate HarfBuzz.js for complex script shaping
- Bundle Noto Sans Bengali + Noto Serif Bengali (OFL)
- Test Bangla conjuncts, vowel marks, reph, phala
- Mixed Bangla-English line rendering
- Arabic/RTL support (basic)
- Font substitution logic for missing fonts

**M0.5 — Canvas Object System**
- Fabric.js canvas overlay
- Move, resize, rotate, delete objects
- Z-index ordering, selection states
- Snapping to grid/guides

**M0.6 — Images & Signatures**
- Image upload + placement on canvas
- Image resize/crop
- Drawn signature (canvas freehand)
- Uploaded signature image

**M0.7 — Table Detection & Editing**
- Table detection (heuristic client-side or server-side pdfplumber)
- "Edit as spreadsheet" UI for detected tables
- Editable cells, insert/delete rows/columns
- Cell formatting (font, alignment, fill, border)
- Write edited table back to PDF layout

**M0.8 — Undo/Redo Engine**
- Command pattern or JSON Patch-based operation log
- Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- Operation coalescing (continuous text input = one undo step)

**M0.9 — Internal Project Storage**
- IndexedDB via Dexie.js
- Save/reopen project, project list (local)
- Crash recovery (autosave to IndexedDB)

**M0.10 — PDF Export**
- pdf-lib for client-side PDF generation
- Apply text edits with proper font embedding
- Apply image/signature placements
- Apply table edits
- Font subsetting, Bangla text shaping in export
- Export validation (re-import and verify)

**M0.11 — Phase 0 Test Suite**
- Unit tests for document model, text shaping, export
- Integration test: upload → edit → export → re-import
- Visual regression: compare exported pages to reference images
- Test with all required test documents

### 3.4 Phase 0 Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF rendering | PDF.js (Mozilla) | Apache 2.0, battle-tested, browser-native |
| PDF export | pdf-lib + LibreOffice headless | MIT (pdf-lib) + MPL 2.0 (LibreOffice); pdf-lib for client-side, LibreOffice for high-fidelity server-side conversion |
| Canvas editing | Fabric.js | MIT, rich object model, active maintenance |
| Text shaping | HarfBuzz.js | MIT, WASM port of HarfBuzz, handles Bengali/Arabic |
| Fonts | Noto Sans/Serif Bengali, Siyam Rupali, Kalpurush, SolaimanLipi | All SIL OFL 1.1; comprehensive Bengali coverage with multiple style options |
| Document conversion | LibreOffice headless (unoserver) | MPL 2.0; high-fidelity PDF↔DOCX/ODT, complex layout rendering |
| Local storage | Dexie.js (IndexedDB) | Apache 2.0, clean API |
| State management | Zustand | MIT, minimal, no boilerplate |
| Build tool | Vite | MIT, fast HMR, modern defaults |
| Testing | Vitest + Playwright | MIT, integrates with Vite, E2E for browser tests |
| Table detection | pdfplumber (server) or heuristic (client) | MIT, good table extraction |

---

## 4. Recommended Open-Source Technology Choices

### 4.1 Frontend

| Component | Library | License |
|-----------|---------|---------|
| UI Framework | React 18 | MIT |
| Build Tool | Vite 5 | MIT |
| Language | TypeScript 5 | Apache 2.0 |
| PDF Rendering | PDF.js 4 | Apache 2.0 |
| PDF Generation | pdf-lib | MIT |
| Canvas Editor | Fabric.js 6 | MIT |
| Text Shaping | HarfBuzz.js | MIT |
| State | Zustand | MIT |
| API State | TanStack Query | MIT |
| Local DB | Dexie.js | Apache 2.0 |
| Router | React Router | MIT |
| Icons | Lucide React | ISC |
| Styling | Tailwind CSS 3 | MIT |
| Testing | Vitest + Playwright | MIT |

### 4.2 Backend

| Component | Library | License |
|-----------|---------|---------|
| API Framework | Fastify | MIT |
| ORM | Drizzle ORM | Apache 2.0 |
| Database | PostgreSQL 16 | PostgreSQL License (BSD-like) |
| Cache/Queue | Redis 7 or Valkey | RSALv2/SSPL or BSD (Valkey) |
| Job Queue | BullMQ | MIT |
| Validation | Zod | MIT |
| Auth | Custom OTP | — |
| Email | Nodemailer | MIT |

### 4.3 Python Worker

| Component | Library | License |
|-----------|---------|---------|
| Framework | FastAPI | MIT |
| PDF Text Extraction | pdfplumber | MIT |
| Table Detection | camelot-py | MIT |
| OCR | Tesseract (pytesseract) | Apache 2.0 |
| Font Tools | fonttools | MIT |

### 4.4 LibreOffice Worker

| Component | Library | License |
|-----------|---------|---------|
| Conversion Engine | LibreOffice headless | MPL 2.0 |
| Server Wrapper | unoserver | MIT |
| Document Formats | DOCX, ODT, RTF, HTML, PDF | — |
| Font Support | Noto, Siyam Rupali, Kalpurush, SolaimanLipi (bundled) | SIL OFL 1.1 |

**LibreOffice Worker Architecture:**
- Runs as a Docker container with `unoserver` daemon
- Receives conversion jobs via Redis queue (BullMQ)
- Supports: PDF→DOCX, DOCX→PDF, ODT→PDF, PDF→HTML, XLSX→PDF
- Bundles Bengali fonts (Noto Sans/Serif Bengali, Siyam Rupali, Kalpurush, SolaimanLipi)
- Used for high-fidelity export when pdf-lib's layout capabilities are insufficient
- Falls back to pdf-lib for simple text/shape/image exports

### 4.5 Infrastructure

| Component | Technology | License |
|-----------|-----------|---------|
| Reverse Proxy | Nginx | BSD-2 |
| Container | Docker | Apache 2.0 |
| Storage | Local FS behind S3 abstraction | — |
| CI/CD | GitHub Actions | — |

---

## 5. License and Cost Risks

### 5.1 Critical License Risks

| Dependency | License | Risk | Mitigation |
|-----------|---------|------|------------|
| **PyMuPDF (fitz)** | AGPL-3.0 | AGPL requires source disclosure to all network users. | **Do not use.** Use pdfplumber (MIT) + PDF.js (Apache 2.0). |
| **Ghostscript** | AGPL-3.0 | Same AGPL network-use clause. | Avoid. Use pdf-lib (MIT) for generation. |
| **MinIO** | AGPL-3.0 | AGPL applies if exposed as a service. | Use local filesystem with S3-compatible abstraction. Swap to AWS S3 or Cloudflare R2 later. |
| **Redis** | RSALv2 / SSPL | Redis 7.4+ changed license. Self-hosted on own VPS is permitted. | Self-host on VPS. Consider Valkey (BSD fork) as alternative. |
| **Handsontable** | Commercial / MIT dual | Commercial restrictions for SaaS. | **Do not use.** Build custom spreadsheet component. |
| **MuPDF** | AGPL-3.0 | Same as PyMuPDF. | Avoid. |

### 5.2 Font Licensing

| Font | License | Usage |
|------|---------|-------|
| Noto Sans Bengali | SIL OFL 1.1 | Free to embed, subset, redistribute; primary Bengali font |
| Noto Serif Bengali | SIL OFL 1.1 | Serif Bengali for formal documents |
| Siyam Rupali | SIL OFL 1.1 | Popular Bangla Unicode font, optimized for screen display |
| Kalpurush | SIL OFL 1.1 | Serif-styled Bengali, used in Bengali Wikipedia; print + screen |
| SolaimanLipi | SIL OFL 1.1 | Widely used Bangla font, clean sans-serif style |
| Noto Sans Arabic | SIL OFL 1.1 | Arabic/RTL support |
| Noto Sans Devanagari | SIL OFL 1.1 | Hindi support |
| Noto Sans (Latin) | SIL OFL 1.1 | English/Latin |
| Inter | SIL OFL 1.1 | UI font for application interface |

All fonts are explicitly licensed for embedding, subsetting, and redistribution under SIL OFL. Attribution required in documentation, not in UI.

**Font Sources:**
- Noto fonts: Google Fonts (fonts.google.com)
- Siyam Rupali: github.com/potasiyam/Siyam-Rupali
- Kalpurush: github.com/potasiyam/Kalpurush
- SolaimanLipi: github.com/digitb/solaimanlipifont (via fonts.maateen.me CDN)
- Inter: fonts.google.com/specimen/Inter

### 5.3 Cost Assessment

| Item | Phase 0 | Phase 1+ |
|------|---------|----------|
| Development | $0 | $0 |
| Fonts | $0 (Noto OFL) | $0 |
| All libraries | $0 (MIT/Apache/OFL) | $0 |
| Testing | $0 | $0 |
| VPS | — | ~$5-10/mo (Hostinger) |
| Domain | — | ~$10-15/yr |
| Email (OTP) | — | $0-5/mo (Brevo/Resend free tier) |
| Storage | — | $0-5/mo (R2 free tier) |
| Payment gateway | — | Per-transaction (Stripe, bKash/SslCommerz) |

---

## 6. Main Editor Visual-Concept Plan

### 6.1 Approach

After approval, I will create visual concepts as **interactive HTML mockups** rendered in the browser. Each concept will be a standalone HTML page with Tailwind CSS, demonstrating layout, spacing, and interaction patterns. This keeps the process code-native and immediately testable.

### 6.2 Concepts to Produce

1. **Landing Page** — Hero, feature highlights, Bangla+English demo, pricing teaser
2. **Main PDF Editor** — Full editor shell with all panels, PDF Layout Mode active
3. **Document Mode** — Word-style reflow editing view
4. **Table Mode** — Spreadsheet-style table editing overlay
5. **OCR Correction** — Side-by-side OCR result + original image with confidence highlighting
6. **Dashboard** — Project list, usage stats, recent activity
7. **Pricing Page** — Plan comparison, BD/International toggle
8. **Mobile Editor** — Simplified touch-optimized editor (viewing + annotation + signing)

### 6.3 Editor Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [DocFlow]  Project Name (editable)  [Saved]  [↶][↷]  [PDF|Doc|Table]  [Export][Share][Upgrade] │
├──────┬──────────────────────────────────────────────────────┬───────┤
│      │                                                       │       │
│ Page │                                                       │ Form- │
│ Thum │            Central Editing Canvas                      │ atting│
│ bnail│                                                       │ Inspec│
│ Side │            (PDF page render + canvas overlay)          │ tor   │
│ bar  │                                                       │       │
│      │                                                       │       │
│      │                                                       │       │
├──────┴──────────────────────────────────────────────────────┴───────┤
│ Page 1/5  |  Zoom: 100%  |  Selected: Text Box  |  bn-BD  |  ●  │
└─────────────────────────────────────────────────────────────────────┘
```

**Design principles:**
- Dense but not cluttered — like VS Code or Figma, not a consumer app
- Black/zinc base palette with gold accent — premium, professional feel
- No decorative gradients, no fake metrics, no unnecessary cards
- Professional typography (Inter for UI, Noto for document content)
- Collapsible/resizable panels
- Contextual toolbar that changes based on selected object type
- Command palette (Ctrl+K) for power users
- Keyboard-first interaction model

### 6.4 Design Token Plan

```
Colors:     black-900 (#0a0a0a app bg) → zinc-900 (#18181b panel) → zinc-800 (#27272a border) → zinc-100 (text)
Accent:     gold-500 (#d4af37 primary), gold-400 (#e6c659 hover), gold-600 (#b8941f active)
Success:    emerald-500
Danger:     red-500
Warning:    amber-500
Spacing:    4px base unit (4, 8, 12, 16, 24, 32, 48, 64)
Radius:     4px (controls), 8px (panels), 12px (modals)
Typography: Inter (UI), Noto Sans/Serif (document content)
Icons:      Lucide (1.5rem default, 1.125rem dense)
```

---

## 7. Test-Document Strategy

### 7.1 Required Test Documents

| # | Document | Purpose | Source |
|---|----------|---------|--------|
| 1 | Native English PDF | Basic text extraction/editing | Generate with pdf-lib |
| 2 | Native Bangla PDF | Bangla shaping, conjuncts, marks | Generate with pdf-lib + Noto Sans Bengali |
| 3 | Mixed Bangla-English | Mixed-script line rendering | Generate with pdf-lib |
| 4 | Embedded fonts PDF | Font extraction and matching | Generate with embedded Noto fonts |
| 5 | Missing fonts PDF | Font substitution logic | Generate, then strip font references |
| 6 | Scanned Bangla (image) | OCR fallback (Phase 0: visual edit only) | Scan or generate page image → PDF |
| 7 | Scanned English (image) | OCR fallback (Phase 0: visual edit only) | Scan or generate page image → PDF |
| 8 | Invoice/table PDF | Table detection + editing | Generate with pdf-lib table layout |
| 9 | Form PDF | Form field detection (basic in P0) | Generate with pdf-lib form fields |
| 10 | Rotated pages PDF | Rotation handling | Generate with rotated pages |
| 11 | 20-50 page document | Performance, page management | Generate multi-page PDF |

### 7.2 Generation Strategy

All test documents will be **programmatically generated** using pdf-lib and stored under `tests/fixtures/`. This ensures:
- Reproducibility
- No licensing concerns with real documents
- Known content for assertion-based testing
- Ability to regenerate if format changes are needed

### 7.3 Test Categories

| Category | Tool | What's Tested |
|----------|------|---------------|
| Unit (model) | Vitest | Document model CRUD, migrations, serialization |
| Unit (shaping) | Vitest | HarfBuzz shaping for Bangla/English/Arabic |
| Unit (export) | Vitest | PDF generation, font embedding, text placement |
| Integration | Vitest | Upload → edit → export → re-import cycle |
| Visual regression | Playwright | Exported PDF pages vs reference images |
| E2E | Playwright | Full user workflow in browser |

---

## 8. Definition of Success for Phase 0

### 8.1 Gate Criteria (All Must Pass)

1. **Bangla exports correctly** — Bangla text in exported PDF displays with correct conjuncts, vowel marks, reph, and phala. No broken glyph sequences. Verified by visual comparison against reference rendering.

2. **Table edits survive export** — A detected table edited in spreadsheet view (cell values changed, rows/columns added) must appear correctly in the exported PDF.

3. **Projects reopen correctly** — A saved project (IndexedDB) reopened must restore all pages, elements, text content, table data, and edit history.

4. **Unrelated content is not damaged** — Edits to one text block or table must not alter other elements on the page or other pages.

5. **Undo/redo is reliable** — Every operation (add, delete, modify, move, resize) can be undone and redone without data loss.

6. **Mixed Bangla-English renders correctly** — Lines containing both Bangla and English text display with correct shaping for both scripts.

7. **Font substitution works** — When original fonts are unavailable, substituted fonts render text legibly without layout corruption.

8. **Export validation** — Exported PDFs open correctly in PDF.js (browser) and at least one standard PDF reader. No corruption warnings.

### 8.2 Verification Method

- Automated: Vitest unit tests + Playwright E2E + visual regression
- Manual: Open exported PDFs in browser PDF viewer and Adobe Reader (or equivalent)
- Test matrix: All 11 test documents must pass upload → edit → export → re-import cycle

---

## 9. Confirmed Architecture Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Phase 0 processing | **Include Python worker** — server-side table detection via pdfplumber/camelot from start |
| Q2 | Redis vs Valkey | **Redis** — self-hosted on VPS |
| Q3 | Payment gateway priority | **Both simultaneously** — bKash + SslCommerz + Stripe with provider-independent layer |
| Q4 | Repository structure | **Monorepo** — frontend/, backend/, worker/, infra/ |
| Q5 | Email provider | **Self-hosted Postfix** on VPS |
| Q6 | Visual concepts | **Figma designs** |
| Q7 | Domain | **Placeholder** — docflow.local for dev |
| Q8 | Brand guidelines | **Gold and black** palette |
| Q9 | OCR research | Defer to Phase 2 |
| Q10 | Fabric.js | Yes, use Fabric.js (MIT) for canvas |

---

## Next Steps

1. Create Figma visual concepts for approval (gold/black palette)
2. Set up the monorepo project scaffold (M0.1)
3. Begin Phase 0 implementation milestone by milestone
4. Test each milestone before proceeding
5. Report honestly on limitations and failures

---

## 10. Phase 1 Implementation Plan

### 10.1 Objective

Transform the Phase 0 proof-of-concept into a production-ready web application with user accounts, cloud storage, server-side processing, and deployment infrastructure.

### 10.2 Scope

| Feature | In Scope | Out of Scope |
|---------|----------|-------------|
| User auth (email + OTP) | Yes | OAuth/social login |
| Backend API (Fastify) | Yes | GraphQL |
| PostgreSQL database | Yes | Migrations framework (use Drizzle) |
| Cloud project storage | Yes | Real-time collaboration |
| Python worker (OCR, tables) | Yes | GPU OCR |
| LibreOffice worker (conversion) | Yes | Collaborative editing |
| Dashboard (project list) | Yes | Admin panel |
| Pricing + billing (bKash, Stripe) | Yes | In-app purchases |
| Docker deployment | Yes | Kubernetes |
| Nginx reverse proxy | Yes | CDN |
| Email (Postfix) | Yes | Email marketing |
| E2E tests (Playwright) | Yes | Load testing |
| Mobile-responsive editor | Basic | Native mobile app |

### 10.3 Milestones

**M1.1 — Backend Scaffold & Auth**
- Fastify server with TypeScript, Zod validation
- Drizzle ORM + PostgreSQL schema (users, projects, billing)
- Email + OTP authentication (Nodemailer + Postfix)
- JWT session management
- Rate limiting (Redis)
- API tests (Vitest supertest)

**M1.2 — Project API & Cloud Storage**
- CRUD endpoints for projects
- S3-compatible storage abstraction (local FS initially)
- File upload/download endpoints
- Project sharing (signed URLs)
- Storage quota enforcement

**M1.3 — Python Worker**
- FastAPI service with BullMQ consumer
- PDF text extraction (pdfplumber)
- Table detection (camelot-py)
- OCR pipeline (Tesseract with Bangla+English)
- Bundled Bengali fonts (Noto, Siyam Rupali, Kalpurush, SolaimanLipi)
- Health checks + monitoring

**M1.4 — LibreOffice Worker**
- Docker container with unoserver daemon
- PDF→DOCX, DOCX→PDF, ODT→PDF conversion
- Bundled Bengali fonts in container
- Redis queue integration
- Conversion job API

**M1.5 — Frontend: Dashboard & Project Management**
- Dashboard page (project list, recent, usage stats)
- Project CRUD UI (create, rename, delete, duplicate)
- Cloud project sync (TanStack Query)
- Upload from dashboard
- Search/filter projects

**M1.6 — Frontend: Editor Enhancements**
- Connect editor to backend API (load/save cloud projects)
- Real PDF.js text editing (inline text reflow)
- Table spreadsheet UI (Handsontable alternative — custom grid)
- Image upload from file picker
- Signature pad (canvas freehand + typed)
- Font picker UI (from font-registry)
- Export dialog (PDF, DOCX via LibreOffice worker)
- Keyboard shortcuts (Ctrl+K command palette)

**M1.7 — Billing & Payments**
- Plan definitions (Free, Pro, Business)
- Stripe integration (international cards)
- bKash + SslCommerz integration (BD payments)
- Provider-independent payment layer
- Invoice generation
- Usage tracking + quota enforcement
- Pricing page UI (BD/International toggle)

**M1.8 — Infrastructure & Deployment**
- Docker Compose for dev (frontend, backend, worker, libreoffice, postgres, redis)
- Nginx reverse proxy config
- TLS certificates (Let's Encrypt for prod, self-signed for dev)
- Environment variable management
- GitHub Actions CI/CD pipeline
- VPS deployment scripts
- Backup strategy (PostgreSQL + storage)

**M1.9 — E2E Testing & QA**
- Playwright E2E tests (upload → edit → export → re-import)
- Visual regression tests
- Cross-browser testing (Chrome, Firefox, Safari)
- Mobile responsive testing
- Performance testing (20-page document)
- Security audit (OWASP top 10)

### 10.4 Phase 1 Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Framework | Fastify | MIT, fast, TypeScript-native |
| ORM | Drizzle ORM | Apache 2.0, type-safe, SQL-first |
| Auth | Email + OTP (JWT) | No third-party auth provider needed |
| Email | Postfix (self-hosted) | No recurring cost, full control |
| Payments | Stripe + bKash + SslCommerz | Global + BD market coverage |
| Queue | BullMQ (Redis) | MIT, battle-tested |
| Container | Docker + Docker Compose | Apache 2.0, industry standard |
| E2E Testing | Playwright | Apache 2.0, cross-browser |
| CI/CD | GitHub Actions | Free for open-source, integrated |

### 10.5 Phase 1 Definition of Success

1. **User can sign up, log in, and manage projects** — Full auth flow with OTP
2. **Projects sync to cloud** — Save/load from PostgreSQL + S3-compatible storage
3. **Server-side processing works** — Python worker extracts text/tables, LibreOffice converts
4. **Payments work** — Both Stripe and bKash can process payments
5. **App deploys via Docker** — Single `docker compose up` runs the full stack
6. **E2E tests pass** — Playwright tests cover the full user journey
7. **Mobile-responsive** — Editor works on tablet (iPad/Android)

---

## 11. Phase 3 Implementation Plan

### 11.1 Objective

Advanced document intelligence, user-facing features, and production hardening — transforming DocFlow from a functional app into a polished, secure, multilingual product.

### 11.2 Milestones

**M3.1 — Advanced Document Model Building**
- Proper text grouping: chars → runs → lines → paragraphs → blocks
- Page classification: digital / scanned / mixed
- Font matching/substitution with bundled Bengali fonts
- Table merge into document model
- OCR merge with word-level bounding boxes

**M3.2 — Enhanced OCR**
- Word-level bounding boxes from Tesseract
- Confidence heatmap (green/amber/red)
- OCR correction UI panel with inline editing
- Filter low-confidence words

**M3.3 — Real-time Job Progress (SSE)**
- Server-Sent Events endpoint for job status streaming
- Frontend SSE client integration

**M3.4 — Project Sharing & Public View**
- Public share routes (no auth required)
- SharedProjectPage viewer with page navigation
- Download shared PDF

**M3.5 — i18n & Bangla UI Localization**
- Full English + Bangla translation system
- useTranslation hook with locale toggle
- Persists locale to localStorage

**M3.6 — Search & Organization**
- Full-text search across project names and project data
- Tags column on projects table
- Search API endpoint with ILIKE + JSONB search

**M3.7 — Mobile-responsive Editor**
- Touch-optimized bottom controls bar
- Slide-out page navigation menu
- Zoom controls for touch

**M3.8 — Email Notifications**
- Job completion/failure emails
- Payment confirmation emails
- HTML email templates with DocFlow branding

**M3.9 — Annotations & Comments**
- Annotations DB table with page-level comments
- CRUD API for annotations
- AnnotationsPanel UI with resolve/delete
- Color-coded, resolved state tracking

**M3.10 — Security & Production Hardening**
- OWASP top 10: SQL injection detection, XSS sanitization, input validation
- Security middleware: file type/size validation, burst protection
- Batch operations: delete/process/convert multiple projects
- Monitoring: detailed health checks, process metrics
- Tags batch update

**M3.11 — Phase 3 Tests**
- Backend: phase3.test.ts (15 tests for public/annotation/batch/monitoring/SSE routes)
- Backend: security.test.ts (15 tests for security utilities)
- Frontend: i18n.test.tsx (7 tests for localization)
- Frontend: phase3-features.test.tsx (3 E2E tests for shared project page)
- Python: test_document_model.py (15 tests for document model building)

### 11.3 Key New Files (Phase 3)

**Backend:**
- `backend/src/middleware/security.ts` — OWASP security utilities
- `backend/src/services/annotation.service.ts` — Annotations CRUD
- `backend/src/routes/public.routes.ts` — Public share endpoints
- `backend/src/routes/annotation.routes.ts` — Annotation endpoints
- `backend/src/routes/batch.routes.ts` — Batch operations
- `backend/src/routes/monitoring.routes.ts` — Health & metrics
- `backend/src/test/phase3.test.ts` — Phase 3 route tests
- `backend/src/test/security.test.ts` — Security utility tests
- `backend/drizzle/phase3-annotations.sql` — Annotations migration

**Python Worker:**
- `worker/app/document_model.py` — Advanced document model builder
- `worker/app/test_document_model.py` — Document model tests

**Frontend:**
- `frontend/src/lib/i18n.ts` — i18n translation system (en + bn)
- `frontend/src/hooks/useTranslation.ts` — Translation hook
- `frontend/src/ui/editor/OcrCorrectionPanel.tsx` — OCR correction UI
- `frontend/src/ui/editor/AnnotationsPanel.tsx` — Annotations UI
- `frontend/src/ui/editor/MobileEditorControls.tsx` — Mobile controls
- `frontend/src/ui/shared/SharedProjectPage.tsx` — Public viewer
- `frontend/src/test/i18n.test.tsx` — i18n tests
- `frontend/src/test/e2e/phase3-features.test.tsx` — Phase 3 E2E tests
