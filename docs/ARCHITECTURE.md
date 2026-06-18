# HIkoreaFORMS Architecture

## High-Level Overview
HIkoreaFORMS is a monolithic web application structured around a Single Page Application (SPA) frontend and a RESTful backend API. It combines document generation, AI-powered OCR, payments, and electronic faxing into one cohesive platform.

## 1. Frontend Architecture
- **Framework**: React.js with Vite builder.
- **Entry Point**: `main.jsx` rendering `App.jsx`, which acts as a wrapper for the core component `ImmigrationMVP.jsx`.
- **Core Component (`ImmigrationMVP.jsx`)**: A massive state-machine component managing the entire application flow (Wizard steps: Visa selection, User details, OCR processing, Payment, and Result delivery). It utilizes standard React Hooks (`useState`, `useEffect`) and browser `History API` for step navigation.
- **Styling**: Tailwind CSS for responsive, utility-first styling.
- **Modals**: Sub-components handle isolated flows like `AuthModal.jsx` (Authentication), `ImageEditorModal.jsx` (Document 4-corner perspective correction), and `ImageAdjustmentModal.jsx`.
- **Localization**: Uses `react-i18next`. Language files are in `i18n/locales/`.

## 2. Backend Architecture
- **Framework**: Node.js with Express.js (`server.js`).
- **Authentication**: `passport.js` manages local email-based authentication and Google OAuth 2.0 (`/auth/google`).
- **Data & APIs**:
  - `Express` handles REST endpoints.
  - File uploads are managed by `multer` (memory and disk storage).
- **External Integrations**:
  - **Google GenAI API**: Used for AI-based OCR data extraction.
  - **PortOne**: Korean payment gateway integration (`/api/payment/portone/*`).
  - **Popbill**: E-Fax API for sending generated documents directly to immigration offices (`/api/fax/send`).

## 3. Data Processing & Generation (Python Scripts)
The Node.js backend delegates heavy processing tasks to Python via child processes:
- **Image Processing (`scan_processor.py`)**: Uses `OpenCV` (cv2) to apply edge detection, perspective warping (auto or 4-corner manual), and contrast adjustments (grayscale, Xerox mode).
- **PDF Generation (`pdf_generator.py`)**: Uses `PyMuPDF` (`fitz`) to insert user data (text/checkboxes) onto predefined template PDFs using custom fonts (`NanumGothic.ttf`) to support Korean script.

## 4. Deployment Architecture
- **Proxy**: Nginx (`hikoreaforms_nginx.conf`) handles reverse proxying. HTTP is redirected to HTTPS (Let's Encrypt SSL).
- **Static Files**: The Vite build folder (`/dist`) is served by Nginx.
- **API Server**: Node.js Express runs on port 3001, accessed via `/api/` proxy pass.
