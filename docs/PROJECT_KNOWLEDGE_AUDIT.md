# Project Knowledge Audit: HiKorea Forms

This document is the final aggregation of all hidden knowledge, architectural heuristics, and undocumented assumptions embedded within the HIkoreaFORMS project. It serves as a comprehensive inventory of system behavior and a mandatory checklist for all engineers.

---

## 1. Explicit Rules
* **Free Trial Limitations**: Users are allotted exactly 1 free package generation (`freeDownloadsUsed === 0`).
  * *Status*: Implemented in code.
* **Preview Watermarking**: Drafts generated without paid credits or login are diagonally stamped with "PREVIEW - NOT FOR SUBMISSION" at 14-18% opacity.
  * *Status*: Implemented in code.
* **Aspect Ratio Enforcement**: Image processing strictly scales Passports to 1.42, ID cards to 1.586, and Contracts to 1.414.
  * *Status*: Implemented in code.
* **Dev Mode Payment Bypass**: If `import.meta.env.DEV` is true, the PortOne API is entirely bypassed via a mock-success endpoint.
  * *Status*: Implemented in code.

## 2. Implicit Business Rules
* **Preview Delivery**: Due to browser popup blockers blocking `window.open` for dynamically generated PDF blobs, previews are forced into a direct download (`a.download`).
  * *Status*: Implemented in code / Missing documentation.
* **Monolithic State Control**: The entire application flow (Wizard steps, Auth, OCR, Payment) operates on a massive unified state within `ImmigrationMVP.jsx`, rather than a traditional multi-route system.
  * *Status*: Implemented in code / Missing documentation.
* **History State Tying**: Navigating the UI relies on strict query parameters (`?step=visa`) synced heavily with the browser's `popstate` event.
  * *Status*: Implemented in code.

## 3. Form-Specific Rules
* **Checkmark Injection**: Because `NanumGothic` (the core Korean font) cannot render standard Unicode checkmarks (✓), standard checkboxes are filled with a lowercase `v` using the `Helvetica` font.
  * *Status*: Implemented in code.
* **Guarantor Relationship Mapping**: "Parent" is mapped to "부" (Father) if male and "모" (Mother) if female. "Spouse" maps to "배우자".
  * *Status*: Implemented in code.
* **Occupation Type Mapping**: Occupation strings (e.g., "office", "retail") are directly mapped to hardcoded page coordinates in the occupation form PDF template.
  * *Status*: Implemented in code.

## 4. OCR Assumptions
* **ID Card Success Criteria**: ID Card OCR is completely dependent on extracting the `id_number`. If this fails, the OCR is deemed a failure (warning state), regardless of what else was extracted.
  * *Status*: Implemented in code.
* **Address Crop Fallback**: If a user does not provide a manual crop of their housing contract, the system blindly assumes the address is located in the top 33.3% of the document image.
  * *Status*: Implemented in code / Missing documentation.
* **Name Assembly**: The system assumes it can confidently assemble a `full_name` by blindly concatenating `surname` and `given_names` if `full_name` isn't explicitly returned by the Gemini AI.
  * *Status*: Implemented in code.

## 5. PDF Assumptions
* **Font Switching**: The PDF generator assumes that any string containing characters in the Unicode range `\uac00 <= c <= \ud7a3` is Korean and must use `NanumGothic`; otherwise, it can safely use `Helvetica`.
  * *Status*: Implemented in code.
* **Static Coordinates**: All PDF template injection relies on highly specific, static hardcoded coordinates (e.g., `x=154.3, y=307.4`). If the underlying PDF template changes even slightly, data injection will break entirely.
  * *Status*: Implemented in code / Missing documentation.

## 6. Mobile UX Assumptions
* **4-Corner Crop Trapeze**: It is assumed that the standard `react-image-crop` cannot handle perspective warping. A custom 4-point draggable SVG overlay handles non-rectangular document crops.
  * *Status*: Implemented in code / Implemented in documentation (`plan.md`).
* **Canvas Signatures**: It is assumed that users can smoothly sign using a canvas wrapper on mobile, and the signature is safely transmitted as a Base64-encoded `signature.jpg` Blob.
  * *Status*: Implemented in code.

## 7. Storage Assumptions
* **Temporary Processing Overhead**: `scan_processor.py` assumes the local filesystem (`multer` memory/disk) can handle raw uncompressed images. If concurrent usage spikes, it is assumed temporary files won't bottleneck I/O.
  * *Status*: Implemented in code / Missing documentation.

## 8. Payment Assumptions
* **PortOne Async Reliability**: It is assumed that the synchronous frontend PortOne verification is reliable, but a webhook fallback (`/api/payment/portone/webhook`) exists to catch delayed payments.
  * *Status*: Implemented in code.

## 9. Authentication Assumptions
* **Google OAuth Redirection**: It is assumed that returning from a successful Google OAuth via Passport.js will land the user on a route containing `?login=success`, which automatically forces a redirect to the "My Page" dashboard.
  * *Status*: Implemented in code.

## 10. Translation Assumptions
* **Key Fallbacks**: There is an implicit assumption that `react-i18next` will gracefully fall back to the raw key (e.g., `str_7`) if the English/Russian translation files (`ru.json`, `en.json`) are missing specific keys.
  * *Status*: Implemented in code / Missing documentation.

---

## The Engineer's Onboarding Checklist
**Do NOT modify HiKorea Forms until you understand the following:**

- [ ] **I understand that `ImmigrationMVP.jsx` is a monolith.** I will not blindly rip apart the 3400+ lines of state without understanding how `popstate` history, modal states, and OCR status variables are interlocked.
- [ ] **I understand the Python Bottleneck.** Modifying `pdf_generator.py` or `scan_processor.py` implies understanding `child_process` blocking in Node.js. High concurrency will strain the server.
- [ ] **I understand the PDF Hardcoding.** I will not update a base PDF template in `/templates` without painstakingly recalculating the `X,Y` text insertion coordinates in `pdf_generator.py`.
- [ ] **I understand the Checkmark Hack.** If I need to add a checkbox to a form, I must use `Helvetica` and the letter `v`.
- [ ] **I understand the OCR Constraints.** Gemini AI is used for OCR. I will not assume OCR results are structured perfectly. I must anticipate missing fields and handle the `warning` state gracefully.
- [ ] **I understand the DEV Payment Bypass.** I will ensure `import.meta.env.DEV` is never accidentally enabled in production, or I will bypass the PortOne payment gateway.
- [ ] **I understand the Nginx Routing.** I understand that static assets are served from `/var/www/hikoreaforms/dist` and the API is proxied to `127.0.0.1:3001`. I will rebuild the Vite frontend on every major UI update before restarting the Node server.
