# Project Conflicts

This file lists contradictions found during the latest audit. These are not all bugs with equal severity; some are stale documentation or duplicate-file drift. Treat each item as something that needs verification before product or engineering decisions.

## Legacy Trial Access vs Official Credit Model

- Official product behavior is credit-based.
- New users receive 15 credits.
- The old trial-generation model is deprecated and removed from current product truth.
- Any remaining documentation or UI copy that implies trial-generation access is legacy documentation and should not guide implementation.
- Result: current docs should be updated to the credit model rather than preserving old access language.

## 15 Starting Credits vs Legacy Access Copy

- Root `server.js` creates new Google and email users with `paidGenerationsRemaining: 15`.
- Official product truth now treats this as a 15-credit starting balance.
- Legacy legal and UI copy may still describe older access behavior.
- Result: the 15-credit starting balance is current behavior; legacy access copy should be removed.

## Credit Tiers vs Fixed KRW Pricing Text

- Official pricing logic maps package complexity to credits:
  - 1 official form = 3 credits.
  - 2 official forms = 4 credits.
  - 3 or more official forms = 5 credits.
  - HiKorea password recovery = 3 credits.
  - 1 credit = 1,000 KRW.
- Legacy docs and stale copy may mention fixed per-generation KRW prices.
- Result: fixed per-generation price references are legacy documentation and should not be considered current product behavior.

## PortOne Webhook Broad Pending-Transfer Marking

- `/api/payment/portone/verify` can mark packages as `pending_transfer` for virtual accounts.
- `/api/payment/portone/webhook` verifies the PortOne payment but does not reliably match `paymentId` to a specific package.
- The webhook loops through pending transfer packages and marks pending records as `paid` broadly.
- Result: a webhook can over-mark unrelated pending packages as paid.

## Admin Credit Field Mismatch

- Root `server.js` expects `addPermanentCredits` and `addTemporaryCredits` in `/api/admin/update-user`.
- Active `src/AdminPanel.jsx` currently sends `addPermanentCredits` / `addTemporaryCredits`, so the active path appears aligned now.
- The old root `AdminPanel.jsx` still sends `permanentCredits` / `temporaryCredits`.
- Earlier audit results flagged this as `permanentCredits` vs `addPermanentCredits`; that mismatch now appears to live in the duplicate root component, not the active `src` component.
- Result: this is a duplicate-file conflict and a regression risk if someone edits or reactivates root `AdminPanel.jsx`.

## Checkmark Helvetica vs Nanum Behavior

- Audit documentation says checkmarks should use Helvetica because NanumGothic cannot render the Unicode checkmark glyph.
- Active `pdf/pdf_generator.py` mostly inserts literal `v` or `V` with `fontname="nanum"` and `fontfile=FONT`.
- Some comments and older docs still describe a Helvetica workaround.
- Result: documentation and active generator behavior disagree; visual output must be verified before changing checkbox code.

## Uploaded Scan Copies Disabled

- Documentation describes package merge behavior including uploaded document copies.
- Root `server.js` has `ATTACH_UPLOADED_DOCUMENT_COPIES = false` in package generation, draft saving, download, and email flows.
- Files such as signatures and password-recovery ID card images can still be saved, but general passport/ID/contract scan attachment is disabled.
- Result: docs imply scans may be merged into final packages, while active production code disables this behavior.

## Active vs Duplicate Files

- Active frontend: `index.html` -> `src/main.jsx` -> `src/App.jsx` -> `src/ImmigrationMVP.jsx`.
- Duplicate frontend files exist at the repository root, including `ImmigrationMVP.jsx` and `AdminPanel.jsx`.
- Active backend: root `server.js`; duplicate `src/server.js` exists.
- Active PDF generator: `pdf/pdf_generator.py`; duplicate root `pdf_generator.py` exists.
- Active scan processor: `pdf/scan_processor.py`; duplicate root `scan_processor.py` exists.
- Active i18n: `src/i18n/`; duplicate root `i18n/` exists.
- Result: searching the repository without checking import/call paths can easily produce false conclusions.
