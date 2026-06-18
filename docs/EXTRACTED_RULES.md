# Extracted Project Rules Inventory

This document represents a comprehensive extraction of existing rules found within the HIkoreaFORMS codebase, documentation, and configuration files.

## Business Rules

### 1. Free Trial Allocation
- **Description**: Users are allowed exactly 1 free package download.
- **Source file(s)**: `ImmigrationMVP.jsx`
- **Evidence from code**: `const hasFree = user.freeDownloadsUsed === 0;` inside `ensureGenerationAccess`.
- **Confidence level**: Confirmed in code

### 2. Preview Limitations
- **Description**: Draft/Preview PDFs are heavily watermarked to prevent submission.
- **Source file(s)**: `pdf_generator.py`
- **Evidence from code**: `apply_watermark` function adds "PREVIEW - NOT FOR SUBMISSION" at 42 degrees, with 14-18% opacity.
- **Confidence level**: Confirmed in code

### 3. Login Requirement for Final Delivery
- **Description**: Users must be authenticated to download final (unwatermarked) packages or send faxes.
- **Source file(s)**: `ImmigrationMVP.jsx`
- **Evidence from code**: `if (!user) { setAuthModal({ open: true, type: "login" ... }); return false; }` in `ensureGenerationAccess`.
- **Confidence level**: Confirmed in code

---

## OCR Rules

### 1. Required ID Card Fields
- **Description**: ID Card OCR is only considered completely successful if an `id_number` is found.
- **Source file(s)**: `ImmigrationMVP.jsx`
- **Evidence from code**: `if (idNumber) { setIdCardOcrStatus("success"); } else { setIdCardOcrStatus("warning"); }`
- **Confidence level**: Confirmed in code

### 2. Contract Address Auto-Cropping
- **Description**: If a user does not manually crop the address from a housing contract, the system assumes the address is in the top 33.3% of the image.
- **Source file(s)**: `ImmigrationMVP.jsx`
- **Evidence from code**: `const crop = manualCrop || { x: 0, y: 0, width: 100, height: 33.3 };`
- **Confidence level**: Confirmed in code

### 3. Missing Field Fallbacks (Passport)
- **Description**: If the Passport OCR misses any expected field, it raises a UI warning but does not block the user from proceeding.
- **Source file(s)**: `ImmigrationMVP.jsx`
- **Evidence from code**: Loops through extracted fields and sets `setPassportOcrStatus("warning")` if `hasMissing` is true.
- **Confidence level**: Confirmed in code

### 4. Enforced Aspect Ratios
- **Description**: Pre-processing strictly enforces aspect ratios depending on the document type.
- **Source file(s)**: `scan_processor.py`
- **Evidence from code**: `target_ar = 1.42` for passports, `1.586` for ID cards, `1.414` for contracts.
- **Confidence level**: Confirmed in code

---

## PDF Rules

### 1. Font Encoding & Support
- **Description**: Korean text relies strictly on `NanumGothic.ttf`, while simple checkboxes rely on `Helvetica`.
- **Source file(s)**: `pdf_generator.py`
- **Evidence from code**: Checkmarks use `fontname="helv"` with a lowercase `"v"`. Text uses `fontname="nanum", fontfile=FONT`.
- **Confidence level**: Confirmed in code

### 2. Dynamic Korean Checkmark Injection
- **Description**: Since NanumGothic cannot render standard Unicode checkmarks (✓), a lowercase 'v' is injected using Helvetica.
- **Source file(s)**: `pdf_generator.py`
- **Evidence from code**: `page.insert_text(..., "v", ... fontname="helv" ...)` used for sex and occupation checkboxes.
- **Confidence level**: Confirmed in code

### 3. School Name Font Switcher
- **Description**: The School form dynamically switches between NanumGothic and Helvetica based on whether the school name contains Hangul characters.
- **Source file(s)**: `pdf_generator.py`
- **Evidence from code**: `any('\uac00' <= c <= '\ud7a3' for c in school)`
- **Confidence level**: Confirmed in code

### 4. Guarantor Relationship Mapping
- **Description**: When the guarantor's relationship is "parent" or "spouse", it is dynamically translated into Korean ("부" / "모" / "배우자") before generating the PDF.
- **Source file(s)**: `ImmigrationMVP.jsx`
- **Evidence from code**: `mappedRelationship = guarantor.sex === 'male' ? "부" : "모";`
- **Confidence level**: Confirmed in code

---

## Payment Rules

### 1. PortOne Integration
- **Description**: Korean payments are verified against the PortOne API both synchronously via frontend and asynchronously via Webhooks.
- **Source file(s)**: `server.js`
- **Evidence from code**: Endpoints `/api/payment/portone/verify` and `/api/payment/portone/webhook`.
- **Confidence level**: Confirmed in code

### 2. Dev Mode Payment Bypass
- **Description**: If the app is run in DEV mode, the payment flow can be fully simulated without hitting PortOne.
- **Source file(s)**: `ImmigrationMVP.jsx`, `server.js`
- **Evidence from code**: `if (!import.meta.env.DEV) return;` inside `handleSimulatedPayment` calling `/api/payment/mock-success`.
- **Confidence level**: Confirmed in code

---

## Authentication Rules

### 1. Login Redirection
- **Description**: Logging in via Google OAuth appends `?login=success` to the URL. The app intercepts this and immediately routes the user to "My Page".
- **Source file(s)**: `ImmigrationMVP.jsx`
- **Evidence from code**: `if (loginStatus === "success") { setStep("my-page"); ... }`
- **Confidence level**: Confirmed in code

---

## Summary Table

| Category | Count | Status |
| :--- | :--- | :--- |
| **Confirmed Rules** | 12 | Verified via source code |
| **Possible Rules** | 0 | - |
| **Missing Documentation** | High | There are no extensive rule definitions outside of `plan.md` |
| **Contradicting Rules** | 0 | None found during this extraction |
