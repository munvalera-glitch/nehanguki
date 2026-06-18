# Project Features

HIkoreaFORMS provides an automated, AI-driven platform for generating South Korean immigration documents.

## Core Features
- **AI-Powered OCR (Optical Character Recognition)**:
  - Extracts text directly from Passports, ARC (Alien Registration Cards), Housing Contracts, and School Certificates.
  - Automatically identifies fields: Name, Passport No, Nationality, Issue/Expiry Dates, ID Numbers, and Addresses.
- **Smart Image Processing**:
  - Auto-detection of document edges.
  - Manual 4-corner perspective correction (trapezoid to rectangle warping).
  - Visual filters (Xerox Black/White, Grayscale, Light Scan) to improve document legibility.
- **Automated PDF Generation**:
  - Automatically maps extracted user data onto official Korean immigration forms.
  - Supports: Application forms, Accommodation forms, F-4 Goso, Occupation forms, Guarantees, and Otkaz (waivers).
  - Drafts feature a "PREVIEW - NOT FOR SUBMISSION" diagonal watermark.
- **E-Fax Integration (Popbill)**:
  - Allows users to transmit their generated application packages directly to local Korean immigration offices via internet Fax.
- **Multilingual Support**:
  - Fully translated UI supporting English, Russian, and Korean.
- **Authentication & My Page**:
  - Traditional Email/Password registration (with verification codes).
  - Google OAuth Login.
  - "My Page" dashboard to track previous document generations and remaining credits.
- **Integrated Payments**:
  - PortOne payment gateway integration for purchasing package credits or sending faxes.
