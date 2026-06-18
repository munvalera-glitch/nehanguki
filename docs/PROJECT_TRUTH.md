# Project Truth

This document consolidates the latest audits into a single product and engineering truth map. It is not a code walkthrough. Its purpose is to separate what the project currently does from what the project should officially consider true.

Sources used:

- `docs/ACTIVE_PROJECT_MAP.md`
- `docs/PROJECT_CONFLICTS.md`
- `docs/PROJECT_KNOWLEDGE_AUDIT.md`
- `docs/EXTRACTED_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/WORKFLOWS.md`

## Pricing

### CURRENT TRUTH

Pricing is divided into two models: Retail and B2B.
- Retail: New users receive 1 free generation. After the free generation, retail users pay in KRW directly per package: 1 form = 3,000 KRW, 2 forms = 4,000 KRW, 3+ forms = 5,000 KRW. Password recovery costs 3,000 KRW. Retail users do not see or use credits.
- B2B: Marked by the `isB2B` flag. B2B users operate on a credit-based system. 1 form = 3 credits, 2 forms = 4 credits, 3+ forms = 5 credits. B2B users bypass PortOne gateway during generation and their credits are deducted directly.

### CONFLICTS

Older docs refer to 15 free credits on sign up, and credits for retail users.

### RECOMMENDED TRUTH

The official truth should be: Retail uses direct KRW payments after one free generation. B2B uses credits. Credit UI should be hidden from retail users. All legal, footer, payment modal, cart, and My Page copy should use this model and treat older fixed-price or trial-generation wording as legacy.

## Credits

### CURRENT TRUTH

Users have a credit balance stored as `paidGenerationsRemaining`. New users receive 15 starting credits. Final download, email delivery, and fax consume credits after generation succeeds. Existing paid packages can be regenerated without charging again.

### CONFLICTS

The deprecated trial-generation model still appears in legacy documentation, old files, and some stale UI concepts. The name `paidGenerationsRemaining` is misleading now that the value represents credits, not one generation per unit.

### RECOMMENDED TRUTH

The official truth is final: credits are the only access currency, and new users receive 15 credits. Rename user-facing and internal language toward "credits", not "generations". Legacy trial-generation language should be removed from current product, legal, and onboarding copy.

## Authentication

### CURRENT TRUTH

Authentication supports Google OAuth and email/password. Email registration and password reset use six-digit verification codes, stored in memory, with short rate limits. Sessions are managed through Express Session and Passport. Final delivery actions require login.

### CONFLICTS

Older workflow docs emphasize Google login for advanced features, while active backend also supports email/password. Verification code storage is in memory, which is acceptable for a single-server MVP but not a robust production truth.

### RECOMMENDED TRUTH

The official truth should be: both Google OAuth and email/password are supported login methods. Verification codes and sessions should be considered single-server infrastructure until moved to persistent storage or Redis. Final PDF, email, cart payment, and fax flows must require authenticated users.

## OCR

### CURRENT TRUTH

OCR is powered by Google Gemini through root `server.js`. The frontend uploads images, optionally processes them through `pdf/scan_processor.py`, and then sends cleaned images to OCR endpoints. OCR returns structured JSON and the frontend hydrates applicant, provider, guarantor, address, and school state. Missing fields generally produce warnings rather than blocking the user.

### CONFLICTS

Documentation states that the contract address fallback is the top 33.3% of the image, but active flows have evolved around manual crop and 4-corner processing. OCR prompts demand valid JSON, but fallback regex parsing is still needed. Name parsing remains fragile, especially for multi-line names and non-Western name structures.

### RECOMMENDED TRUTH

The official truth should be: OCR is assistive, not authoritative. OCR results must always be user-reviewable. ID card OCR success should require an ID number, but missing OCR fields should never prevent manual completion. Address extraction should prefer explicit user crop over blind defaults.

## PDF Generation

### CURRENT TRUTH

Root `server.js` calls `pdf/pdf_generator.py`, not root `pdf_generator.py`. PDF generation uses PyMuPDF and fixed template coordinates. The active templates live under `templates/`. Preview PDFs are watermarked with "PREVIEW - NOT FOR SUBMISSION". Official form count determines pricing and generated package contents.

### CONFLICTS

Documentation sometimes describes root `pdf_generator.py` or generic `pdf_generator.py` without distinguishing the active `pdf/pdf_generator.py`. Checkmark documentation says Helvetica, while the active generator often inserts `v` or `V` using NanumGothic. Docs imply uploaded document scans may be merged, but active generation disables general scan-copy attachment.

### RECOMMENDED TRUTH

The official truth should be: active PDF generation is `pdf/pdf_generator.py`, and PDF coordinates are template-specific hardcoded production data. Any template update requires coordinate recalibration and visual verification. Checkmark rendering should be standardized and documented after visual QA.

## Signatures

### CURRENT TRUTH

Signatures are captured in the frontend as canvas/base64 data and sent to backend generation as image data or `signature.jpg`. Required signatures depend on action and submission method. Password recovery requires applicant signature. Online submission can require applicant, guarantor, and accommodation provider signatures depending on form type.

### CONFLICTS

Older docs describe a simpler single-signature flow. Active frontend has multi-role signatures, while some backend fields and older payload names still reflect previous versions. Existing packages without `submissionMethod` use heuristic fallback to online/offline.

### RECOMMENDED TRUTH

The official truth should be: signatures are role-based. Required roles are derived from application type, housing type, visa type, and submission method. Every package should persist `submissionMethod` and a normalized `signatures` object to avoid heuristic fallback.

## Accommodation Forms

### CURRENT TRUTH

Accommodation provider forms are generated when `housingType === "other"` and the action is not password recovery. Provider details include name, ID number, phone, nationality, and accommodation option data such as relationship, ownership type, and residence type. Provider OCR can read provider ID card or provider contract data.

### CONFLICTS

Older workflow docs describe accommodation mainly as contract/address handling, while active code includes provider consent, provider signatures, and option selection. General uploaded scan copies are disabled, so provider uploaded images are mainly OCR/source data unless specifically saved for a special flow.

### RECOMMENDED TRUTH

The official truth should be: accommodation forms are a first-class subflow for non-self housing. They require provider identity data and should require provider signature for online submission unless the provider is also the guarantor and product policy explicitly permits reuse.

## F4 Forms

### CURRENT TRUTH

F4 applications generate the F4 residence declaration form instead of the standard application form. If `visaType === "F4"` and `action === "initial"`, the non-employment pledge / otkaz form is also generated when the template exists.

### CONFLICTS

Older docs list F4 Goso and Otkaz support but do not clearly define when each appears. The F4 initial package can therefore look like a special case compared with other visa types.

### RECOMMENDED TRUTH

The official truth should be: F4 uses the F4-specific Goso form, and initial F4 applications also include the non-employment pledge. This should be product-copy visible before payment so users understand the package contents and credit cost.

## Password Recovery

### CURRENT TRUTH

Password recovery is a dedicated action that generates a password recovery PDF. It requires applicant identity data, ID card front/back files, and applicant signature. Fax sending is currently restricted to password recovery. Password recovery costs 3 credits and is treated as one official form.

### CONFLICTS

Some docs describe fax as a broad immigration-office delivery feature, but active backend restricts `/api/fax/send` to password recovery. Password recovery also stores ID card images more persistently than ordinary package flows.

### RECOMMENDED TRUTH

The official truth should be: fax is currently a password-recovery delivery channel only. If fax is intended for all immigration packages, that must become an explicit future feature with destination selection, pricing, and storage policy.

## Storage

### CURRENT TRUTH

Active storage is file-based JSON under `data/`, unless `DATA_DIR` overrides it. Users are stored in `data/users.json`, packages in `data/packages.json`, and saved uploads under `data/uploads/<packageId>/`. Package payloads are stored to allow regeneration. A cleanup job scrubs personal package payloads and upload folders after 14 days.

### CONFLICTS

Privacy text says data is stored as long as needed or until account deletion, while active cleanup scrubs package personal data after 14 days. Verification and reset codes are stored in memory rather than durable storage. General uploaded scan copies are disabled for packages despite docs implying merged scan copies.

### RECOMMENDED TRUTH

The official truth should be: package personal data is temporary and should be scrubbed after a defined retention period. Account data and payment metadata may persist longer. Storage rules should be explicitly reflected in privacy policy and operational docs.

## Cart

### CURRENT TRUTH

Cart is implemented through unpaid saved packages. Users can add an application to cart, preview it, select multiple unpaid packages, pay, and download/send actions later. Cart totals are calculated from package credits and can account for existing user credits.

### CONFLICTS

Cart behavior overlaps with payment, draft generation, package history, and final delivery. Older docs describe simpler payment flow and do not fully capture unpaid package lifecycle, selected cart items, or submission method prompts.

### RECOMMENDED TRUTH

The official truth should be: cart is the unpaid package queue. An unpaid package is a saved application awaiting payment or credit use. A paid package is a reusable generation record. Cart docs should define package states: `unpaid`, `pending_transfer`, `paid`, and fax statuses where applicable.

## Email Delivery

### CURRENT TRUTH

Authenticated users can send generated PDF packages to their account email through `/api/generate/package-email`. The backend requires a user email, checks credits/payment like download, generates the PDF, and sends it via Nodemailer SMTP.

### CONFLICTS

Email delivery is not emphasized in older architecture/workflow docs. Email depends on SMTP configuration, and failure after generation may produce a delivery error even if the package generation itself succeeded. The email attachment name logic may not always reflect the active payload shape.

### RECOMMENDED TRUTH

The official truth should be: email delivery is an alternative final delivery method equivalent to download for payment and credit purposes. SMTP configuration is required in production. Product copy should distinguish "generated successfully" from "email delivered successfully".

## Mobile UX

### CURRENT TRUTH

The app is a mobile-oriented SPA with a monolithic wizard in `src/ImmigrationMVP.jsx`. It uses URL step syncing, modals, manual image adjustment, 4-corner crop, and canvas signatures. PDF preview uses forced download rather than `window.open` because popup blockers can block blob preview tabs.

### CONFLICTS

Older docs mention `react-image-crop` limitations and custom 4-corner selection, but active flows include both rectangular crop and 4-corner processing. The monolithic wizard remains a maintainability risk. Browser back/forward behavior is tied to query params and history state.

### RECOMMENDED TRUTH

The official truth should be: the mobile UX is wizard-first and modal-heavy. Image correction and signature capture are core mobile features. Any future refactor must preserve URL step recovery, modal state expectations, OCR warnings, and payment/cart continuity.

## Admin Panel

### CURRENT TRUTH

The active admin panel is `src/AdminPanel.jsx`. Access is restricted to the hardcoded admin email `munvalera@gmail.com`. Admin can inspect users and adjust permanent credits, temporary credits, unlimited access dates, and B2B flag through `/api/admin/update-user`.

### CONFLICTS

The duplicate root `AdminPanel.jsx` sends old field names (`permanentCredits`, `temporaryCredits`) that do not match root `server.js` expected additive fields (`addPermanentCredits`, `addTemporaryCredits`). Active `src/AdminPanel.jsx` appears aligned, but duplicate drift creates audit confusion and regression risk.

### RECOMMENDED TRUTH

The official truth should be: only `src/AdminPanel.jsx` is active. Admin credit changes should be additive unless product explicitly wants absolute balance setting. Admin authorization should eventually move from a hardcoded email to a role field in user storage.

## Deployment

### CURRENT TRUTH

Production uses Vite build output served by Nginx from `/var/www/hikoreaforms/dist`. API traffic under `/api/` is proxied to root `server.js` running on `127.0.0.1:3001`. HTTPS is configured through Let's Encrypt in `hikoreaforms_nginx.conf`. `npm run start` builds the frontend and starts root `server.js`.

### CONFLICTS

The repository contains duplicate server/frontend/generator files, so deployment truth can be misread if someone follows file names rather than `package.json`, `index.html`, and root `server.js` call paths. There is also an `nginx_config` duplicate alongside `hikoreaforms_nginx.conf`.

### RECOMMENDED TRUTH

The official truth should be: production deployment is `npm run build` plus root `server.js` behind `hikoreaforms_nginx.conf`. Active source paths must be verified through entrypoints before edits. Duplicate files should be deleted, archived, or clearly marked as inactive.
