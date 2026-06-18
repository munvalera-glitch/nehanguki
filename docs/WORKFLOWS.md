# System Workflows

This document details the critical user journeys and internal workflows of the HIkoreaFORMS application.

## 1. Authentication Flow
- **Email/Password**: User inputs email. Server sends a verification code via Nodemailer. User submits the code -> Account created/verified. Session managed via Express Session.
- **Google OAuth**: User clicks "Login with Google". Handled by Passport.js (`/auth/google`). Upon success, redirects back to the main app with a `login=success` query parameter. `ImmigrationMVP` catches this and routes to "My Page".

## 2. OCR and Image Processing Flow
1. **Upload**: User uploads an image via the frontend.
2. **Pre-processing (`scan_processor.py`)**: The frontend may open `ImageEditorModal` for 4-corner cropping. The coordinates (or auto-detected contours) are passed to Python via `server.js`. The script warps and cleans the image.
3. **Data Extraction**: The cleaned image is sent to the Gemini AI API (`@google/genai`). Gemini extracts JSON structured data based on the document type.
4. **Hydration**: The JSON data is merged into the React state (`applicant`, `guarantor`, `provider` objects).

## 3. PDF Generation & Package Flow
1. **Draft Generation**: If a user is not logged in, or has no credits, a Draft PDF is generated containing a Watermark.
2. **Review**: User clicks "Preview PDF". The frontend triggers `/api/generate/package-preview`. A PDF blob is returned and forcefully downloaded via `a.download`.
3. **Download Package**: User clicks "Download Final". Checks run to ensure user has credits (`paidGenerationsRemaining` or `freeDownloadsUsed`).
4. **Backend Mapping (`pdf_generator.py`)**: `fitz` (PyMuPDF) places the text onto the templates. Multiple templates are merged if necessary (e.g., Application Form + Passport Scan + ARC Scan + Contract Scan into one big PDF).

## 4. Cart & Payment Flow (PortOne)
1. **Selection**: User selects services (e.g., PDF Download + Fax transmission).
2. **Initialization**: Frontend triggers PortOne payment modal.
3. **Verification**: Upon PortOne success callback, frontend calls `/api/payment/portone/verify` with the transaction ID.
4. **Fulfillment**: Backend checks transaction authenticity against PortOne REST API, updates the user's credits, and returns success.
5. **Webhook**: An asynchronous webhook (`/api/payment/portone/webhook`) serves as a fallback to verify delayed payment confirmations.

## 5. Signature Flow
1. **Capture**: React Canvas captures mouse/touch movements for a signature.
2. **Encode**: Signature is converted to a base64 Data URL.
3. **Submit**: Converted to a `Blob` and appended to the FormData as `signature.jpg` during PDF Generation, then stamped at the bottom of application forms.
