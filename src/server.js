import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { v4 as uuidv4 } from "uuid";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import archiver from "archiver";
import { bot } from "../bot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

if (!process.env.GEMINI_API_KEY) {
    console.error("❌  GEMINI_API_KEY is not set. Add it to your .env file.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Database Setup ──────────────────────────────────────────────────────────
const DB_USERS = resolve(__dirname, "data", "users.json");
const DB_PACKAGES = resolve(__dirname, "data", "packages.json");

function readDb(file) {
    try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; }
}
function writeDb(file, data) {
    writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// ── Express setup ────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1); 

const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_URL = IS_PROD ? "https://hikoreaforms.com" : "http://localhost:5175";

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(session({
    secret: process.env.SESSION_SECRET || "hikorea_secret_key_123",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: IS_PROD,
        sameSite: IS_PROD ? "none" : "lax"
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// ── Passport Google OAuth Setup ──────────────────────────────────────────────
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: IS_PROD ? "https://hikoreaforms.com/auth/google/callback" : "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
      const db = readDb(DB_USERS);
      let users = db.users || [];
      let user = users.find(u => u.googleId === profile.id);
      if (!user) {
          user = {
              id: uuidv4(),
              googleId: profile.id,
              email: profile.emails?.[0]?.value || "",
              name: profile.displayName || "",
              freeDownloadsUsed: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          };
          users.push(user);
          writeDb(DB_USERS, { users });
      }
      return cb(null, user);
  }
));

passport.serializeUser((user, cb) => cb(null, user.id));
passport.deserializeUser((id, cb) => {
    const db = readDb(DB_USERS);
    const users = db.users || [];
    const user = users.find(u => u.id === id);
    cb(null, user || null);
});

// ── Auth Endpoints ───────────────────────────────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: FRONTEND_URL + '/?login=failed' }),
  function(req, res) {
    // Successful authentication, redirect to frontend.
    res.redirect(FRONTEND_URL + '/?login=success');
  }
);

app.get('/api/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ ok: true, user: req.user });
    } else {
        res.json({ ok: false, user: null });
    }
});

app.get('/api/user/packages', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    }
    const db = readDb(DB_PACKAGES);
    const packages = db.packages || [];
    const userPackages = packages.filter(p => p.userId === req.user.id);
    res.json({ ok: true, packages: userPackages.reverse() }); // Newest first
});

app.delete('/api/user/packages/:id', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    }

    const packageId = req.params.id;
    if (!packageId) {
        return res.status(400).json({ ok: false, error: "PACKAGE_ID_REQUIRED" });
    }

    const db = readDb(DB_PACKAGES);
    db.packages = db.packages || [];

    const pkgIndex = db.packages.findIndex(p => p.id === packageId);
    if (pkgIndex === -1) {
        return res.status(404).json({ ok: false, error: "PACKAGE_NOT_FOUND" });
    }

    const pkg = db.packages[pkgIndex];

    if (pkg.userId !== req.user.id) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN", message: "You are not authorized to delete this package." });
    }

    // Allow deleting paid packages if requested
    // if (pkg.paymentStatus === "paid" && req.query.force !== "true") {
    //     return res.status(400).json({ ok: false, error: "CANNOT_DELETE_PAID_PACKAGE", message: "Paid orders cannot be deleted." });
    // }

    db.packages.splice(pkgIndex, 1);
    writeDb(DB_PACKAGES, db);

    res.json({ ok: true, message: "Package deleted successfully" });
});

app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        res.json({ ok: true });
    });
});

// Multer — store upload in memory (no disk writes needed for Gemini inline)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

// ── Passport OCR prompt ──────────────────────────────────────────────────────
const PASSPORT_PROMPT = `
You are a passport data extraction assistant.
Carefully examine the passport image and extract the following fields.

Return ONLY valid JSON object. Do not use markdown. Do not wrap response in code block. Do not add explanations.

CRITICAL LATIN-ONLY RULE:
- For full_name, surname, given_names, nationality use ONLY Latin/English text printed in the passport.
- Ignore Cyrillic/Russian/Korean/local-language text completely.
- Do NOT transliterate from Cyrillic or any non-Latin script.
- Do NOT infer Latin spelling from non-Latin text.
- If Latin spelling is not visible, return an empty string.

NAME EXTRACTION RULES:
- surname: Extract ONLY from the Surname / Family Name / Last Name field.
- given_names: Combine ALL other name parts (Given Names, Middle Name, Patronymic, Father's Name, Otasining ismi, Second Name) into a SINGLE string separated by spaces. Preserve exact order.
- Do NOT create separate fields for middle name or patronymic. Combine them all into given_names.
- Keep exact spaces, uppercase, and Latin spelling.

JSON schema:
{
  "surname": "string — surname exactly as printed in Latin",
  "given_names": "string — ALL given names, middle names, and patronymics combined with spaces",
  "full_name": "string — surname + given_names combined with space",
  "nationality": "string — nationality as printed (e.g. RUSSIAN FEDERATION) in Latin",
  "passport_number": "string",
  "birth_date": "string — format YYYY-MM-DD",
  "sex": "string — M or F",
  "issue_date": "string — format YYYY-MM-DD",
  "expiry_date": "string — format YYYY-MM-DD",
  "mrz_line1": "string — first line of the bottom text (machine readable zone) exactly as printed",
  "mrz_line2": "string — second line of the bottom text exactly as printed",
  "uncertain_fields": ["array of field names you are not confident about"]
}

Rules:
- If a field is not visible or not present, use an empty string "".
- Do NOT invent or guess data.
- Do NOT add any text outside the JSON object.
- CRITICAL: Even if the image is blurry, cropped, or unreadable, YOU MUST STILL RETURN A VALID JSON OBJECT matching the schema exactly, filling missing fields with empty strings. NEVER return conversational text.
`.trim();

const IDCARD_PROMPT = `
You are a Korean alien registration card (외국인등록증) data extraction assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Your ONLY task: Find the alien registration number (외국인등록번호).
Format: exactly 6 digits, then a hyphen, then 7 digits.
Examples: 741203-5140276, 880512-6234567

JSON schema:
{
  "id_number": "string — the registration number in format DDDDDD-DDDDDDD, or empty string if not found",
  "uncertain_fields": []
}

Rules:
- Extract ONLY the registration number.
- Do NOT extract name, nationality, phone, address, or any other field.
- Do NOT format or guess the number. Use exactly what is printed.
- If you cannot find a number matching DDDDDD-DDDDDDD format, return empty string.
- CRITICAL: Always return valid JSON even if image is unreadable.
`.trim();

// Regex fallback for Korean alien registration number
const ID_NUMBER_REGEX = /\b\d{6}-\d{7}\b/;

// ── Helper: extract JSON safely ──────────────────────────────────────────────
function extractJsonFromText(text) {
    let cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    } else {
        throw new Error("No JSON object found in text");
    }

    return JSON.parse(cleaned);
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

// Helper to execute the Gemini request
async function generateWithModel(modelName, mimetype, base64Data, promptText) {
    return ai.models.generateContent({
        model: modelName,
        contents: [
            {
                role: "user",
                parts: [
                    { inlineData: { mimeType: mimetype, data: base64Data } },
                    { text: promptText },
                ],
            },
        ],
        config: {
            temperature: 0,
            topP: 1,
            maxOutputTokens: 4096,
        },
    });
}

function isOverloadError(err) {
    const msg = (err.message || "").toLowerCase();
    const status = err.status || err.code;
    return (
        status === 503 || status === 429 ||
        msg.includes("503") || msg.includes("429") ||
        msg.includes("unavailable") || msg.includes("overloaded") || msg.includes("high demand")
    );
}

// Passport OCR
app.post("/api/ocr/passport", upload.single("passport"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        let response;
        let modelUsed = "gemini-2.5-flash";

        // 1. Try Primary Model
        try {
            console.log(`➡️ [OCR] Trying ${modelUsed}...`);
            response = await generateWithModel(modelUsed, mimetype, base64Data, PASSPORT_PROMPT);
        } catch (err1) {
            if (isOverloadError(err1)) {
                console.warn(`⚠️ [OCR] ${modelUsed} overloaded. Falling back...`);
                modelUsed = "gemini-3.1-flash-lite";
                
                // 2. Try Fallback Model
                try {
                    console.log(`➡️ [OCR] Trying ${modelUsed}...`);
                    response = await generateWithModel(modelUsed, mimetype, base64Data, PASSPORT_PROMPT);
                } catch (err2) {
                    if (isOverloadError(err2)) {
                        console.warn(`⚠️ [OCR] ${modelUsed} also overloaded. Waiting 1500ms...`);
                        await new Promise(r => setTimeout(r, 1500));
                        
                        // 3. Final Retry
                        try {
                            console.log(`➡️ [OCR] Retrying ${modelUsed}...`);
                            response = await generateWithModel(modelUsed, mimetype, base64Data, PASSPORT_PROMPT);
                        } catch (err3) {
                            console.error("❌ [OCR] All models overloaded. Aborting.");
                            return res.status(503).json({
                                error: "GEMINI_OVERLOADED",
                                message: "Сервис распознавания временно перегружен."
                            });
                        }
                    } else {
                        throw err2; // Non-overload error
                    }
                }
            } else {
                throw err1; // Non-overload error
            }
        }

        console.log(`✅ [OCR] Success using ${modelUsed}`);
        const rawText = response.text ?? "";

        // Parse and validate JSON
        let parsed;
        try {
            parsed = extractJsonFromText(rawText);
        } catch {
            console.error("❌ [OCR] Gemini returned non-JSON:", rawText);
            return res.status(502).json({
                error: "Gemini returned an invalid JSON response.",
                raw: rawText,
            });
        }

        return res.json({ ok: true, data: parsed, meta: { model: modelUsed } });

    } catch (err) {
        console.error("❌ [OCR] Unexpected error:", err);
        return res.status(500).json({
            error: err.message || "Internal server error",
        });
    }
});

// ID Card OCR
app.post("/api/ocr/idcard", upload.single("idcard"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        let response;
        let modelUsed = "gemini-2.5-flash";

        try {
            console.log(`➡️ [OCR ID Card] Trying ${modelUsed}...`);
            response = await generateWithModel(modelUsed, mimetype, base64Data, IDCARD_PROMPT);
        } catch (err1) {
            if (isOverloadError(err1)) {
                console.warn(`⚠️ [OCR ID Card] ${modelUsed} overloaded. Falling back...`);
                modelUsed = "gemini-3.1-flash-lite";
                try {
                    console.log(`➡️ [OCR ID Card] Trying ${modelUsed}...`);
                    response = await generateWithModel(modelUsed, mimetype, base64Data, IDCARD_PROMPT);
                } catch (err2) {
                    if (isOverloadError(err2)) {
                        console.warn(`⚠️ [OCR ID Card] ${modelUsed} also overloaded. Waiting 1500ms...`);
                        await new Promise(r => setTimeout(r, 1500));
                        try {
                            console.log(`➡️ [OCR ID Card] Retrying ${modelUsed}...`);
                            response = await generateWithModel(modelUsed, mimetype, base64Data, IDCARD_PROMPT);
                        } catch (err3) {
                            console.error("❌ [OCR ID Card] All models overloaded. Aborting.");
                            return res.status(503).json({
                                error: "GEMINI_OVERLOADED",
                                message: "Сервис распознавания временно перегружен."
                            });
                        }
                    } else {
                        throw err2;
                    }
                }
            } else {
                throw err1;
            }
        }

        const rawText = response.text ?? "";
        console.log(`✅ [OCR ID Card] Gemini raw: ${rawText.substring(0, 200)}`);

        let idNumber = "";

        // Try Gemini JSON first
        try {
            const parsed = extractJsonFromText(rawText);
            idNumber = parsed.id_number || "";
            console.log(`✅ [OCR ID Card] Gemini id_number: "${idNumber}"`);
        } catch {
            console.warn("[OCR ID Card] Could not parse Gemini JSON, trying regex fallback");
        }

        // Regex fallback: search raw text for DDDDDD-DDDDDDD
        if (!idNumber) {
            const match = rawText.match(ID_NUMBER_REGEX);
            if (match) {
                idNumber = match[0];
                console.log(`✅ [OCR ID Card] Regex fallback found: "${idNumber}"`);
            } else {
                console.warn("[OCR ID Card] No ID number found by regex either");
            }
        }

        return res.json({
            ok: true,
            data: {
                id_number: idNumber,
                uncertain_fields: idNumber ? [] : ["id_number"],
            },
            meta: { model: modelUsed },
        });

    } catch (err) {
        console.error("❌ [OCR ID Card] Unexpected error:", err);
        return res.status(500).json({
            error: err.message || "Internal server error",
        });
    }
});

// ── Contract Address OCR ────────────────────────────────────────────────────
const CONTRACT_ADDRESS_PROMPT = `
You are a Korean lease contract (임대차계약서) data extraction assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Your ONLY task: Extract the residential address (소재지 / 주소) from the image.

JSON schema:
{
  "address": "string — the full Korean address as printed, or empty string if not found",
  "uncertain_fields": []
}

Rules:
- Extract ONLY the residential address.
- Do NOT extract postal code / zip code.
- Do NOT extract names, phone numbers, amounts, or dates.
- Preserve the full Korean address exactly as printed (do not translate or abbreviate).
- If address is not visible or not readable, return empty string.
- CRITICAL: Always return valid JSON even if image is unreadable.
`.trim();

app.post("/api/ocr/contract-address", upload.single("addressImage"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: "No image uploaded." });
        }

        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        const modelUsed = "gemini-2.5-flash";

        console.log(`➡️ [OCR Address] Trying ${modelUsed}...`);
        let response;
        try {
            response = await generateWithModel(modelUsed, mimetype, base64Data, CONTRACT_ADDRESS_PROMPT);
        } catch (err) {
            console.error("❌ [OCR Address] Gemini error:", err.message);
            return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
        }

        const rawText = response.text ?? "";
        console.log(`✅ [OCR Address] Gemini raw: ${rawText.substring(0, 300)}`);

        let address = "";
        try {
            const parsed = extractJsonFromText(rawText);
            address = (parsed.address || "").trim();
            // If JSON fallback failed, scan top‑down for the first plausible Korean address line
            if (!address) {
                const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5);
                const addrLine = lines.find(l => /소재지|주소/.test(l) || /[\uAC00-\uD7A3]+.*[시군구]/.test(l));
                if (addrLine) address = addrLine.replace(/^(?:소재지|주소)\s*[:：]?\s*/, '');
            }
        } catch {
            // Try regex fallback — find text that looks like a Korean address
            const match = rawText.match(/[\uAC00-\uD7A3][^\n]{5,}/);
            if (match) address = match[0].trim();
            console.warn("[OCR Address] JSON parse failed, regex fallback:", address);
        }

        console.log(`✅ [OCR Address] Extracted: "${address}"`);
        return res.json({
            ok: true,
            data: {
                address,
                uncertain_fields: address ? [] : ["address"],
            },
            meta: { model: modelUsed },
        });

    } catch (err) {
        console.error("❌ [OCR Address] Unexpected error:", err);
        return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
    }
});

// ── Provider ID Card OCR ─────────────────────────────────────────────────────
const PROVIDER_IDCARD_PROMPT = `
You are a Korean alien registration card (외국인등록증) data extraction assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Extract ONLY:
1. full_name_for_check — the name printed on the card (Latin or Korean)
2. id_number — alien registration number in format DDDDDD-DDDDDDD (6 digits, hyphen, 7 digits)
3. nationality — nationality as printed on the card in Latin (e.g. UZBEKISTAN, RUSSIA, CHINA)

JSON schema:
{
  "full_name_for_check": "string — name as printed, or empty string",
  "id_number": "string — registration number DDDDDD-DDDDDDD, or empty string",
  "nationality": "string — nationality in Latin, or empty string",
  "uncertain_fields": []
}

Rules:
- Do NOT extract phone number or address.
- If name not found, return empty string.
- If ID number not found or not in correct format, return empty string.
- For nationality use Latin text only (e.g. UZBEKISTAN, RUSSIAN FEDERATION, CHINA).
- CRITICAL: Always return valid JSON.
`.trim();

app.post("/api/ocr/provider-idcard", upload.single("providerIdCard"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ ok: false, error: "No image uploaded." });
        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        const modelUsed = "gemini-2.5-flash";
        console.log(`➡️ [OCR Provider ID] Trying ${modelUsed}...`);
        let response;
        try {
            response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_IDCARD_PROMPT);
        } catch (err) {
            return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
        }
        const rawText = response.text ?? "";
        console.log(`✅ [OCR Provider ID] Raw: ${rawText.substring(0, 200)}`);
        let fullName = "", idNumber = "", nationality = "";
        try {
            const parsed = extractJsonFromText(rawText);
            fullName    = (parsed.full_name_for_check || "").trim();
            idNumber    = (parsed.id_number           || "").trim();
            nationality = (parsed.nationality          || "").trim().toUpperCase();
        } catch {
            const match = rawText.match(/\b\d{6}-\d{7}\b/);
            if (match) idNumber = match[0];
            console.warn("[OCR Provider ID] JSON parse failed, regex fallback:", idNumber);
        }
        // Validate ID number format
        if (idNumber && !/^\d{6}-\d{7}$/.test(idNumber)) idNumber = "";
        console.log(`✅ [OCR Provider ID] name="${fullName}" id="${idNumber}" nationality="${nationality}"`);
        return res.json({ ok: true, data: { full_name_for_check: fullName, id_number: idNumber, nationality, uncertain_fields: [] }, meta: { model: modelUsed } });
    } catch (err) {
        console.error("❌ [OCR Provider ID] Error:", err);
        return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
    }
});

// ── Provider Contract Area OCR ───────────────────────────────────────────────
const PROVIDER_CONTRACT_PROMPT = `
You are a Korean lease contract (임대차계약서) data extraction assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Extract ONLY the landlord/lessor (임대인) information:
1. full_name — the name of the landlord as printed
2. id_number — Korean registration number in format DDDDDD-DDDDDDD
3. phone — phone number only if clearly visible in the image
4. nationality — nationality of the landlord if printed (e.g. UZBEKISTAN, RUSSIA, KOREA). If Korean (주민등록번호 format), return "KOREA".

JSON schema:
{
  "full_name": "string — landlord name, or empty string",
  "id_number": "string — registration number DDDDDD-DDDDDDD, or empty string",
  "phone": "string — phone number if visible, or empty string",
  "nationality": "string — nationality in Latin, or empty string",
  "uncertain_fields": []
}

Rules:
- Do NOT extract tenant (임차인) data.
- Do NOT extract address or amounts.
- id_number must match exactly DDDDDD-DDDDDDD format, otherwise return empty string.
- If Korean ID number (주민등록번호), nationality is KOREA.
- If a field is not visible, return empty string.
- CRITICAL: Always return valid JSON.
`.trim();

app.post("/api/ocr/provider-contract", upload.single("providerImage"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ ok: false, error: "No image uploaded." });
        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        const modelUsed = "gemini-2.5-flash";
        console.log(`➡️ [OCR Provider Contract] Trying ${modelUsed}...`);
        let response;
        try {
            response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_CONTRACT_PROMPT);
        } catch (err) {
            return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
        }
        const rawText = response.text ?? "";
        console.log(`✅ [OCR Provider Contract] Raw: ${rawText.substring(0, 300)}`);
        let fullName = "", idNumber = "", phone = "", nationality = "";
        try {
            const parsed = extractJsonFromText(rawText);
            fullName    = (parsed.full_name   || "").trim();
            idNumber    = (parsed.id_number   || "").trim();
            phone       = (parsed.phone       || "").trim();
            nationality = (parsed.nationality  || "").trim().toUpperCase();
        } catch {
            const match = rawText.match(/\b\d{6}-\d{7}\b/);
            if (match) idNumber = match[0];
            console.warn("[OCR Provider Contract] JSON parse failed");
        }
        if (idNumber && !/^\d{6}-\d{7}$/.test(idNumber)) idNumber = "";
        console.log(`✅ [OCR Provider Contract] name="${fullName}" id="${idNumber}" phone="${phone}" nationality="${nationality}"`);
        return res.json({ ok: true, data: { full_name: fullName, id_number: idNumber, phone, nationality, uncertain_fields: [] }, meta: { model: modelUsed } });
    } catch (err) {
        console.error("❌ [OCR Provider Contract] Error:", err);
        return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
    }
});

// ── School Certificate OCR ───────────────────────────────────────────────────
const SCHOOL_CERT_PROMPT = `
You are a Korean school enrollment certificate (재학증명서) data extraction assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Your ONLY task: Extract the name of the school (학교명 / 학교 이름).

JSON schema:
{
  "school_name": "string — the full school name as printed (Korean or English), or empty string if not found",
  "uncertain_fields": []
}

Rules:
- Extract ONLY the school name.
- Do NOT extract the student's name.
- Do NOT extract dates, address, document numbers.
- If the school name is printed in both Korean and English, use the Korean name.
- If not visible or unreadable, return empty string.
- CRITICAL: Always return valid JSON.
`.trim();

app.post("/api/ocr/school-certificate", upload.single("schoolCertificate"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ ok: false, error: "No image uploaded." });
        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        const modelUsed = "gemini-2.5-flash";
        console.log(`➡️ [OCR School] Trying ${modelUsed}...`);
        let response;
        try {
            response = await generateWithModel(modelUsed, mimetype, base64Data, SCHOOL_CERT_PROMPT);
        } catch (err) {
            return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
        }
        const rawText = response.text ?? "";
        console.log(`✅ [OCR School] Raw: ${rawText.substring(0, 200)}`);
        let schoolName = "";
        try {
            const parsed = extractJsonFromText(rawText);
            schoolName = (parsed.school_name || "").trim();
        } catch {
            // Fallback: grab first Korean line that looks like a school name
            const match = rawText.match(/[\uAC00-\uD7A3]{2,}(학교|중학교|고등학교|초등학교|대학교|유치원)/);
            if (match) schoolName = match[0].trim();
            console.warn("[OCR School] JSON parse failed, regex fallback:", schoolName);
        }
        console.log(`✅ [OCR School] Extracted: "${schoolName}"`);
        return res.json({
            ok: true,
            data: { school_name: schoolName, uncertain_fields: schoolName ? [] : ["school_name"] },
            meta: { model: modelUsed },
        });
    } catch (err) {
        console.error("❌ [OCR School] Error:", err);
        return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
    }
});

// ── PDF Generation ──────────────────────────────────────────────────────────
const TEMPLATE_PATH = resolve(__dirname, "templates", "application.pdf");
const PDF_SCRIPT   = resolve(__dirname, "pdf", "pdf_generator.py");

app.post("/api/generate/application", async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== "object") {
            return res.status(400).json({ ok: false, error: "Invalid request body." });
        }

        // Parse birthDate YYYY-MM-DD → parts
        const bd = (body.birthDate || "").split("-");
        const birthYear  = bd[0] || "";
        const birthMonth = bd[1] || "";
        const birthDay   = bd[2] || "";

        // Build python data dict
        const pyData = {
            surname:              body.surname         || "",
            given_names:          body.givenNames      || "",
            birth_year:           birthYear,
            birth_month:          birthMonth,
            birth_day:            birthDay,
            sex:                  body.sex             || "",   // "M" | "F" | ""
            nationality:          body.nationality     || "",
            arc:                  body.idNumber        || "",    // DDDDDD-DDDDDDD
            passport_no:          body.passportNumber  || "",
            passport_issue_date:  body.passportIssueDate  || "",
            passport_expiry_date: body.passportExpiryDate || "",
            address_in_korea:     body.address         || "",
            cell_phone:           body.phone           || "",
        };

        // Write temp JSON payload
        const tmpDir     = mkdtempSync(join(tmpdir(), "pdf-"));
        const jsonPath   = join(tmpDir, "data.json");
        const outputPath = join(tmpDir, "output.pdf");
        writeFileSync(jsonPath, JSON.stringify(pyData), "utf8");

        console.log(`➡️ [PDF] Generating application form...`);

        // Run Python generator
        await new Promise((resolve_p, reject_p) => {
            const py = spawn("python3", ["-c", `
import json, sys
sys.path.insert(0, '${resolve(__dirname, "pdf")}')
from pdf_generator import generate_application_form
with open('${jsonPath}') as f:
    data = json.load(f)
generate_application_form(data, '${TEMPLATE_PATH}', '${outputPath}')
print('ok')
`]);
            let stderr = "";
            py.stderr.on("data", (d) => { stderr += d.toString(); });
            py.on("close", (code) => {
                if (code === 0) {
                    resolve_p();
                } else {
                    console.error("[PDF] Python error:\n", stderr);
                    reject_p(new Error("PDF generation failed."));
                }
            });
        });

        if (!existsSync(outputPath)) {
            return res.status(500).json({ ok: false, error: "PDF file was not created." });
        }

        const pdfBuffer = readFileSync(outputPath);

        // Cleanup
        try { unlinkSync(jsonPath); unlinkSync(outputPath); } catch {}

        console.log(`✅ [PDF] Done: ${pdfBuffer.length} bytes`);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="application_form.pdf"');
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);

    } catch (err) {
        console.error("❌ [PDF] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось создать PDF. Проверьте заполнение данных." });
    }
});

// ── PDF Package Generation ───────────────────────────────────────────────────
const TEMPLATES = {
    application:   resolve(__dirname, "templates", "application.pdf"),
    accommodation: resolve(__dirname, "templates", "accommodation.pdf"),
    occupation:    resolve(__dirname, "templates", "occupation.pdf"),
    guarantee:     resolve(__dirname, "templates", "guarantee.pdf"),
    gosoF4:        resolve(__dirname, "templates", "goso_f4.pdf"),
    school:        resolve(__dirname, "templates", "school_report.pdf"),
};


async function generatePackageFiles(b, tmpDir) {
        const outputFiles = [];

        // ── Helper: parse birth date ─────────────────────────────────────────
        const bd = (b.birthDate || "").split("-");
        const birthYear  = bd[0] || "";
        const birthMonth = bd[1] || "";
        const birthDay   = bd[2] || "";

        // ── Helper: run Python snippet ────────────────────────────────────────
        const runPython = (script) => new Promise((ok, fail) => {
            const py = spawn("python3", ["-c", script]);
            let stderr = "";
            py.stderr.on("data", d => { stderr += d.toString(); });
            py.on("close", code => {
                if (code === 0) ok();
                else { console.error("[PDF Package] Python error:\n", stderr); fail(new Error(stderr.slice(0, 300))); }
            });
        });

        const pyDir = resolve(__dirname, "pdf").replace(/\\/g, "/");

        // ════════════════════════════════════════════════════════════════════
        // 1. 통합신청서(신고서) — only if visaType !== "F4"
        // ════════════════════════════════════════════════════════════════════
        if (b.visaType !== "F4") {
            const data = {
                surname:              b.surname          || "",
                given_names:          b.givenNames       || "",
                birth_year:           birthYear,
                birth_month:          birthMonth,
                birth_day:            birthDay,
                sex:                  b.sex              || "",
                nationality:          b.nationality      || "",
                arc:                  b.idNumber         || "",
                passport_no:          b.passportNumber   || "",
                passport_issue_date:  b.passportIssueDate  || "",
                passport_expiry_date: b.passportExpiryDate || "",
                address_in_korea:     b.address          || "",
                cell_phone:           b.phone            || "",
            };
            const jsonPath = join(tmpDir, "app.json");
            const outPath  = join(tmpDir, "01_application.pdf");
            writeFileSync(jsonPath, JSON.stringify(data), "utf8");
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_application_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_application_form(d, '${TEMPLATES.application.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        }

        // ════════════════════════════════════════════════════════════════════
        // 2. 거주숙소제공사실확인서 — only if housingType === "other"
        // ════════════════════════════════════════════════════════════════════
        if (b.housingType === "other") {
            const data = {
                receiver_full_name:    `${b.surname || ""} ${b.givenNames || ""}`.trim(),
                receiver_nationality:  b.nationality  || "",
                receiver_arc:          b.idNumber     || "",
                receiver_phone:        b.phone        || "",
                receiver_address:      b.address      || "",
                provider_full_name:    b.providerFullName   || "",
                provider_arc:          b.providerIdNumber   || "",
                provider_phone:        b.providerPhone      || "",
                provider_nationality:  b.providerNationality|| "",
            };
            const jsonPath = join(tmpDir, "acc.json");
            const outPath  = join(tmpDir, "02_accommodation.pdf");
            writeFileSync(jsonPath, JSON.stringify(data), "utf8");
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_accommodation_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_accommodation_form(d, '${TEMPLATES.accommodation.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        }

        // ════════════════════════════════════════════════════════════════════
        // 3. 외국인 직업 및 연간 소득금액 신고서
        // ════════════════════════════════════════════════════════════════════
        const age = (() => {
            if (!b.birthDate) return 0;
            const today = new Date();
            const dob   = new Date(b.birthDate);
            let a = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
            return a;
        })();

        if (b.action !== "address_change" && b.isStudent === false && age >= 19 && b.visaType !== "F1") {
            const data = {
                surname:     b.surname     || "",
                given_names: b.givenNames  || "",
                birth_year:  birthYear,
                birth_month: birthMonth,
                birth_day:   birthDay,
                sex:         b.sex         || "",
                nationality: b.nationality || "",
                arc:         b.idNumber    || "",
            };
            const jsonPath = join(tmpDir, "occ.json");
            const outPath  = join(tmpDir, "03_occupation.pdf");
            writeFileSync(jsonPath, JSON.stringify(data), "utf8");
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_occupation_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_occupation_form(d, '${TEMPLATES.occupation.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        }

        // ════════════════════════════════════════════════════════════════════
        // 4. 신원보증서 — only if visaType === "F1"
        // ════════════════════════════════════════════════════════════════════
        if (b.visaType === "F1") {
            const appData = {
                surname:              b.surname          || "",
                given_names:          b.givenNames       || "",
                birth_year:           birthYear,
                birth_month:          birthMonth,
                birth_day:            birthDay,
                sex:                  b.sex              || "",
                nationality:          b.nationality      || "",
                passport_no:          b.passportNumber   || "",
                address_in_korea:     b.address          || "",
                cell_phone:           b.phone            || "",
            };
            const guarantorData = {
                guarantor_full_name:    b.guarantorFullName    || "",
                guarantor_nationality:  b.guarantorNationality || "",
                guarantor_sex:          b.guarantorSex         || "",
                guarantor_passport_no:  b.guarantorPassportNumber || "",
                guarantor_phone:        b.guarantorPhone       || "",
                guarantor_dob:          b.guarantorDob         || "",
                guarantor_relationship: b.guarantorRelationship|| "",
                guarantor_company:      b.guarantorCompany     || "",
                guarantor_position:     b.guarantorJobPosition || "",
                guarantor_work_address: b.guarantorWorkAddress || "",
                guarantee_period:       b.guaranteePeriod      || "",
            };
            const jsonPath = join(tmpDir, "gar.json");
            const outPath  = join(tmpDir, "04_guarantee.pdf");
            writeFileSync(jsonPath, JSON.stringify({ app: appData, guarantor: guarantorData }), "utf8");
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_guarantee_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_guarantee_form(d['app'], d['guarantor'], '${TEMPLATES.guarantee.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        }

        // ════════════════════════════════════════════════════════════════════
        // 5. 거소신고(신청)서 — only if visaType === "F4"
        // ════════════════════════════════════════════════════════════════════
        if (b.visaType === "F4") {
            const data = {
                surname:              b.surname          || "",
                given_names:          b.givenNames       || "",
                birth_year:           birthYear,
                birth_month:          birthMonth,
                birth_day:            birthDay,
                sex:                  b.sex              || "",
                nationality:          b.nationality      || "",
                arc:                  b.idNumber         || "",
                passport_no:          b.passportNumber   || "",
                passport_issue_date:  b.passportIssueDate  || "",
                passport_expiry_date: b.passportExpiryDate || "",
                address_in_korea:     b.address          || "",
                cell_phone:           b.phone            || "",
            };
            const jsonPath = join(tmpDir, "goso.json");
            const outPath  = join(tmpDir, "05_goso.pdf");
            writeFileSync(jsonPath, JSON.stringify(data), "utf8");
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_goso_f4_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_goso_f4_form(d, '${TEMPLATES.gosoF4.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        }

        // ════════════════════════════════════════════════════════════════════
        // 6. 재학사항 신고서
        // ════════════════════════════════════════════════════════════════════
        const schoolName = (b.schoolName || "").trim();
        const needsSchool = (b.isStudent === true || schoolName.length > 0)
                         && existsSync(TEMPLATES.school);

        if (needsSchool) {
            const fullName = `${b.surname || ""} ${b.givenNames || ""}`.trim();
            const data = {
                full_name:       fullName,
                sex:             b.sex             || "",
                date_of_birth:   b.birthDate        || "",
                nationality:     b.nationality      || "",
                passport_no:     b.passportNumber   || "",
                registration_no: b.idNumber         || "",
                school_name:     schoolName,
            };
            const jsonPath = join(tmpDir, "sch.json");
            const outPath  = join(tmpDir, "06_school.pdf");
            writeFileSync(jsonPath, JSON.stringify(data), "utf8");
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_school_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_school_form(d, '${TEMPLATES.school.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        } else if (b.isStudent === true || schoolName.length > 0) {
            console.warn("[PDF Package] School template not found, skipping school form.");
        }

        // ════════════════════════════════════════════════════════════════════
        // Merge all PDFs
        // ════════════════════════════════════════════════════════════════════
        const finalPath = join(tmpDir, "package.pdf");
        const fileList  = JSON.stringify(outputFiles.map(f => f.replace(/\\/g, "/")));
        await runPython(`
import fitz, json
files = json.loads('${fileList.replace(/'/g, "\\'")}')
merged = fitz.open()
for f in files:
    merged.insert_pdf(fitz.open(f))
merged.save('${finalPath.replace(/\\/g, "/")}')
merged.close()
`);
        if (!existsSync(finalPath)) throw new Error("Merged PDF not created");
        return { finalPath, outputFiles, runPython, pyDir };
}

function saveUserPackage(user, b) {
    if (!user) return;
    const db = readDb(DB_PACKAGES);
    const packages = db.packages || [];
    
    // Simplistic package store
    const pkg = {
        id: uuidv4(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        visaType: b.visaType || "",
        action: b.action || "",
        housingType: b.housingType || "",
        applicant: {
            surname: b.surname,
            givenNames: b.givenNames,
            birthDate: b.birthDate,
            sex: b.sex,
            nationality: b.nationality,
            idNumber: b.idNumber,
            passportNumber: b.passportNumber
        },
        provider: {
            fullName: b.providerFullName,
            idNumber: b.providerIdNumber,
            nationality: b.providerNationality
        },
        guarantor: {
            fullName: b.guarantorFullName,
            nationality: b.guarantorNationality
        },
        address: b.address || "",
        paymentStatus: "unpaid",
        downloadCount: 1
    };
    packages.push(pkg);
    writeDb(DB_PACKAGES, { packages });
}

// ── Endpoints ────────────────────────────────────────────────────────────────
app.post("/api/generate/package-preview", async (req, res) => {
    try {
        const b = req.body;
        if (!b || typeof b !== "object") return res.status(400).json({ ok: false, error: "Invalid request body." });

        const tmpDir = mkdtempSync(join(tmpdir(), "pkg-"));
        const { finalPath, outputFiles, runPython, pyDir } = await generatePackageFiles(b, tmpDir);

        const wmPath = join(tmpDir, "package_wm.pdf");
        await runPython(`
import sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import apply_watermark
apply_watermark('${finalPath.replace(/\\/g, "/")}', '${wmPath.replace(/\\/g, "/")}')
`);

        const pdfBuffer = readFileSync(wmPath);

        // Cleanup
        try {
            outputFiles.forEach(f => { try { unlinkSync(f); } catch {} });
            unlinkSync(finalPath);
            unlinkSync(wmPath);
        } catch {}

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="application_package_preview.pdf"');
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
    } catch (err) {
        console.error("❌ [PDF Preview] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось создать превью." });
    }
});

app.post("/api/generate/package-download", async (req, res) => {
    try {
        const b = req.body;
        const paymentConfirmed = b.paymentConfirmed === true; // Simplified payment check from payload for now

        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "LOGIN_REQUIRED", message: "Войдите через Google, чтобы скачать PDF." });
        }

        const user = req.user;
        const isFreeDownload = user.freeDownloadsUsed === 0;

        if (!isFreeDownload && !paymentConfirmed) {
            return res.status(402).json({ error: "PAYMENT_REQUIRED", message: "Для скачивания оригинала без водяного знака требуется оплата." });
        }

        // Update user
        if (isFreeDownload) {
            const udb = readDb(DB_USERS);
            const dbUser = udb.users?.find(u => u.id === user.id);
            if (dbUser) {
                dbUser.freeDownloadsUsed = 1;
                writeDb(DB_USERS, udb);
                user.freeDownloadsUsed = 1; // Update in-memory session user
            }
        }

        saveUserPackage(user, b);

        const tmpDir = mkdtempSync(join(tmpdir(), "pkg-"));
        const { finalPath, outputFiles } = await generatePackageFiles(b, tmpDir);
        const pdfBuffer = readFileSync(finalPath);

        // Cleanup
        try {
            outputFiles.forEach(f => { try { unlinkSync(f); } catch {} });
            unlinkSync(finalPath);
        } catch {}

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="application_package.pdf"');
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
    } catch (err) {
        console.error("❌ [PDF Download] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось создать PDF пакет." });
    }
});


// ── Japan Visa Package Generation ───────────────────────────────────────────
app.post("/api/generate/japan-package-download", async (req, res) => {
    try {
        const b = req.body;
        const tmpDir = mkdtempSync(join(tmpdir(), "japan-pkg-"));
        
        // 1. Write the base64 images to files
        const images = [];
        if (b.images && Array.isArray(b.images)) {
            for (let i = 0; i < b.images.length; i++) {
                const img = b.images[i];
                if (!img) continue;
                // img is expected to be a data URL: "data:image/jpeg;base64,/9j/4AAQSkZJ..."
                const parts = img.split(";base64,");
                if (parts.length === 2) {
                    const extMatch = parts[0].match(/image\/(jpeg|jpg|png)/);
                    const ext = extMatch ? extMatch[1] : "jpg";
                    const buffer = Buffer.from(parts[1], "base64");
                    const imgPath = join(tmpDir, `image_${i}.${ext}`);
                    writeFileSync(imgPath, buffer);
                    images.push(imgPath);
                }
            }
        }
        
        // Write the main data to json for the python script
        const pyData = {
            applicant: b.applicant || {},
            entryDate: b.entryDate || "",
            city: b.city || "",
            duration: b.duration || "",
            work: b.work || {},
            images: images
        };
        const jsonPath = join(tmpDir, "japan_data.json");
        writeFileSync(jsonPath, JSON.stringify(pyData), "utf8");
        
        // 2. Run Python script to generate package.pdf
        const pdfOutPath = join(tmpDir, "Japan_Application_Package.pdf");
        const pyDir = resolve(__dirname, "pdf").replace(/\\/g, "/");
        await new Promise((resolve_p, reject_p) => {
            const py = spawn("python3", ["-c", `
import sys
sys.path.insert(0, '${pyDir}')
from japan_pdf_generator import create_japan_pdf_package
create_japan_pdf_package('${jsonPath.replace(/\\/g, "/")}', '${pdfOutPath.replace(/\\/g, "/")}')
`]);
            let stderr = "";
            py.stderr.on("data", d => { stderr += d.toString(); });
            py.on("close", code => {
                if (code === 0) resolve_p();
                else { console.error("[Japan PDF] Python error:\\n", stderr); reject_p(new Error(stderr.slice(0, 300))); }
            });
        });

        // 3. Generate Schedule of Stay (Word Document)
        const rows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Activity Plan", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Accommodation", bold: true })] })] }),
                ],
            })
        ];
        
        const scheduleData = b.scheduleData || [];
        for (const day of scheduleData) {
            rows.push(new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph(day.date || "")] }),
                    new TableCell({ children: day.activities.map(act => new Paragraph("• " + act)) }),
                    new TableCell({ children: [new Paragraph(day.accommodation || "")] })
                ]
            }));
        }

        const table = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows,
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({ children: [new TextRun({ text: "Schedule of Stay", bold: true, size: 32 })] }),
                    new Paragraph(""),
                    table
                ],
            }],
        });

        const wordBuffer = await Packer.toBuffer(doc);
        const wordPath = join(tmpDir, "Schedule_of_Stay_in_Japan.docx");
        writeFileSync(wordPath, wordBuffer);
        
        // 4. Create ZIP Archive
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="Japan_Visa_Documents.zip"');
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', err => { throw err; });
        archive.pipe(res);
        
        if (existsSync(pdfOutPath)) {
            archive.file(pdfOutPath, { name: 'Japan_Application_Package.pdf' });
        }
        archive.file(wordPath, { name: 'Schedule_of_Stay_in_Japan.docx' });
        
        await archive.finalize();
        
        // Cleanup async
        setTimeout(() => {
            try {
                unlinkSync(jsonPath);
                unlinkSync(pdfOutPath);
                unlinkSync(wordPath);
                images.forEach(img => { try { unlinkSync(img); } catch {} });
            } catch {}
        }, 5000);
        
    } catch (err) {
        console.error("❌ [Japan Package Download] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось создать пакет документов." });
    }
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("❌ [Server Error]", err.message || err);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: "File upload error: " + err.message });
    }
    return res.status(500).json({ error: "Internal server error: " + (err.message || "") });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅  OCR server running at http://localhost:${PORT}`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/passport`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/idcard`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/contract-address`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/provider-idcard`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/provider-contract`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/school-certificate`);
    console.log(`   POST http://localhost:${PORT}/api/generate/application`);
    console.log(`   GET  http://localhost:${PORT}/api/health`);
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
        bot.launch().then(() => console.log("🤖 Telegram bot started.")).catch(err => console.error("Telegram bot error:", err));
        
        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    }
});

export { generatePackageFiles };
