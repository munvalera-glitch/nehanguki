# Document Inventory & Knowledge Map

This document catalogues all found documentation, configuration files, test outputs, and templates across the HIkoreaFORMS repository. It highlights the purpose of each file and the hidden project knowledge it may contain.

No `TODO`, `FIXME`, or `NOTE` comment blocks were found within the source code during this extraction, indicating that institutional knowledge is mostly kept in explicit files rather than inline codebase notes.

---

## 1. Markdown Documentation (`.md`)

| Path | File Type | Purpose | Hidden Knowledge Contained |
| :--- | :--- | :--- | :--- |
| `/plan.md` | Markdown | Document alignment plan | Contains the mathematical and UX logic for the custom 4-corner SVG cropper used in the frontend due to `react-image-crop` limitations. |
| `/AGENTS.md` | Markdown | Core Audit Document | Contains the summarized AI-assisted project rules, structure, and architecture overview. |
| `/docs/ARCHITECTURE.md` | Markdown | System Architecture | Defines the monolithic SPA + Express Backend + Python processing pipeline structure. |
| `/docs/EXTRACTED_RULES.md` | Markdown | Business Logic Rules | Catalogs strict OCR fallback patterns, PDF scaling constraints, and font rendering hacks. |
| `/docs/PROJECT_KNOWLEDGE_AUDIT.md` | Markdown | Onboarding Audit | The definitive checklist of fragile architectural assumptions (e.g., Python blocking the Node event loop). |
| `/docs/KNOWN_BUGS.md` | Markdown | Debt & Bugs | Documents the `window.open` PDF preview block, OCR name parsing quirks, and monolithic UI vulnerabilities. |
| `/docs/FEATURES.md` | Markdown | Feature List | Overviews supported templates, Gemini OCR integrations, PortOne payments, and Popbill fax. |
| `/docs/WORKFLOWS.md` | Markdown | User Journeys | Step-by-step logic detailing how a user logs in, generates PDFs, signs canvas forms, and completes PortOne payments. |
| `/i18n/translation_report.md`<br>`/src/i18n/translation_report.md` | Markdown | Translation Sync Report | Generated automatically by the locale extraction script, showing missing vs translated keys. |

---

## 2. JSON Configurations & Data (`.json`)

| Path | File Type | Purpose | Hidden Knowledge Contained |
| :--- | :--- | :--- | :--- |
| `/package.json` | Config | NPM Dependencies | Defines scripts (`start`, `build`, `dev`). Shows the app relies on `express`, `vite`, `multer`, `passport`, `@google/genai`, and `popbill`. |
| `/data/users.json` | Local DB | File-based User Storage | Proves the system currently bypasses a traditional SQL/NoSQL database in favor of a local flat-file JSON datastore for user accounts. |
| `/data/packages.json` | Local DB | File-based Package Storage | Stores historical references to user package generation credits and logs. |
| `/shablon_otkaz_coordinates.json` | Config | PDF Coordinates | Hardcoded (x,y) text insertion maps for the Otkaz (waiver) PDF generator. |
| `/i18n/ru.json`<br>`/src/i18n/ru.json` | Config | Russian Translations | The core dictionary mapping generic `str_*` keys to actual Russian UI strings. |
| `/draft.json` | Test Data | Mock Payload | Used to locally test the `/api/generate/package-draft` endpoint. |

---

## 3. PDF Templates (`.pdf`)
*All files located in `/templates/`. These are the pristine base PDFs into which `pdf_generator.py` injects PyMuPDF text strings based on hardcoded `(x, y)` coordinate systems.*

| Path | Purpose |
| :--- | :--- |
| `application.pdf` | Unified Visa Application Form |
| `accommodation.pdf` | Confirmation of Accommodation Provider |
| `guarantee.pdf` | Letter of Guarantee (신원보증서) |
| `occupation.pdf` | Occupation & Annual Income Report |
| `goso_f4.pdf` | F-4 Residence Declaration |
| `school_report.pdf` | Enrollment Certificate Report |
| `f4_non_employment_pledge.pdf` | Pledge for F-4 Non-Employment in restricted fields |
| `password_recovery.pdf` | Likely used to generate a physical request form for account access. |

---

## 4. Test Outputs (`.pdf` / `.jpg` / `.png`)
*The root directory and `/outputs/` contain over 20+ test files (e.g., `test_occ_manual.pdf`, `test_checkmarks.pdf`, `acc_v2_test1.pdf`).*
- **Purpose**: These were left behind by the developer while calibrating the hardcoded PyMuPDF injection coordinates.
- **Hidden Knowledge**: They demonstrate the visual evolution of the `Helvetica` checkmark injection hack and the testing of the `NanumGothic` font rendering.

---

## 5. Missing File Types
No `.txt`, `.csv`, `.xlsx`, or `.docx` files were found in the repository during this extraction.
