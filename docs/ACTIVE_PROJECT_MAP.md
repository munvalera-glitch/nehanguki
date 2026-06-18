# Active Project Map

This file records the currently active production paths discovered during the latest project audit. It intentionally ignores old duplicates unless they are needed to explain what not to trust.

## Active Frontend

- Entry chain: `index.html` -> `/src/main.jsx`.
- Evidence: `index.html` loads `<script type="module" src="/src/main.jsx"></script>`.
- App bootstrap: `src/main.jsx` imports `./App.jsx`, and `src/App.jsx` renders `src/ImmigrationMVP.jsx`.
- Active app component: `src/ImmigrationMVP.jsx`.
- Active supporting frontend components include `src/AuthModal.jsx`, `src/AdminPanel.jsx`, `src/ImageEditorModal.jsx`, `src/ImageAdjustmentModal.jsx`, and `src/FourCornerSelector.jsx`.

## Active Backend

- Active backend entry: root `server.js`.
- Evidence: `package.json` uses `node server.js` for `server`, and `npm run start` runs `npm run build && node server.js`.
- Runtime port: `process.env.PORT || 3001`.
- The duplicate `src/server.js` is not the production backend entry.

## Active PDF Generator

- Active PDF generator directory: `pdf/`.
- Active PDF generator file: `pdf/pdf_generator.py`.
- Evidence: root `server.js` defines `PDF_SCRIPT = resolve(__dirname, "pdf", "pdf_generator.py")`.
- Evidence: root `server.js` runs Python snippets with `sys.path.insert(0, resolve(__dirname, "pdf"))` and imports from `pdf_generator`.
- Therefore, root `pdf_generator.py` is not the active production generator unless a separate script manually calls it.

## Active Image Processor

- Active image processor file: `pdf/scan_processor.py`.
- Evidence: root `server.js` handles `/api/document/process-scan-preview` and sets `scriptPath = resolve(__dirname, "pdf", "scan_processor.py")`.
- Therefore, root `scan_processor.py` is not the active production image processor for the Express API.

## Active i18n Path

- Active i18n bootstrap: `src/i18n/index.js`.
- Active locale files: `src/i18n/locales/ru.js`, `src/i18n/locales/en.js`, `src/i18n/locales/ko.js`.
- Evidence: `src/main.jsx` imports `./i18n`, resolving to `src/i18n/index.js`.
- Default language: `localStorage.getItem("appLanguage") || "ru"`.
- Fallback language: `ru`.
- Root `i18n/` files are duplicates or generated/legacy copies, not the frontend production path.

## Active Data Storage

- Active storage root: `DATA_DIR = process.env.DATA_DIR || resolve(__dirname, "data")` in root `server.js`.
- Active users DB: `data/users.json` unless `DATA_DIR` overrides it.
- Active packages DB: `data/packages.json` unless `DATA_DIR` overrides it.
- Active upload persistence path: `data/uploads/<packageId>/`.
- Draft image data may exist under `data/drafts_images/`, but package generation and saved uploads use the paths above.

## Active Deployment Config

- Active deployment config: `hikoreaforms_nginx.conf`.
- Production domain: `hikoreaforms.com`.
- Static frontend root: `/var/www/hikoreaforms/dist`.
- API proxy: `/api/` -> `http://127.0.0.1:3001`.
- SSL: Let's Encrypt paths under `/etc/letsencrypt/live/hikoreaforms.com/`.
- Production startup rule: `npm run start` builds the frontend and then runs root `server.js`.

## Do Not Trust Without Verification

These files exist, but should not be treated as active production sources unless a fresh command or import path proves otherwise:

- `ImmigrationMVP.jsx` at the repository root. The active frontend app is `src/ImmigrationMVP.jsx`.
- `AdminPanel.jsx` at the repository root. The active frontend admin panel is `src/AdminPanel.jsx`.
- `src/server.js`. The active backend is root `server.js`.
- `pdf_generator.py` at the repository root. The active generator imported by root `server.js` is `pdf/pdf_generator.py`.
- `scan_processor.py` at the repository root. The active scan processor called by root `server.js` is `pdf/scan_processor.py`.
- Root `i18n/` locale files. The active frontend uses `src/i18n/`.
- Backup files such as `*.bak`, generated reports, test files, screenshots, and old calibration PDFs.

