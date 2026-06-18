# Known Bugs & Technical Debt

This document outlines known issues, quirks, and potential bugs identified during the project audit of HIkoreaFORMS.

## 1. Frontend / UX Issues
- **`window.open` Blocked**: The PDF preview generation originally tried to open a new tab (`window.open`), but browser popup blockers prevented it. It has been replaced with a forced download approach (`a.download`), which is a bit clunky for "Preview".
- **Massive Monolithic Component**: `ImmigrationMVP.jsx` is over 3,400 lines long. State management for forms, OCR, user session, payment, and errors are all tangled in one file. This creates maintainability risks.
- **URL Step Syncing**: Navigation relies on `window.history.pushState` tightly coupled with `useEffect` popstate listeners. Rapid back/forward navigation during loading states might cause race conditions.

## 2. OCR and Data Extraction
- **Name Parsing Logic**: Asian vs. Western name structures confuse the OCR. The logic attempts to assemble `full_name` from `surname` and `given_names`, but Gemini sometimes clumps them together or splits patronymics unpredictably.
- **Address Bounding Boxes**: The manual address crop calculates percentages based on canvas size, but if the original image aspect ratio differs heavily, the `cropImageToBlob` can distort the output sent to OCR.

## 3. Backend & Python Interop
- **Concurrency & Python Execution**: `server.js` calls python scripts via `child_process.exec` or `spawn` synchronously for PDF generation. High concurrent usage will severely bottleneck the Node.js event loop and consume massive RAM.
- **Temporary Files**: `scan_processor.py` and `multer` save intermediate image files. If a process crashes before cleanup, it leads to orphaned temporary files cluttering the disk.
- **Hardcoded Coordinates**: `pdf_generator.py` uses hardcoded point coordinates (e.g., `x=154.3, y=307.4`) which breaks if the base template PDF is ever updated or scaled differently.

## 4. Payment Integration
- **Mock Payments in DEV**: The `handleSimulatedPayment` logic bypasses PortOne entirely in `DEV` mode. If `DEV` flags are accidentally pushed to prod, payments could be bypassed.
