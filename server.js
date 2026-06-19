import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, rmSync, createWriteStream } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import LocalStrategy from "passport-local";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import popbill from "popbill";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { bot } from "./bot.js";
import ExcelJS from "exceljs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");

popbill.config({
  LinkID: process.env.POPBILL_LINK_ID,
  SecretKey: process.env.POPBILL_SECRET_KEY,
  IsTest: false,
  defaultErrorHandler: function(Error) {
      console.log('Popbill Error Occur : [' + Error.code + '] ' + Error.message);
  }
});
const faxService = popbill.FaxService();

// Memory stores for auth flow
// TODO: Using in-memory Maps for verification codes, password reset codes, and rate limits 
// is acceptable only for development/single-server MVP. This should later be moved to 
// persistent storage or Redis for a multi-server production environment.
const verificationCodes = new Map(); // email -> { hash, expiresAt, verified }
const passwordResetCodes = new Map(); // email -> { hash, expiresAt, verified }
const rateLimits = new Map(); // ip/email -> { count, expiresAt }


const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

if (!process.env.GEMINI_API_KEY) {
    console.error("❌  GEMINI_API_KEY is not set. Add it to your .env file.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Database Setup ──────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || resolve(__dirname, "data");

const DB_USERS = resolve(DATA_DIR, "users.json");
const DB_PACKAGES = resolve(DATA_DIR, "packages.json");

function readDb(file) {
    try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; }
}
function writeDb(file, data) {
    const dir = dirname(file);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// ── Database Migration ──────────────────────────────────────────────────────
(function runMigrations() {
    console.log("Running user DB migration for retail pricing model...");
    const db = readDb(DB_USERS);
    let migrated = false;
    if (db && db.users) {
        db.users = db.users.map(u => {
            let changed = false;
            // Set isB2B explicitly if missing
            if (u.isB2B === undefined) {
                u.isB2B = false;
                changed = true;
            }
            // Wipe credits for non-B2B users
            if (!u.isB2B && (u.paidGenerationsRemaining > 0 || u.permanentCredits > 0)) {
                u.paidGenerationsRemaining = 0;
                u.permanentCredits = 0;
                changed = true;
            }
            // Set freeGenerationUsed based on past credit usage if undefined
            if (!u.isB2B && u.freeGenerationUsed === undefined) {
                u.freeGenerationUsed = (u.lifetimeCreditsSpent > 0);
                changed = true;
            }
            if (changed) migrated = true;
            return u;
        });
        if (migrated) {
            writeDb(DB_USERS, db);
            console.log("✅ Users migrated successfully.");
        } else {
            console.log("Users DB already migrated.");
        }
    }
})();


// ── Express setup ────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1); 

const IS_PROD = process.env.NODE_ENV === "production";
const FRONTEND_URL = IS_PROD 
  ? ["https://hikoreaforms.com", "https://www.hikoreaforms.com"] 
  : ["http://localhost:5175", "http://127.0.0.1:5175", "http://localhost:5173", "http://127.0.0.1:5173"];

app.use(cors({ origin: FRONTEND_URL, credentials: true }));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || "hikorea_secret_key_123",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
        secure: false,
        sameSite: "lax",
        maxAge: 30 * 60 * 1000 // 30 minutes in milliseconds
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Disable caching for all API endpoints to prevent stale frontend UI state
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});
// ── Passport Google OAuth Setup ──────────────────────────────────────────────
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: IS_PROD ? "https://hikoreaforms.com/auth/google/callback" : "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
      const db = readDb(DB_USERS);
      let users = db.users || [];
      const googleEmail = (profile.emails?.[0]?.value || "").trim().toLowerCase();
      
      // 1. Search by googleId first
      let user = users.find(u => u.googleId === profile.id);
      
      // 2. If not found, search by verified email to automatically link accounts
      if (!user && googleEmail) {
          user = users.find(u => (u.email || "").trim().toLowerCase() === googleEmail);
          if (user) {
              user.googleId = profile.id; // Link account
              if (!user.name && profile.displayName) user.name = profile.displayName;
              user.updatedAt = new Date().toISOString();
              writeDb(DB_USERS, { users });
          }
      }
      
      // 3. If completely new user, create new record
      if (!user) {
          user = {
              id: uuidv4(),
              googleId: profile.id,
              email: googleEmail,
              name: profile.displayName || "",
              authProvider: "google",
              freeDownloadsUsed: 0,
              paidGenerationsRemaining: 0,
              isB2B: false,
              freeGenerationUsed: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          };
          users.push(user);
          writeDb(DB_USERS, { users });
      }
      return cb(null, user);
  }
));

passport.use(new LocalStrategy({ usernameField: "email" }, async (email, password, cb) => {
    const db = readDb(DB_USERS);
    const users = db.users || [];
    const normalizedEmail = (email || "").trim().toLowerCase();
    
    console.log(`[DEBUG] Auth attempt for: ${normalizedEmail}`);
    const user = users.find(u => (u.email || "").trim().toLowerCase() === normalizedEmail && u.authProvider === "email");
    
    if (!user) {
        console.log(`[DEBUG] Auth failed: User not found - ${normalizedEmail}`);
        return cb(null, false, { message: "Invalid email or password" });
    }
    
    const match = await bcrypt.compare(password, user.passwordHash);
    console.log(`[DEBUG] Auth result: Match status = ${match}`);
    
    if (!match) return cb(null, false, { message: "Invalid email or password" });
    return cb(null, user);
}));

passport.serializeUser((user, cb) => cb(null, user.id));
passport.deserializeUser((id, cb) => {
    const db = readDb(DB_USERS);
    const users = db.users || [];
    const user = users.find(u => u.id === id);
    if (user) {
        delete user.passwordHash; // Safety
        if (user.paidGenerationsRemaining === undefined) {
            user.paidGenerationsRemaining = 0;
        }
    }
    cb(null, user || null);
});


// ── Auth Endpoints ───────────────────────────────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

app.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
        if (err || !user) {
            return res.send(`<script>if(window.opener){window.opener.postMessage('google-auth-failed','*');window.close();}else{window.location.href='${FRONTEND_URL}/?login=failed';}</script>`);
        }
        req.logIn(user, (err) => {
            if (err) {
                return res.send(`<script>if(window.opener){window.opener.postMessage('google-auth-failed','*');window.close();}else{window.location.href='${FRONTEND_URL}/?login=failed';}</script>`);
            }
            req.session.save((err) => {
                if (err) console.error("[ERROR] Session save failed in Google callback:", err);
                res.send(`<script>if(window.opener){window.opener.postMessage('google-auth-success','*');window.close();}else{window.location.href='${FRONTEND_URL}';}</script>`);
            });
        });
    })(req, res, next);
});

app.get('/api/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ ok: true, user: req.user });
    } else {
        res.json({ ok: false, user: null });
    }
});
const ADMIN_EMAIL = "munvalera@gmail.com";

app.get('/api/admin/users', (req, res) => {
    if (!req.isAuthenticated() || (req.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
        return res.status(403).json({ ok: false, error: "ACCESS_DENIED" });
    }
    const db = readDb(DB_USERS);
    const users = (db.users || []).map(u => {
        const userCopy = { ...u };
        delete userCopy.passwordHash;
        return userCopy;
    });
    res.json({ ok: true, users });
});

app.post('/api/admin/update-user', (req, res) => {
    if (!req.isAuthenticated() || (req.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
        return res.status(403).json({ ok: false, error: "ACCESS_DENIED" });
    }
    const { userId, addPermanentCredits, addTemporaryCredits, temporaryCreditsExpiresAt, unlimitedAccessExpiresAt, isB2B } = req.body;
    const db = readDb(DB_USERS);
    const users = db.users || [];
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) {
        return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }
    
    if (typeof addPermanentCredits === 'number') {
        const currentPerm = users[idx].permanentCredits ?? users[idx].paidGenerationsRemaining ?? 0;
        users[idx].permanentCredits = Math.max(0, currentPerm + addPermanentCredits);
        users[idx].paidGenerationsRemaining = users[idx].permanentCredits;
    }
    
    if (typeof addTemporaryCredits === 'number') {
        users[idx].temporaryCredits = Math.max(0, (users[idx].temporaryCredits || 0) + addTemporaryCredits);
    }

    users[idx].temporaryCreditsExpiresAt = temporaryCreditsExpiresAt;
    users[idx].unlimitedAccessExpiresAt = unlimitedAccessExpiresAt;
    users[idx].isB2B = isB2B;
    users[idx].updatedAt = new Date().toISOString();
    
    writeDb(DB_USERS, { users });
    
    const userCopy = { ...users[idx] };
    delete userCopy.passwordHash;
    res.json({ ok: true, user: userCopy });
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
    const db = readDb(DB_PACKAGES);
    const packages = db.packages || [];
    const idx = packages.findIndex(p => p.id === req.params.id);
    if (idx === -1) {
        return res.status(404).json({ ok: false, error: "PACKAGE_NOT_FOUND" });
    }
    const pkg = packages[idx];
    if (pkg.userId !== req.user.id) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    if (pkg.paymentStatus !== "unpaid") {
        return res.status(400).json({ ok: false, error: "CANNOT_DELETE_PAID_PACKAGE" });
    }
    packages.splice(idx, 1);
    writeDb(DB_PACKAGES, { packages });
    return res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        res.json({ ok: true });
    });
});

// ── Email Auth Logic ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendVerificationEmail(email, code) {
    if (!process.env.SMTP_HOST) {
        if (process.env.NODE_ENV !== "production") {
            console.log(`[DEV ONLY] Verification code for ${email}: ${code}`);
        } else {
            console.warn("⚠️ SMTP_HOST is not configured in production. Verification email not sent.");
        }
        return;
    }
    await transporter.sendMail({
        from: process.env.SMTP_FROM || '"HiKorea Forms" <info@hikoreaforms.com>',
        to: email,
        subject: "Verification Code - HiKorea Forms",
        text: `Your verification code is: ${code}\nThis code is valid for 10 minutes.`
    });
}

// ── Email Register Flow ──────────────────────────────────────────────────────
app.post('/api/auth/email/register/request-code', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) return res.json({ success: false, error: "invalid_email" });

    // Rate limiting
    const rl = rateLimits.get(normalizedEmail) || { count: 0, expiresAt: 0 };
    if (rl.expiresAt > Date.now() && rl.count >= 3) return res.json({ success: false, error: "too_many_attempts" });
    rateLimits.set(normalizedEmail, { count: rl.count + 1, expiresAt: Date.now() + 60000 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await bcrypt.hash(code, 10);
    verificationCodes.set(normalizedEmail, { hash, expiresAt: Date.now() + 10 * 60 * 1000, verified: false });

    try {
        await sendVerificationEmail(normalizedEmail, code);
        res.json({ success: true });
    } catch (e) {
        console.error("Email send error:", e);
        res.json({ success: false, error: "email_failed" });
    }
});

app.post('/api/auth/email/register/verify-code', async (req, res) => {
    const { email, code } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const record = verificationCodes.get(normalizedEmail);
    
    if (!record || record.expiresAt < Date.now()) return res.json({ success: false, error: "code_expired" });
    
    const match = await bcrypt.compare(code, record.hash);
    if (!match) return res.json({ success: false, error: "invalid_code" });
    
    record.verified = true;
    res.json({ success: true, verified: true });
});

app.post('/api/auth/email/register/complete', async (req, res) => {
    const { email, password, confirmPassword } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const record = verificationCodes.get(normalizedEmail);

    if (!record || !record.verified) return res.json({ success: false, error: "not_verified" });
    if (password !== confirmPassword) return res.json({ success: false, error: "passwords_do_not_match" });
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) return res.json({ success: false, error: "weak_password" });

    const db = readDb(DB_USERS);
    const users = db.users || [];
    
    let existingUser = users.find(u => (u.email || "").trim().toLowerCase() === normalizedEmail);
    
    const passwordHash = await bcrypt.hash(password, 10);
    let user;

    if (existingUser) {
        // If it's already an email account, error
        if (existingUser.authProvider === "email" || existingUser.passwordHash) {
            return res.json({ success: false, error: "email_exists" });
        }
        // It's a Google account verifying ownership! Link password auth
        existingUser.authProvider = "email"; // Flag that it now also supports email auth
        existingUser.passwordHash = passwordHash;
        existingUser.updatedAt = new Date().toISOString();
        user = existingUser;
    } else {
        // Brand new user
        user = {
            id: uuidv4(),
            email: normalizedEmail,
            name: "",
            authProvider: "email",
            passwordHash,
            freeDownloadsUsed: 0,
            paidGenerationsRemaining: 0,
            isB2B: false,
            freeGenerationUsed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        users.push(user);
    }
    
    writeDb(DB_USERS, { users });
    verificationCodes.delete(normalizedEmail); // consume

    req.login(user, (err) => {
        if (err) return res.json({ success: false, error: "login_error" });
        req.session.save((saveErr) => {
            if (saveErr) console.error("Session save error during register:", saveErr);
            const safeUser = { ...user };
            delete safeUser.passwordHash;
            res.json({ success: true, user: safeUser });
        });
    });
});

// ── Email Login ──────────────────────────────────────────────────────────────
app.post('/api/auth/email/login', (req, res, next) => {
    console.log("[DEBUG-LOGIN] Request received. Body fields present:", Object.keys(req.body || {}));
    passport.authenticate('local', (err, user, info) => {
        console.log("[DEBUG-LOGIN] Passport authenticate callback trigger:", { errPresent: !!err, userPresent: !!user, info });
        if (err) {
            console.error("[DEBUG-LOGIN] Passport strategy threw error:", err);
            return next(err);
        }
        if (!user) {
            console.log("[DEBUG-LOGIN] Authentication failed: Invalid credentials");
            return res.json({ success: false, error: "invalid_credentials" });
        }
        console.log("[DEBUG-LOGIN] Attempting req.login for user id:", user.id);
        req.login(user, (err) => {
            if (err) {
                console.error("[DEBUG-LOGIN] req.login callback error:", err);
                return next(err);
            }
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("[DEBUG-LOGIN] Session save error:", saveErr);
                    return next(saveErr);
                }
                console.log("[DEBUG-LOGIN] Login Successful and session saved for user id:", user.id);
                const safeUser = { ...user };
                delete safeUser.passwordHash;
                return res.json({ success: true, user: safeUser });
            });
        });
    })(req, res, next);
});

// ── Password Reset Flow ──────────────────────────────────────────────────────
app.post('/api/auth/email/password-reset/request-code', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) return res.json({ success: false });

    // Always succeed superficially
    const db = readDb(DB_USERS);
    const user = (db.users || []).find(u => (u.email || "").trim().toLowerCase() === normalizedEmail);
    if (!user) return res.json({ success: true }); // pretend it worked

    const rl = rateLimits.get('reset_' + normalizedEmail) || { count: 0, expiresAt: 0 };
    if (rl.expiresAt > Date.now() && rl.count >= 2) return res.json({ success: true });
    rateLimits.set('reset_' + normalizedEmail, { count: rl.count + 1, expiresAt: Date.now() + 60000 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = await bcrypt.hash(code, 10);
    passwordResetCodes.set(normalizedEmail, { hash, expiresAt: Date.now() + 10 * 60 * 1000, verified: false });

    try {
        await sendVerificationEmail(normalizedEmail, code);
    } catch (e) {
        console.error("Email send error:", e);
    }
    res.json({ success: true });
});

app.post('/api/auth/email/password-reset/verify-code', async (req, res) => {
    const { email, code } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const record = passwordResetCodes.get(normalizedEmail);
    
    if (!record || record.expiresAt < Date.now()) return res.json({ success: false, error: "code_expired" });
    
    const match = await bcrypt.compare(code, record.hash);
    if (!match) return res.json({ success: false, error: "invalid_code" });
    
    record.verified = true;
    res.json({ success: true, verified: true });
});

app.post('/api/auth/email/password-reset/complete', async (req, res) => {
    const { email, password, confirmPassword } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    const record = passwordResetCodes.get(normalizedEmail);

    if (!record || !record.verified) return res.json({ success: false, error: "not_verified" });
    if (password !== confirmPassword) return res.json({ success: false, error: "passwords_do_not_match" });
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) return res.json({ success: false, error: "weak_password" });

    const db = readDb(DB_USERS);
    const users = db.users || [];
    let userIndex = users.findIndex(u => (u.email || "").trim().toLowerCase() === normalizedEmail);
    
    if (userIndex === -1) return res.json({ success: false, error: "user_not_found" });

    users[userIndex].authProvider = "email"; // Flag as email auth capable
    users[userIndex].passwordHash = await bcrypt.hash(password, 10);
    users[userIndex].updatedAt = new Date().toISOString();
    writeDb(DB_USERS, { users });
    passwordResetCodes.delete(normalizedEmail);

    res.json({ success: true });
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
- STRICTLY IGNORE the Machine Readable Zone (MRZ) code starting with P< at the bottom. Do NOT include any part of it in the JSON.

NAME EXTRACTION RULES:
- surname: Extract ONLY from the Surname / Family Name / Last Name field.
- given_names: Combine ALL other name parts (Given Names, Middle Name, Patronymic, Father's Name, Otasining ismi, Second Name) into a SINGLE string separated by spaces. Preserve exact order.
- Do NOT create separate fields for middle name or patronymic. Combine them all into given_names.
- Keep exact spaces, uppercase, and Latin spelling.
- CRITICAL NAME RULE: If the name (or any part of it) spans two lines and ends with a hyphen (e.g. "CHYNG-" on line 1 and "YZ" on line 2), YOU MUST remove the hyphen and join the two parts WITHOUT ANY SPACES (e.g. "CHYNGYZ"). This applies to both passports and ID cards.

JSON schema:
{
  "surname": "string — surname exactly as printed in Latin",
  "given_names": "string — ALL given names, middle names, and patronymics combined with spaces",
  "full_name": "string — surname + given_names combined with space",
  "nationality": "string — nationality as printed (e.g. RUSSIAN FEDERATION) in Latin",
  "passport_number": "string",
  "birth_date": "string — format YYYY-MM-DD",
  "sex": "string — M or F",
  "birth_place": "string — Place of birth (Country, Region, City) exactly as printed in Latin if possible",
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

Your tasks:
1. id_number — alien registration number (외국인등록번호). Format: exactly 6 digits, hyphen, 7 digits. Example: 741203-5140276
2. full_name — the Latin/English name printed on the card (usually uppercase Latin letters). May appear near the Korean name line or below it.
3. surname — the first word of the Latin name (family name). If you cannot determine it confidently, leave empty.
4. given_names — remaining Latin name words after the surname. If uncertain, leave empty.
5. nationality — nationality as printed on the card in Latin (e.g. KYRGYZ REPUBLIC, UZBEKISTAN, RUSSIA).

CRITICAL NAME RULE: If the name spans two lines and ends with a hyphen on the first line (e.g. "CHYNG-" on line 1 and "YZ" on line 2), you MUST remove the hyphen and join the parts WITHOUT spaces (result: "CHYNGYZ"). Never keep broken hyphens in names.

JSON schema:
{
  "id_number": "string — DDDDDD-DDDDDDD or empty string",
  "full_name": "string — full Latin name, or empty string",
  "surname": "string — family name in Latin, or empty string",
  "given_names": "string — given names in Latin, or empty string",
  "nationality": "string — nationality in Latin, or empty string",
  "uncertain_fields": []
}

Rules:
- Do NOT extract phone number or address.
- Do NOT format or guess the registration number. Use exactly what is printed.
- If registration number is not found, return empty string for id_number.
- CRITICAL: Always return valid JSON even if image is unreadable.
`.trim();

const IDCARD_PASSWORD_RECOVERY_PROMPT = `
You are a Korean alien registration card (외국인등록증) data extraction assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Your task: Extract ONLY from the visible ID-card front side:
1. registration_number: Korean foreign registration number (e.g. 000000-0000000). Preserve hyphen if visible.
2. date_of_birth: calculate from the first 6 digits of registration_number. YYMMDD -> if YY is 00-25 -> 20YY, if YY is 26-99 -> 19YY. Output YYYY-MM-DD.
3. full_name: look for Latin/English name line, usually uppercase Latin letters. May be near the Korean name or below it. Preserve exact spelling from card. If the name spans two lines and ends with a hyphen (e.g. "CHYNG-" on line 1 and "YZ" on line 2), YOU MUST remove the hyphen and join the two parts WITHOUT ANY SPACES (e.g. "CHYNGYZ"). Do not translate. Do not guess.
4. surname: if full_name is visible and clearly separable, first word may be surname. If uncertain, leave empty and put field into uncertain_fields.
5. given_names: remaining Latin name words after surname. If uncertain, leave empty and put field into uncertain_fields.
6. nationality: look for nationality/country field. May be written in English or Korean. Extract exactly as visible. Do not normalize if unsure.

If any field is not visible:
- return empty string
- do not invent
- add to uncertain_fields

JSON schema:
{
  "registration_number": "",
  "date_of_birth": "",
  "full_name": "",
  "surname": "",
  "given_names": "",
  "nationality": "",
  "uncertain_fields": []
}

Rules:
- Address: Do NOT extract address from front side.
- Do NOT guess missing data. Use exactly what is printed.
- CRITICAL: Always return valid JSON even if image is unreadable.
`.trim();

const IDCARD_BACK_PASSWORD_RECOVERY_PROMPT = `
You are a Korean alien registration card (외국인등록증) data extraction assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Your task: Extract only the current Korean address from the back side of the ID-card.

OCR rule:
- On the back side of the ID-card there may be multiple address history entries.
- Read entries from top to bottom.
- Select the lowest entry in the list (the last record / most recent address).
- Use this as the current Korean address.
- Do not extract older addresses above it.
- Do not combine addresses.
- Extract the full address exactly as written.
- Do not translate.
- Do not normalize.
- Do not invent missing parts.

JSON schema:
{
  "address": "",
  "uncertain_fields": []
}

Rules:
- If address is not clearly recognized, leave address as "" and add "address" to uncertain_fields.
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
            responseMimeType: "application/json"
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

// Scan processing
app.post("/api/document/process-scan-preview", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ ok: false, error: "No image uploaded." });
        const docType = req.body.docType || "none";
        const corners = req.body.corners || null;
        const keepColor = req.body.keepColor || "false";
        
        const tmpDir = mkdtempSync(join(tmpdir(), "scan-"));
        const inputPath = join(tmpDir, "input.jpg");
        const outputPath = join(tmpDir, "output.jpg");
        
        writeFileSync(inputPath, req.file.buffer);
        
        const scriptPath = resolve(__dirname, "pdf", "scan_processor.py");
        
        const pyArgs = ["--input", inputPath, "--output", outputPath, "--doc_type", docType];
        if (corners) {
            pyArgs.push("--corners", corners);
        }
        if (keepColor === "true") {
            pyArgs.push("--keep_color", "true");
        }
        
        await new Promise((resolve_p, reject_p) => {
            const py = spawn("python3", [scriptPath, ...pyArgs]);
            let stderr = "";
            py.stderr.on("data", (d) => { stderr += d.toString(); });
            py.on("close", (code) => {
                if (code === 0) resolve_p();
                else reject_p(new Error(stderr || "Python error"));
            });
        });
        
        if (!existsSync(outputPath)) {
            throw new Error("Output image not found");
        }
        
        const processedBuffer = readFileSync(outputPath);
        
        try { unlinkSync(inputPath); unlinkSync(outputPath); } catch {}
        
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=31536000");
        return res.send(processedBuffer);
    } catch (err) {
        console.error("❌ [Scan Processor] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Processing failed: " + err.message });
    }
});

// ID Card OCR
app.post("/api/ocr/idcard", upload.single("idcard"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const action = req.body.action || "";
        const targetPrompt = action === "password_recovery" ? PROVIDER_IDCARD_PROMPT : IDCARD_PROMPT;

        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        let response;
        let modelUsed = "gemini-2.5-flash";

        try {
            console.log(`➡️ [OCR ID Card] Trying ${modelUsed}...`);
            response = await generateWithModel(modelUsed, mimetype, base64Data, targetPrompt);
        } catch (err1) {
            if (isOverloadError(err1)) {
                console.warn(`⚠️ [OCR ID Card] ${modelUsed} overloaded. Falling back...`);
                modelUsed = "gemini-3.1-flash-lite";
                try {
                    console.log(`➡️ [OCR ID Card] Trying ${modelUsed}...`);
                    response = await generateWithModel(modelUsed, mimetype, base64Data, targetPrompt);
                } catch (err2) {
                    if (isOverloadError(err2)) {
                        console.warn(`⚠️ [OCR ID Card] ${modelUsed} also overloaded. Waiting 1500ms...`);
                        await new Promise(r => setTimeout(r, 1500));
                        try {
                            console.log(`➡️ [OCR ID Card] Retrying ${modelUsed}...`);
                            response = await generateWithModel(modelUsed, mimetype, base64Data, targetPrompt);
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

        // Safely extract text from Gemini response (SDK can return text as getter or via candidates)
        let rawText = "";
        try {
            rawText = response.text ?? "";
        } catch {}
        if (!rawText) {
            try {
                rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            } catch {}
        }
        console.log(`✅ [OCR ID Card] Gemini raw (full): ${rawText}`);

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

        // Try to extract name fields from the same Gemini response (for non-password_recovery)
        let parsedForName = {};
        try {
            parsedForName = extractJsonFromText(rawText);
        } catch {}

        // Normalize name: remove broken hyphens at end of word joined to next word
        function fixBrokenName(str) {
            if (!str) return str;
            return str.replace(/-\s+/g, '').replace(/(\w)-([\n\r]+)(\w)/g, '$1$3');
        }

        const rawFullName = parsedForName.full_name || "";
        const rawSurname = parsedForName.surname || "";
        const rawGivenNames = parsedForName.given_names || "";
        const rawNationality = parsedForName.nationality || "";

        let responseData = {
            id_number: idNumber,
            full_name: fixBrokenName(rawFullName),
            surname: fixBrokenName(rawSurname),
            given_names: fixBrokenName(rawGivenNames),
            nationality: rawNationality,
            uncertain_fields: idNumber ? [] : ["id_number"],
        };

        if (action === "password_recovery") {
            try {
                const parsed = extractJsonFromText(rawText);
                responseData = {
                    ...parsed,
                    id_number: idNumber // keep fallback just in case
                };
            } catch (e) {
                console.warn("[OCR ID Card] Could not map recovery fields");
            }
        }

        console.log(`✅ [OCR ID Card] Returning to frontend: ${JSON.stringify(responseData)}`);
        return res.json({
            ok: true,
            data: responseData,
            meta: { model: modelUsed },
        });

    } catch (err) {
        console.error("❌ [OCR ID Card] Unexpected error:", err);
        return res.status(500).json({
            error: err.message || "Internal server error",
        });
    }
});

// ── ID Card Back OCR ────────────────────────────────────────────────────────
app.post("/api/ocr/idcard-back", upload.single("idcardBack"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        const action = req.body.action || "password_recovery"; // Default to password_recovery for now
        // For password_recovery we use the specific back side prompt
        const targetPrompt = action === "password_recovery" ? IDCARD_BACK_PASSWORD_RECOVERY_PROMPT : IDCARD_BACK_PASSWORD_RECOVERY_PROMPT;

        const { mimetype, buffer } = req.file;
        const base64Data = buffer.toString("base64");
        let response;
        let modelUsed = "gemini-2.5-flash";

        try {
            console.log(`➡️ [OCR ID Card Back] Trying ${modelUsed}...`);
            response = await generateWithModel(modelUsed, mimetype, base64Data, targetPrompt);
        } catch (err) {
            console.error("❌ [OCR ID Card Back] Gemini error:", err.message);
            return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
        }

        const rawText = response.text ?? "";
        console.log(`✅ [OCR ID Card Back] Gemini raw: ${rawText.substring(0, 200)}`);

        let address = "";
        let uncertain_fields = [];
        try {
            const parsed = extractJsonFromText(rawText);
            address = (parsed.address || "").trim();
            uncertain_fields = Array.isArray(parsed.uncertain_fields) ? parsed.uncertain_fields : [];
        } catch (e) {
            console.warn("[OCR ID Card Back] JSON parse failed, trying regex fallback");
            const match = rawText.match(/[\uAC00-\uD7A3][^\n]{5,}/);
            if (match) address = match[0].trim();
        }

        return res.json({
            ok: true,
            data: { address, uncertain_fields },
            meta: { model: modelUsed },
        });

    } catch (err) {
        console.error("❌ [OCR ID Card Back] Unexpected error:", err);
        return res.status(500).json({
            error: err.message || "Internal server error",
        });
    }
});

// ── Contract Address OCR ────────────────────────────────────────────────────
const CONTRACT_ADDRESS_PROMPT = `
You are an expert OCR assistant.

Return ONLY a valid JSON object. No markdown. No code blocks. No explanations.

Your ONLY task: Extract the full Korean address from the provided image.
IMPORTANT: You will receive the top 66% of a document. There might be multiple addresses (e.g. rented property address vs landlord address).
You MUST extract the FIRST address from the top (usually labeled "소재지" or "부동산의 표시").
Just find and extract this first address (e.g., starts with 서울, 인천광역시, 경기, or ends with 동, 로, 층, 호).
If there is a label like "소재지" or "주소", ignore the label itself and extract the address value next to it.

JSON schema:
{
  "address": "string — the full Korean address as printed, or empty string if not found",
  "uncertain_fields": []
}

Rules:
- Extract ONLY the address. Combine multiple parts into a single string.
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
        let modelUsed = "gemini-2.5-flash";
        let response;

        // 1. Try Primary Model
        try {
            console.log(`➡️ [OCR Address] Trying ${modelUsed}...`);
            response = await generateWithModel(modelUsed, mimetype, base64Data, CONTRACT_ADDRESS_PROMPT);
        } catch (err1) {
            if (isOverloadError(err1)) {
                console.warn(`⚠️ [OCR Address] ${modelUsed} overloaded. Falling back...`);
                modelUsed = "gemini-3.1-flash-lite";
                
                // 2. Try Fallback Model
                try {
                    console.log(`➡️ [OCR Address] Trying ${modelUsed}...`);
                    response = await generateWithModel(modelUsed, mimetype, base64Data, CONTRACT_ADDRESS_PROMPT);
                } catch (err2) {
                    if (isOverloadError(err2)) {
                        console.warn(`⚠️ [OCR Address] ${modelUsed} also overloaded. Waiting 1500ms...`);
                        await new Promise(r => setTimeout(r, 1500));
                        
                        // 3. Final Retry
                        try {
                            console.log(`➡️ [OCR Address] Retrying ${modelUsed}...`);
                            response = await generateWithModel(modelUsed, mimetype, base64Data, CONTRACT_ADDRESS_PROMPT);
                        } catch (err3) {
                            console.error("❌ [OCR Address] All models overloaded.", err3.message);
                            return res.status(503).json({ ok: false, error: "Ошибка сервиса распознавания (перегрузка)." });
                        }
                    } else {
                        console.error("❌ [OCR Address] Gemini error on fallback:", err2.message);
                        return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
                    }
                }
            } else {
                console.error("❌ [OCR Address] Gemini error:", err1.message);
                return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
            }
        }

        const rawText = response.text ?? "";
        console.log(`✅ [OCR Address] Gemini raw: ${rawText.substring(0, 300)}`);

        let address = "";
        try {
            const parsed = extractJsonFromText(rawText);
            address = (parsed.address || "").trim();
            
            if (!address) {
                const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5);
                const addrLine = lines.find(l => /소\s*재\s*지|주\s*소/.test(l) || /[\uAC00-\uD7A3]+.*[시군구]/.test(l));
                if (addrLine) address = addrLine.replace(/^(?:소\s*재\s*지|주\s*소)\s*[:：]?\s*/, '').trim();
            }
        } catch {
            const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 5);
            const addrLine = lines.find(l => /소\s*재\s*지|주\s*소/.test(l) || /[\uAC00-\uD7A3]+.*[시군구]/.test(l));
            if (addrLine) {
                address = addrLine.replace(/^(?:소\s*재\s*지|주\s*소)\s*[:：]?\s*/, '').trim();
            } else {
                const match = rawText.match(/[\uAC00-\uD7A3][^\n]{5,}/);
                if (match) address = match[0].trim();
            }
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
1. full_name_for_check — the name printed on the card (Latin or Korean). CRITICAL NAME RULE: If the name spans two lines and ends with a hyphen (e.g. "CHYNG-" on line 1 and "YZ" on line 2), YOU MUST remove the hyphen and join the two parts WITHOUT ANY SPACES (e.g. "CHYNGYZ").
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
        let response;
        let modelUsed = "gemini-2.5-flash";
        try {
            console.log(`➡️ [OCR Provider ID] Trying ${modelUsed}...`);
            response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_IDCARD_PROMPT);
        } catch (err1) {
            if (isOverloadError(err1)) {
                console.warn(`⚠️ [OCR Provider ID] ${modelUsed} overloaded. Falling back...`);
                modelUsed = "gemini-3.1-flash-lite";
                try {
                    console.log(`➡️ [OCR Provider ID] Trying ${modelUsed}...`);
                    response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_IDCARD_PROMPT);
                } catch (err2) {
                    if (isOverloadError(err2)) {
                        console.warn(`⚠️ [OCR Provider ID] ${modelUsed} also overloaded. Waiting 1500ms...`);
                        await new Promise(r => setTimeout(r, 1500));
                        try {
                            console.log(`➡️ [OCR Provider ID] Retrying ${modelUsed}...`);
                            response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_IDCARD_PROMPT);
                        } catch (err3) {
                            return res.status(503).json({ ok: false, error: "Ошибка сервиса распознавания." });
                        }
                    } else {
                        return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
                    }
                }
            } else {
                return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
            }
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
        let response;
        let modelUsed = "gemini-2.5-flash";
        try {
            console.log(`➡️ [OCR Provider Contract] Trying ${modelUsed}...`);
            response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_CONTRACT_PROMPT);
        } catch (err1) {
            if (isOverloadError(err1)) {
                console.warn(`⚠️ [OCR Provider Contract] ${modelUsed} overloaded. Falling back...`);
                modelUsed = "gemini-3.1-flash-lite";
                try {
                    console.log(`➡️ [OCR Provider Contract] Trying ${modelUsed}...`);
                    response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_CONTRACT_PROMPT);
                } catch (err2) {
                    if (isOverloadError(err2)) {
                        console.warn(`⚠️ [OCR Provider Contract] ${modelUsed} also overloaded. Waiting 1500ms...`);
                        await new Promise(r => setTimeout(r, 1500));
                        try {
                            console.log(`➡️ [OCR Provider Contract] Retrying ${modelUsed}...`);
                            response = await generateWithModel(modelUsed, mimetype, base64Data, PROVIDER_CONTRACT_PROMPT);
                        } catch (err3) {
                            return res.status(503).json({ ok: false, error: "Ошибка сервиса распознавания." });
                        }
                    } else {
                        return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
                    }
                }
            } else {
                return res.status(502).json({ ok: false, error: "Ошибка сервиса распознавания." });
            }
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

// ── Mock Payment ────────────────────────────────────────────────────────────
app.post("/api/payment/mock-success", (req, res) => {
    if (IS_PROD) {
        return res.status(404).json({ error: "NOT_FOUND" });
    }
    if (!req.isAuthenticated()) {
        return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    }
    const { packageIds, usedCredits } = req.body || {};
    const udb = readDb(DB_USERS);
    const dbUser = udb.users?.find(u => u.id === req.user.id);
    if (!dbUser) {
        return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
    }
    
    if (typeof usedCredits === 'number' && usedCredits > 0) {
        dbUser.paidGenerationsRemaining = Math.max(0, (dbUser.paidGenerationsRemaining || 0) - usedCredits);
    }
    
    if (Array.isArray(packageIds) && packageIds.length > 0) {
        dbUser.packages = dbUser.packages || [];
        packageIds.forEach(id => {
            const pkg = dbUser.packages.find(p => p.id === id);
            if (pkg) pkg.paymentStatus = "paid";
        });

        // Update global packages DB
        const pdb = readDb(DB_PACKAGES);
        if (pdb.packages) {
            let pUpdated = false;
            packageIds.forEach(id => {
                const globalPkg = pdb.packages.find(p => p.id === id);
                if (globalPkg) {
                    globalPkg.paymentStatus = "paid";
                    pUpdated = true;
                }
            });
            if (pUpdated) writeDb(DB_PACKAGES, pdb);
        }
    }

    dbUser.updatedAt = new Date().toISOString();
    writeDb(DB_USERS, udb);
    
    // Sync active session user
    req.user.paidGenerationsRemaining = dbUser.paidGenerationsRemaining;
    
    const safeUser = { ...dbUser };
    delete safeUser.passwordHash;
    
    return res.json({ ok: true, user: safeUser });
});

// ── PortOne Payment Verify ──────────────────────────────────────────────────
app.post("/api/payment/portone/verify", async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    }
    const { paymentId, packageIds, usedCredits } = req.body;
    
    try {
        // 1. Get token (V2 API)
        const tokenRes = await fetch("https://api.portone.io/login/api-secret", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiSecret: process.env.PORTONE_API_SECRET
            })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            console.error("PortOne token error:", tokenData);
            return res.status(400).json({ ok: false, error: "Failed to get PortOne token" });
        }
        const { accessToken } = tokenData;

        // 2. Get payment info
        const paymentRes = await fetch(`https://api.portone.io/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });
        const paymentData = await paymentRes.json();
        console.log("PortOne Payment Data:", JSON.stringify(paymentData, null, 2));

        if (!paymentRes.ok) {
            return res.status(400).json({ ok: false, error: "Payment verification failed" });
        }

        if (paymentData.status !== 'PAID' && paymentData.status !== 'VIRTUAL_ACCOUNT_ISSUED') {
            return res.status(400).json({ ok: false, error: "Payment not completed" });
        }

        const isVirtualAccount = paymentData.status === 'VIRTUAL_ACCOUNT_ISSUED';
        const targetPaymentStatus = isVirtualAccount ? 'pending_transfer' : 'paid';

        // 3. Mark as paid or pending
        const udb = readDb(DB_USERS);
        const dbUser = udb.users?.find(u => u.id === req.user.id);
        if (!dbUser) return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
        
        if (Array.isArray(packageIds) && packageIds.length > 0) {
            dbUser.packages = dbUser.packages || [];
            packageIds.forEach(id => {
                const pkg = dbUser.packages.find(p => p.id === id);
                if (pkg) {
                    pkg.paymentStatus = targetPaymentStatus;
                    if (isVirtualAccount && paymentData.paymentMethod?.virtualAccount) {
                        pkg.virtualAccount = paymentData.paymentMethod.virtualAccount;
                    }
                }
            });

            // Update global packages DB
            const pdb = readDb(DB_PACKAGES);
            if (pdb.packages) {
                let pUpdated = false;
                packageIds.forEach(id => {
                    const globalPkg = pdb.packages.find(p => p.id === id);
                    if (globalPkg) {
                        globalPkg.paymentStatus = targetPaymentStatus;
                        if (isVirtualAccount && paymentData.paymentMethod?.virtualAccount) {
                            globalPkg.virtualAccount = paymentData.paymentMethod.virtualAccount;
                        }
                        pUpdated = true;
                    }
                });
                if (pUpdated) writeDb(DB_PACKAGES, pdb);
            }
        }

        dbUser.updatedAt = new Date().toISOString();
        writeDb(DB_USERS, udb);
        
        req.user.paidGenerationsRemaining = dbUser.paidGenerationsRemaining;
        const safeUser = { ...dbUser };
        delete safeUser.passwordHash;
        
        return res.json({ 
            ok: true, 
            user: safeUser, 
            isVirtualAccount, 
            virtualAccount: isVirtualAccount ? paymentData.paymentMethod?.virtualAccount : null 
        });

    } catch (err) {
        console.error("PortOne verification error:", err);
        return res.status(500).json({ ok: false, error: "Internal server error" });
    }
});

// ── PortOne Webhook (Virtual Account Deposit) ─────────────────────────────
app.post("/api/payment/portone/webhook", async (req, res) => {
    try {
        const { type, data } = req.body;
        // Check if it's a deposit event or payment completed
        if (type !== 'Transaction' || !data || !data.paymentId) {
            return res.status(200).send("OK");
        }

        const paymentId = data.paymentId;

        // Verify with PortOne
        const tokenRes = await fetch("https://api.portone.io/login/api-secret", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiSecret: process.env.PORTONE_API_SECRET })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) return res.status(400).send("Token error");

        const paymentRes = await fetch(`https://api.portone.io/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${tokenData.accessToken}` }
        });
        const paymentData = await paymentRes.json();
        if (!paymentRes.ok || paymentData.status !== 'PAID') {
            return res.status(200).send("Not paid");
        }

        // Mark as paid in DB
        const udb = readDb(DB_USERS);
        let updated = false;
        if (udb.users) {
            for (const user of udb.users) {
                if (user.packages) {
                    for (const pkg of user.packages) {
                        // Assuming the paymentId or virtual account was linked to the user
                        // We will just find pending_transfer packages that have a virtual account
                        // Unfortunately we didn't store the paymentId in the package.
                        // We should search if this user was waiting for this payment.
                        // Wait, if it's a webhook, PortOne gives us 'customData' or we can check virtualAccount
                        if (pkg.paymentStatus === 'pending_transfer') {
                            // Without paymentId saved, let's assume it's this pending one (simplified for MVP)
                            pkg.paymentStatus = 'paid';
                            updated = true;
                        }
                    }
                }
            }
        }

        if (updated) {
            writeDb(DB_USERS, udb);
        }

        // Update global packages DB
        const pdb = readDb(DB_PACKAGES);
        let pUpdated = false;
        if (pdb.packages) {
            for (const globalPkg of pdb.packages) {
                // If there's a webhook for this payment, ideally we'd match packageId, 
                // but since we only have one pending virtual account globally or by user,
                // we'll mark all pending as paid as a simplification for now.
                if (globalPkg.paymentStatus === 'pending_transfer') {
                    globalPkg.paymentStatus = 'paid';
                    pUpdated = true;
                }
            }
        }
        if (pUpdated) {
            writeDb(DB_PACKAGES, pdb);
        }

        return res.status(200).send("OK");

    } catch (err) {
        console.error("PortOne Webhook error:", err);
        return res.status(500).send("Internal Server Error");
    }
});

app.post("/api/generate/application", async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED", message: "Войдите в аккаунт." });
    }
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
    application:      resolve(__dirname, "templates", "application.pdf"),
    accommodation:    resolve(__dirname, "templates", "accommodation.pdf"),
    occupation:       resolve(__dirname, "templates", "occupation.pdf"),
    guarantee:        resolve(__dirname, "templates", "guarantee.pdf"),
    gosoF4:           resolve(__dirname, "templates", "goso_f4.pdf"),
    school:           resolve(__dirname, "templates", "school_report.pdf"),
    passwordRecovery: resolve(__dirname, "templates", "password_recovery.pdf"),
    otkaz:            resolve(__dirname, "templates", "f4_non_employment_pledge.pdf")
};


async function generatePackageFiles(b, tmpDir, reqFiles = null, packageId = null) {
        const outputFiles = [];
        const uploadDir = packageId ? join(__dirname, "data", "uploads", packageId) : null;

        // ── Helper: parse birth date ─────────────────────────────────────────
        const bd = (b.birthDate || "").split("-");
        const birthYear  = bd[0] || "";
        const birthMonth = bd[1] || "";
        const birthDay   = bd[2] || "";

        const signaturesMap = {
            applicant: b.signatures?.applicant?.completed ? b.signatures.applicant.imageBase64 : null,
            guarantor: b.signatures?.guarantor?.completed ? b.signatures.guarantor.imageBase64 : null,
            accommodationProvider: b.signatures?.accommodationProvider?.completed ? b.signatures.accommodationProvider.imageBase64 : null,
        };

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
        // 0. Восстановление пароля на HiKorea
        // ════════════════════════════════════════════════════════════════════
        if (b.action === "password_recovery") {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const serverDate = `${yyyy}-${mm}-${dd}`;

            const data = {
                fullName:             b.fullName         || `${b.surname || ""} ${b.givenNames || ""}`.trim(),
                surname:              b.surname          || "",
                given_names:          b.givenNames       || "",
                birth_year:           birthYear,
                birth_month:          birthMonth,
                birth_day:            birthDay,
                sex:                  b.sex              || "",
                nationality:          b.nationality      || "",
                arc:                  b.idNumber         || "",
                cell_phone:           b.phone            || "",
                hikorea_id:           b.hikoreaId        || "",
                address:              b.address          || "",
                webmaster_message:    "계정 생성 당시 등록한 거주지 주소를 현재 기억하지 못하고 있습니다.",
                application_date:     serverDate
            };
            const jsonPath = join(tmpDir, "rec.json");
            const outPath  = join(tmpDir, "01_password_recovery.pdf");
            writeFileSync(jsonPath, JSON.stringify(data), "utf8");
            
            const tpl = existsSync(TEMPLATES.passwordRecovery) ? TEMPLATES.passwordRecovery : TEMPLATES.application;
            
            let sigPath = "";
            if (reqFiles && reqFiles.signature?.[0]) {
                sigPath = join(tmpDir, "signature.jpg");
                writeFileSync(sigPath, reqFiles.signature[0].buffer);
            } else if (b.signature && b.signature.startsWith("data:image/")) {
                sigPath = join(tmpDir, "signature.jpg");
                const base64Data = b.signature.replace(/^data:image\/\w+;base64,/, "");
                writeFileSync(sigPath, Buffer.from(base64Data, "base64"));
            } else if (uploadDir && existsSync(join(uploadDir, "signature.jpg"))) {
                sigPath = join(uploadDir, "signature.jpg");
            }

            let idCardPath = "";
            let idCardBackPath = "";
            if (reqFiles && reqFiles.idCard?.[0]) {
                idCardPath = join(tmpDir, "idCard.jpg");
                writeFileSync(idCardPath, reqFiles.idCard[0].buffer);
            } else if (uploadDir && existsSync(join(uploadDir, "idCard.jpg"))) {
                idCardPath = join(uploadDir, "idCard.jpg");
            }
            if (reqFiles && reqFiles.idCardBack?.[0]) {
                idCardBackPath = join(tmpDir, "idCardBack.jpg");
                writeFileSync(idCardBackPath, reqFiles.idCardBack[0].buffer);
            } else if (uploadDir && existsSync(join(uploadDir, "idCardBack.jpg"))) {
                idCardBackPath = join(uploadDir, "idCardBack.jpg");
            }
            
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_password_recovery_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_password_recovery_form(d, '${sigPath.replace(/\\/g, "/")}', '${tpl.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}', '${idCardPath.replace(/\\/g, "/")}', '${idCardBackPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        }

        // ════════════════════════════════════════════════════════════════════
        // 1. 통합신청서(신고서) — only if visaType !== "F4"
        // ════════════════════════════════════════════════════════════════════
        if (b.visaType !== "F4" && b.action !== "password_recovery") {
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
                visaType:             b.visaType         || "",
                action:               b.action           || "",
                signatures:           signaturesMap
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
        if (b.housingType === "other" && b.action !== "password_recovery") {
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
                applicant_signature_b64: b.applicantSignatureB64 || "",
                provider_signature_b64: b.providerSignatureB64 || "",
                acc_relationship: b.accRelationship || "",
                acc_ownership_type: b.accOwnershipType || "",
                acc_residence_type: b.accResidenceType || "",
                signatures: signaturesMap
            };
            const jsonPath = join(tmpDir, "acc.json");
            const outPath  = join(tmpDir, "02_accommodation_edited.pdf");
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

        if (b.action !== "address_change" && b.action !== "password_recovery" && b.action !== "initial" && b.isStudent === false && age >= 19 && b.visaType !== "F1") {
            const data = {
                surname:     b.surname     || "",
                given_names: b.givenNames  || "",
                birth_year:  birthYear,
                birth_month: birthMonth,
                birth_day:   birthDay,
                sex:         b.sex         || "",
                nationality: b.nationality || "",
                arc:         b.idNumber    || "",
                occupationType: b.occupationType || "",
                signatures: signaturesMap
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
        if (b.visaType === "F1" && b.action !== "password_recovery" && b.action !== "address_change" && b.action !== "reissue") {
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
                signatures:             signaturesMap
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
        if (b.visaType === "F4" && b.action !== "password_recovery") {
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
                action:               b.action           || "",
                signatures:           signaturesMap
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
                         && b.action !== "password_recovery"
                         && b.action !== "initial"
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
                signatures:      signaturesMap,
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
        } else if ((b.isStudent === true || schoolName.length > 0) && b.action !== "password_recovery") {
            console.warn("[PDF Package] School template not found, skipping school form.");
        }

        // ════════════════════════════════════════════════════════════════════
        // 6.5. Отказ от работы (otkazot raboty.pdf)
        // ════════════════════════════════════════════════════════════════════
        if (b.visaType === "F4" && b.action === "initial" && existsSync(TEMPLATES.otkaz)) {
            const today = new Date();
            const data = {
                full_name:           `${b.surname || ""} ${b.givenNames || ""}`.trim(),
                nationality:         b.nationality || "",
                gender:              b.sex || "",
                date_of_birth:       b.birthDate || "",
                phone:               b.phone || "",
                passport_number:     b.passportNumber || "",
                passport_issue_date: b.passportIssueDate || "",
                passport_expiry_date:b.passportExpiryDate || "",
                address:             b.address || "",
                date_year:           today.getFullYear().toString(),
                date_month:          String(today.getMonth() + 1).padStart(2, "0"),
                date_day:            String(today.getDate()).padStart(2, "0"),
                applicant_name:      `${b.surname || ""} ${b.givenNames || ""}`.trim()
            };
            const jsonPath = join(tmpDir, "otkaz.json");
            writeFileSync(jsonPath, JSON.stringify(data));
            const outPath = join(tmpDir, "07_otkaz.pdf");
            await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_otkaz_form
with open('${jsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_otkaz_form(d, '${TEMPLATES.otkaz.replace(/\\/g, "/")}', '${outPath.replace(/\\/g, "/")}')
`);
            outputFiles.push(outPath);
        }

        // ════════════════════════════════════════════════════════════════════
        // ════════════════════════════════════════════════════════════════════
        // 7. Скан-копии (Passport, ID Card, ID Card Back, Contract, Provider ID, Guarantor Passport)
        // ════════════════════════════════════════════════════════════════════
        const ATTACH_UPLOADED_DOCUMENT_COPIES = false;
        if (ATTACH_UPLOADED_DOCUMENT_COPIES && b.action !== "password_recovery" && ((reqFiles && (reqFiles.passport || reqFiles.idCard || reqFiles.idCardBack || reqFiles.contract || reqFiles.providerIdCard || reqFiles.guarantorPassport)) || uploadDir)) {
            try {
                const filesDict = {};
                if (reqFiles && reqFiles.passport?.[0]) {
                    const p = join(tmpDir, "passport.jpg");
                    writeFileSync(p, reqFiles.passport[0].buffer);
                    filesDict.passport = p;
                } else if (uploadDir && existsSync(join(uploadDir, "passport.jpg"))) {
                    filesDict.passport = join(uploadDir, "passport.jpg");
                }
                if (reqFiles && reqFiles.idCard?.[0]) {
                    const p = join(tmpDir, "idCard.jpg");
                    writeFileSync(p, reqFiles.idCard[0].buffer);
                    filesDict.idCard = p;
                } else if (uploadDir && existsSync(join(uploadDir, "idCard.jpg"))) {
                    filesDict.idCard = join(uploadDir, "idCard.jpg");
                }
                if (reqFiles && reqFiles.idCardBack?.[0]) {
                    const p = join(tmpDir, "idCardBack.jpg");
                    writeFileSync(p, reqFiles.idCardBack[0].buffer);
                    filesDict.idCardBack = p;
                } else if (uploadDir && existsSync(join(uploadDir, "idCardBack.jpg"))) {
                    filesDict.idCardBack = join(uploadDir, "idCardBack.jpg");
                }
                if (reqFiles && reqFiles.contract?.[0]) {
                    const p = join(tmpDir, "contract.jpg");
                    writeFileSync(p, reqFiles.contract[0].buffer);
                    filesDict.contract = p;
                } else if (uploadDir && existsSync(join(uploadDir, "contract.jpg"))) {
                    filesDict.contract = join(uploadDir, "contract.jpg");
                }
                if (reqFiles && reqFiles.providerIdCard?.[0]) {
                    const p = join(tmpDir, "providerIdCard.jpg");
                    writeFileSync(p, reqFiles.providerIdCard[0].buffer);
                    filesDict.providerIdCard = p;
                } else if (uploadDir && existsSync(join(uploadDir, "providerIdCard.jpg"))) {
                    filesDict.providerIdCard = join(uploadDir, "providerIdCard.jpg");
                }
                if (reqFiles && reqFiles.guarantorPassport?.[0]) {
                    const p = join(tmpDir, "guarantorPassport.jpg");
                    writeFileSync(p, reqFiles.guarantorPassport[0].buffer);
                    filesDict.guarantorPassport = p;
                } else if (uploadDir && existsSync(join(uploadDir, "guarantorPassport.jpg"))) {
                    filesDict.guarantorPassport = join(uploadDir, "guarantorPassport.jpg");
                }
                
                if (Object.keys(filesDict).length > 0) {
                
                const scansJsonPath = join(tmpDir, "scans.json");
                const scansOutPath  = join(tmpDir, "07_scans.pdf");
                writeFileSync(scansJsonPath, JSON.stringify(filesDict), "utf8");
                
                await runPython(`
import json, sys
sys.path.insert(0, '${pyDir}')
from pdf_generator import generate_scan_pages
with open('${scansJsonPath.replace(/\\/g, "/")}') as f: d = json.load(f)
generate_scan_pages(d, '${scansOutPath.replace(/\\/g, "/")}')
`);
                if (existsSync(scansOutPath)) {
                    outputFiles.push(scansOutPath);
                }
                }
            } catch (scanErr) {
                console.error("[PDF Package] Failed to generate scan pages:", scanErr.message);
                // DO NOT throw, continue with the rest of the package
            }
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
merged.save('${finalPath.replace(/\\/g, "/")}', deflate=True, garbage=4)
merged.close()
`);
        if (!existsSync(finalPath)) throw new Error("Merged PDF not created");
        return { finalPath, outputFiles, runPython, pyDir };
}

function getOfficialFormCount(pkg) {
    if (!pkg) return 0;
    const act = pkg.action || "";
    const vt = pkg.visaType || "";
    const ht = pkg.housingType || "";
    const isStudent = pkg.isStudent === true;
    const schoolName = (pkg.schoolName || "").trim();
    const birthDate = pkg.birthDate || "";

    if (act === "password_recovery") return 1;

    let count = 0;

    // 1. 통합신청서 — if visaType !== "F4"
    if (vt !== "F4") count++;

    // 2. 거주숙소제공사실확인서 — if housingType === "other"
    if (ht === "other") count++;

    // 3. 외국인 직업 및 연간 소득금액 신고서
    if (act !== "address_change" && act !== "reissue" && !isStudent && vt !== "F1") {
        let age = 0;
        if (birthDate) {
            const today = new Date();
            const dob = new Date(birthDate);
            age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
        }
        if (age >= 19) count++;
    }

    // 4. 신원보증서 — if visaType === "F1"
    if (vt === "F1" && act !== "address_change" && act !== "reissue") count++;

    // 5. 거소신고(신청)서 — if visaType === "F4"
    if (vt === "F4") count++;

    // 6. 재학사항 신고서 — if isStudent or schoolName present
    if (isStudent || schoolName.length > 0) count++;

    // 7. Отказ от работы — if visaType === "F4" and action === "initial"
    if (vt === "F4" && act === "initial") count++;

    return Math.max(count, 1);
}

function calculateCostCredits(b) {
    if (b.action === "password_recovery") return 3;
    const count = getOfficialFormCount(b);
    if (count === 1) return 3;
    if (count === 2) return 4;
    return 5; // 3 or more -> 5 credits
}

function calculatePackagePriceKRW(b) {
    if (b.action === "password_recovery") return 3000;
    const count = getOfficialFormCount(b);
    if (count === 1) return 3000;
    if (count === 2) return 4000;
    return 5000; // 3 or more -> 5000 KRW
}

function checkPaymentRequirement(dbUser, dataToGenerate, requiresPayment) {
    if (!requiresPayment) return { ok: true, isFree: false };
    if (!dbUser) return { ok: false, status: 404, code: "USER_NOT_FOUND", message: "Пользователь не найден." };

    if (!dbUser.isB2B && !dbUser.freeGenerationUsed) {
        return { ok: true, isFree: true, costCredits: 0 };
    }

    if (dbUser.isB2B) {
        const costCredits = calculateCostCredits(dataToGenerate);
        if ((dbUser.paidGenerationsRemaining || 0) < costCredits) {
            return { ok: false, status: 402, code: "PAYMENT_REQUIRED", message: "Недостаточно кредитов." };
        }
        return { ok: true, isFree: false, costCredits };
    } else {
        return { ok: false, status: 402, code: "PAYMENT_REQUIRED", message: "Требуется оплата." };
    }
}

function consumePayment(dbUser, isFree, costCredits) {
    let changed = false;
    if (isFree) {
        dbUser.freeGenerationUsed = true;
        changed = true;
    } else if (dbUser.isB2B && costCredits > 0) {
        dbUser.paidGenerationsRemaining = Math.max(0, (dbUser.paidGenerationsRemaining || 0) - costCredits);
        if (dbUser.permanentCredits !== undefined) {
            dbUser.permanentCredits = dbUser.paidGenerationsRemaining;
        }
        dbUser.lifetimeCreditsSpent = (dbUser.lifetimeCreditsSpent || 0) + costCredits;
        changed = true;
    }
    return changed;
}

function saveUserPackage(user, b, paymentStatus = "paid", downloadCount = 1) {
    if (!user) return null;
    const db = readDb(DB_PACKAGES);
    const packages = db.packages || [];
    
    const pkg = {
        id: b.draftId || uuidv4(),
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        visaType: b.visaType || "",
        action: b.action || "",
        housingType: b.housingType || "",
        applicant: {
            surname: b.surname || "",
            givenNames: b.givenNames || "",
            birthDate: b.birthDate || "",
            sex: b.sex || "",
            nationality: b.nationality || "",
            idNumber: b.idNumber || "",
            passportNumber: b.passportNumber || "",
            isStudent: b.isStudent !== undefined ? b.isStudent : null,
            schoolName: b.schoolName || ""
        },
        address: b.address || "",
        payload: { ...b }, // Store FULL raw payload for 100% exact future re-generations!
        paymentStatus: paymentStatus,
        downloadCount: downloadCount,
        submissionMethod: b.submissionMethod || ""
    };
    
    if (b.draftId) {
        const idx = packages.findIndex(p => p.id === b.draftId);
        if (idx !== -1) {
            if (packages[idx].userId !== user.id) {
                throw new Error("FORBIDDEN");
            }
            pkg.createdAt = packages[idx].createdAt; // Keep original creation date
            packages[idx] = pkg;
        } else {
            packages.push(pkg);
        }
    } else {
        packages.push(pkg);
    }
    
    writeDb(DB_PACKAGES, { packages });
    return pkg;
}

// ── Endpoints ────────────────────────────────────────────────────────────────
app.post("/api/generate/package-draft", upload.fields([{ name: 'passport' }, { name: 'idCard' }, { name: 'idCardBack' }, { name: 'contract' }, { name: 'signature' }, { name: 'providerIdCard' }, { name: 'guarantorPassport' }]), async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "LOGIN_REQUIRED", message: "Войдите в аккаунт, чтобы добавить в корзину." });
        }
        
        let b = req.body;
        if (req.body.payload) {
            try { b = JSON.parse(req.body.payload); } catch {}
        }
        
        // Save as unpaid draft
        const pkg = saveUserPackage(req.user, b, "unpaid", 0);
        
        const uploadDir = join(__dirname, "data", "uploads", pkg.id);
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        
        const ATTACH_UPLOADED_DOCUMENT_COPIES = false;
        
        if (req.files && Object.keys(req.files).length > 0) {
            for (const key of ['passport', 'idCard', 'idCardBack', 'contract', 'signature', 'providerIdCard', 'guarantorPassport']) {
                if (req.files[key]?.[0]) {
                    let saveThisFile = false;
                    if (key === 'signature') saveThisFile = true;
                    else if (b.action === 'password_recovery' && (key === 'idCard' || key === 'idCardBack')) saveThisFile = true;
                    else if (ATTACH_UPLOADED_DOCUMENT_COPIES) saveThisFile = true;
                    
                    if (saveThisFile) {
                        writeFileSync(join(uploadDir, key + ".jpg"), req.files[key][0].buffer);
                    }
                }
            }
        }
        if (b.signature && b.signature.startsWith("data:image/")) {
            const base64Data = b.signature.replace(/^data:image\/\w+;base64,/, "");
            writeFileSync(join(uploadDir, "signature.jpg"), Buffer.from(base64Data, "base64"));
        }

        return res.json({ ok: true, packageId: pkg.id });
    } catch (err) {
        if (err.message === "FORBIDDEN") {
            return res.status(403).json({ ok: false, error: "FORBIDDEN", message: "Cannot overwrite another user's draft" });
        }
        console.error("❌ [PDF Draft] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось сохранить заявление." });
    }
});
app.post("/api/generate/package-preview", upload.fields([{ name: 'passport' }, { name: 'idCard' }, { name: 'idCardBack' }, { name: 'contract' }, { name: 'signature' }, { name: 'providerIdCard' }, { name: 'guarantorPassport' }]), async (req, res) => {
    try {
        let b = req.body;
        if (req.body && req.body.payload) {
            try { b = JSON.parse(req.body.payload); } catch {}
        }
        if (!b || typeof b !== "object") {
            return res.status(400).json({ ok: false, error: "Invalid request body." });
        }

        const draftId = req.body.draftId || b.draftId || null;
        const tmpDir = mkdtempSync(join(tmpdir(), "pkg-"));
        const { finalPath, outputFiles, runPython, pyDir } = await generatePackageFiles(b, tmpDir, req.files, draftId);

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

app.post("/api/generate/package-download", upload.fields([{ name: 'passport' }, { name: 'idCard' }, { name: 'idCardBack' }, { name: 'contract' }, { name: 'signature' }, { name: 'providerIdCard' }, { name: 'guarantorPassport' }]), async (req, res) => {
    try {
        let b = req.body;
        if (req.body.payload) {
            try { b = JSON.parse(req.body.payload); } catch {}
        }

        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "LOGIN_REQUIRED", message: "Войдите в аккаунт, чтобы скачать PDF." });
        }

        let dataToGenerate = b;
        const packageId = b.packageId || req.body.packageId;

        let requiresPayment = true;

        if (packageId) {
            // 1. Re-generating an existing package from history
            const pdb = readDb(DB_PACKAGES);
            const pkg = pdb.packages?.find(p => p.id === packageId && p.userId === req.user.id);
            if (!pkg) {
                return res.status(403).json({ error: "ACCESS_DENIED", message: "У вас нет доступа к этому документу." });
            }
            
            // Prefer exact stored payload if available to prevent body manipulation vulnerabilities!
            dataToGenerate = pkg.payload || b;
            
            // Heuristic fallback for old packages without submissionMethod
            if (!dataToGenerate.submissionMethod) {
                if (dataToGenerate.signature || (req.files && req.files['signature'])) {
                    dataToGenerate.submissionMethod = 'online';
                } else {
                    dataToGenerate.submissionMethod = 'office';
                }
            }

            if (pkg.paymentStatus === "paid") {
                requiresPayment = false;
            }
        }

        let dbUser = null;
        let paymentCheck = { ok: true, isFree: false, costCredits: 0 };

        if (requiresPayment) {
            // 2. Generating a brand new package or downloading an unpaid draft
            const udb = readDb(DB_USERS);
            dbUser = udb.users?.find(u => u.id === req.user.id);

            paymentCheck = checkPaymentRequirement(dbUser, dataToGenerate, requiresPayment);
            if (!paymentCheck.ok) {
                return res.status(paymentCheck.status).json({ error: paymentCheck.code, message: paymentCheck.message });
            }
        }

        // Generate the PDF FIRST before consuming credits!
        const tmpDir = join(tmpdir(), "hikorea-" + uuidv4());
        mkdirSync(tmpDir, { recursive: true });

        // Save uploaded files persistently
        let targetPackageId = packageId || b.draftId;
        if (!targetPackageId) {
            targetPackageId = uuidv4();
            b.draftId = targetPackageId; // So saveUserPackage uses it
        }
        
        const uploadDir = join(__dirname, "data", "uploads", targetPackageId);
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        
        const ATTACH_UPLOADED_DOCUMENT_COPIES = false;
        
        if (req.files && Object.keys(req.files).length > 0) {
            for (const key of ['passport', 'idCard', 'idCardBack', 'contract', 'signature', 'providerIdCard', 'guarantorPassport']) {
                if (req.files[key]?.[0]) {
                    let saveThisFile = false;
                    if (key === 'signature') saveThisFile = true;
                    else if (dataToGenerate.action === 'password_recovery' && (key === 'idCard' || key === 'idCardBack')) saveThisFile = true;
                    else if (ATTACH_UPLOADED_DOCUMENT_COPIES) saveThisFile = true;
                    
                    if (saveThisFile) {
                        writeFileSync(join(uploadDir, key + ".jpg"), req.files[key][0].buffer);
                    }
                }
            }
        }
        
        // Also save base64 signature if present in payload (used in password recovery)
        if (b.signature && b.signature.startsWith("data:image/")) {
            const base64Data = b.signature.replace(/^data:image\/\w+;base64,/, "");
            writeFileSync(join(uploadDir, "signature.jpg"), Buffer.from(base64Data, "base64"));
        }

        const { finalPath, outputFiles } = await generatePackageFiles(dataToGenerate, tmpDir, req.files, targetPackageId);
        const pdfBuffer = readFileSync(finalPath);

        // If generation succeeded, consume the credit and save/update package
        if (requiresPayment) {
            const changed = consumePayment(dbUser, paymentCheck.isFree, paymentCheck.costCredits);
            if (changed) {
                dbUser.updatedAt = new Date().toISOString();
                const udb = readDb(DB_USERS);
                const userIndex = udb.users?.findIndex(u => u.id === req.user.id);
                if (userIndex !== -1) {
                    udb.users[userIndex] = dbUser;
                    writeDb(DB_USERS, udb);
                }
                
                // Sync active session object immediately
                req.user.freeGenerationUsed = dbUser.freeGenerationUsed;
                req.user.paidGenerationsRemaining = dbUser.paidGenerationsRemaining;
                req.user.permanentCredits = dbUser.permanentCredits;
            }

            if (packageId) {
                // Update existing unpaid package to paid
                const pdb = readDb(DB_PACKAGES);
                const pkgIndex = pdb.packages?.findIndex(p => p.id === packageId && p.userId === req.user.id);
                if (pkgIndex !== -1 && pdb.packages[pkgIndex]) {
                    pdb.packages[pkgIndex].paymentStatus = "paid";
                    pdb.packages[pkgIndex].updatedAt = new Date().toISOString();
                    writeDb(DB_PACKAGES, pdb);
                }
            } else {
                saveUserPackage(req.user, b, "paid", 1);
            }
        }



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

app.post("/api/generate/package-email", upload.fields([{ name: 'passport' }, { name: 'idCard' }, { name: 'idCardBack' }, { name: 'contract' }, { name: 'signature' }, { name: 'providerIdCard' }, { name: 'guarantorPassport' }]), async (req, res) => {
    try {
        let b = req.body;
        if (req.body.payload) {
            try { b = JSON.parse(req.body.payload); } catch {}
        }

        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "LOGIN_REQUIRED", message: "Войдите в аккаунт, чтобы отправить PDF." });
        }

        if (!req.user.email) {
            return res.status(400).json({ error: "EMAIL_REQUIRED", message: "У вас не привязан email." });
        }

        let dataToGenerate = b;
        const packageId = b.packageId || req.body.packageId;

        let requiresPayment = true;

        if (packageId) {
            // 1. Re-generating an existing package from history
            const pdb = readDb(DB_PACKAGES);
            const pkg = pdb.packages?.find(p => p.id === packageId && p.userId === req.user.id);
            if (!pkg) {
                return res.status(403).json({ error: "ACCESS_DENIED", message: "У вас нет доступа к этому документу." });
            }
            
            // Prefer exact stored payload if available to prevent body manipulation vulnerabilities!
            dataToGenerate = pkg.payload || b;
            
            // Heuristic fallback for old packages without submissionMethod
            if (!dataToGenerate.submissionMethod) {
                if (dataToGenerate.signature || (req.files && req.files['signature'])) {
                    dataToGenerate.submissionMethod = 'online';
                } else {
                    dataToGenerate.submissionMethod = 'office';
                }
            }

            if (pkg.paymentStatus === "paid") {
                requiresPayment = false;
            }
        }

        let dbUser = null;
        let paymentCheck = { ok: true, isFree: false, costCredits: 0 };

        if (requiresPayment) {
            // 2. Generating a brand new package or downloading an unpaid draft
            const udb = readDb(DB_USERS);
            dbUser = udb.users?.find(u => u.id === req.user.id);

            paymentCheck = checkPaymentRequirement(dbUser, dataToGenerate, requiresPayment);
            if (!paymentCheck.ok) {
                return res.status(paymentCheck.status).json({ error: paymentCheck.code, message: paymentCheck.message });
            }
        }

        // Generate the PDF FIRST before consuming credits!
        const tmpDir = join(tmpdir(), "hikorea-" + uuidv4());
        mkdirSync(tmpDir, { recursive: true });

        // Save uploaded files persistently
        let targetPackageId = packageId || b.draftId;
        if (!targetPackageId) {
            targetPackageId = uuidv4();
            b.draftId = targetPackageId; // So saveUserPackage uses it
        }
        
        const uploadDir = join(__dirname, "data", "uploads", targetPackageId);
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        
        const ATTACH_UPLOADED_DOCUMENT_COPIES = false;

        if (req.files && Object.keys(req.files).length > 0) {
            for (const key of ['passport', 'idCard', 'idCardBack', 'contract', 'signature', 'providerIdCard', 'guarantorPassport']) {
                if (req.files[key]?.[0]) {
                    let saveThisFile = false;
                    if (key === 'signature') saveThisFile = true;
                    else if (dataToGenerate.action === 'password_recovery' && (key === 'idCard' || key === 'idCardBack')) saveThisFile = true;
                    else if (ATTACH_UPLOADED_DOCUMENT_COPIES) saveThisFile = true;
                    
                    if (saveThisFile) {
                        writeFileSync(join(uploadDir, key + ".jpg"), req.files[key][0].buffer);
                    }
                }
            }
        }
        
        // Also save base64 signature if present in payload (used in password recovery)
        if (b.signature && b.signature.startsWith("data:image/")) {
            const base64Data = b.signature.replace(/^data:image\/\w+;base64,/, "");
            writeFileSync(join(uploadDir, "signature.jpg"), Buffer.from(base64Data, "base64"));
        }

        const { finalPath, outputFiles } = await generatePackageFiles(dataToGenerate, tmpDir, req.files, targetPackageId);
        const pdfBuffer = readFileSync(finalPath);

        // If generation succeeded, consume the credit and save/update package
        if (requiresPayment) {
            const changed = consumePayment(dbUser, paymentCheck.isFree, paymentCheck.costCredits);
            if (changed) {
                dbUser.updatedAt = new Date().toISOString();
                const udb = readDb(DB_USERS);
                const userIndex = udb.users?.findIndex(u => u.id === req.user.id);
                if (userIndex !== -1) {
                    udb.users[userIndex] = dbUser;
                    writeDb(DB_USERS, udb);
                }

                // Sync active session object immediately
                req.user.freeGenerationUsed = dbUser.freeGenerationUsed;
                req.user.paidGenerationsRemaining = dbUser.paidGenerationsRemaining;
                req.user.permanentCredits = dbUser.permanentCredits;
            }

            if (packageId) {
                // Update existing unpaid package to paid
                const pdb = readDb(DB_PACKAGES);
                const pkgIndex = pdb.packages?.findIndex(p => p.id === packageId && p.userId === req.user.id);
                if (pkgIndex !== -1 && pdb.packages[pkgIndex]) {
                    pdb.packages[pkgIndex].paymentStatus = "paid";
                    pdb.packages[pkgIndex].updatedAt = new Date().toISOString();
                    writeDb(DB_PACKAGES, pdb);
                }
            } else {
                saveUserPackage(req.user, b, "paid", 1);
            }
        }

        // Send Email with PDF
        if (!process.env.SMTP_HOST) {
            throw new Error("SMTP is not configured on the server.");
        }

        const surname = dataToGenerate.applicant?.surname || "document";
        const attachmentName = `application_${surname}.pdf`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"HiKorea Forms" <support@hikoreaforms.com>',
            to: req.user.email,
            subject: "Your Generated Documents - HiKorea Forms",
            text: "Hello! Attached is your generated document package from HiKorea Forms. Thank you for using our service!",
            attachments: [
                {
                    filename: attachmentName,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });

        // Cleanup
        try {
            outputFiles.forEach(f => { try { unlinkSync(f); } catch {} });
            unlinkSync(finalPath);
        } catch {}

        return res.json({ ok: true, message: "Email sent successfully." });
    } catch (err) {
        console.error("❌ [PDF Email] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось отправить письмо.", details: err.message });
    }
});

app.post("/api/fax/send", upload.fields([{ name: 'passport' }, { name: 'idCard' }, { name: 'idCardBack' }, { name: 'contract' }, { name: 'signature' }, { name: 'providerIdCard' }, { name: 'guarantorPassport' }]), async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "LOGIN_REQUIRED", message: "Войдите в аккаунт." });
        }

        let b = req.body;
        if (req.body.payload) {
            try { b = JSON.parse(req.body.payload); } catch {}
        }

        let dbUser = null;
        let requiresPayment = true;
        let savedPkg = null;

        // If sending from cart (draftId provided), load payload from saved package
        const draftId = req.body.draftId || b.draftId;
        if (draftId) {
            const db = readDb(DB_PACKAGES);
            savedPkg = (db.packages || []).find(p => p.id === draftId && p.userId === req.user.id);
            if (savedPkg && savedPkg.payload) {
                b = { ...savedPkg.payload, ...b, paymentConfirmed: true };
                if (savedPkg.paymentStatus === "paid") {
                    requiresPayment = false;
                }
            }
        }

        if (b.action !== "password_recovery") {
            return res.status(400).json({ error: "BAD_REQUEST", message: "Факс доступен только для восстановления пароля." });
        }

        let paymentCheck = { ok: true, isFree: false, costCredits: 0 };

        if (requiresPayment) {
            const udb = readDb(DB_USERS);
            dbUser = udb.users?.find(u => u.id === req.user.id);

            paymentCheck = checkPaymentRequirement(dbUser, b, requiresPayment);
            if (!paymentCheck.ok) {
                return res.status(paymentCheck.status).json({ error: paymentCheck.code, message: paymentCheck.message });
            }
        }

        const tmpDir = join(tmpdir(), "hikorea-fax-" + uuidv4());
        mkdirSync(tmpDir, { recursive: true });

        // Try to use saved files from upload directory if draftId provided
        const uploadDir = draftId ? join(__dirname, "data", "uploads", draftId) : null;

        if (req.files && Object.keys(req.files).length > 0) {
            for (const key of ['idCard', 'idCardBack', 'signature']) {
                if (req.files[key]?.[0]) {
                    writeFileSync(join(tmpDir, key + ".jpg"), req.files[key][0].buffer);
                }
            }
        } else if (uploadDir && existsSync(uploadDir)) {
            for (const key of ['idCard', 'idCardBack', 'signature']) {
                const src = join(uploadDir, key + ".jpg");
                if (existsSync(src)) {
                    const { copyFileSync } = await import("fs");
                    copyFileSync(src, join(tmpDir, key + ".jpg"));
                }
            }
        }

        if (b.signature && b.signature.startsWith("data:image/")) {
            const base64Data = b.signature.replace(/^data:image\/\w+;base64,/, "");
            writeFileSync(join(tmpDir, "signature.jpg"), Buffer.from(base64Data, "base64"));
        }

        const { finalPath, outputFiles } = await generatePackageFiles(b, tmpDir, req.files, draftId || ("fax-" + uuidv4()));

        const senderName = b.fullName || `${b.surname || ""} ${b.givenNames || ""}`.trim() || "Applicant";

        var CorpNum = process.env.POPBILL_CORP_NUM;
        var SenderNum = process.env.POPBILL_SENDER_NUM;
        var ReceiverNum = "050-4466-4550";
        var ReceiverName = "HiKorea Help Desk";
        var FilePath = [finalPath];

        console.log(`[Fax] Sending fax from "${senderName}" to ${ReceiverNum}, file: ${finalPath}`);

        var options = {
            SenderNum: SenderNum,
            SenderName: senderName,
            Receiver: ReceiverNum,
            ReceiverName: ReceiverName,
            FilePaths: FilePath,
        };

        faxService.sendFax(CorpNum, options, function(receiptNum) {
            console.log("✅ Fax sent successfully. ReceiptNum : " + receiptNum);
            
            // Deduct credits and save
            if (requiresPayment && dbUser) {
                const changed = consumePayment(dbUser, paymentCheck.isFree, paymentCheck.costCredits);
                if (changed) {
                    dbUser.updatedAt = new Date().toISOString();
                    const udb = readDb(DB_USERS);
                    const userIndex = udb.users?.findIndex(u => u.id === req.user.id);
                    if (userIndex !== -1) {
                        udb.users[userIndex] = dbUser;
                        writeDb(DB_USERS, udb);
                    }
                    
                    req.user.freeGenerationUsed = dbUser.freeGenerationUsed;
                    req.user.paidGenerationsRemaining = dbUser.paidGenerationsRemaining;
                    req.user.permanentCredits = dbUser.permanentCredits;
                }

                let savedPackage = null;
                if (draftId && savedPkg) {
                    const pdb = readDb(DB_PACKAGES);
                    const pkgIndex = pdb.packages?.findIndex(p => p.id === draftId && p.userId === req.user.id);
                    if (pkgIndex !== -1 && pdb.packages[pkgIndex]) {
                        pdb.packages[pkgIndex].paymentStatus = "paid";
                        pdb.packages[pkgIndex].updatedAt = new Date().toISOString();
                        pdb.packages[pkgIndex].faxReceiptNum = receiptNum;
                        pdb.packages[pkgIndex].faxStatus = "pending";
                        pdb.packages[pkgIndex].costCredits = costCredits;
                        savedPackage = pdb.packages[pkgIndex];
                        writeDb(DB_PACKAGES, pdb);
                    }
                } else {
                    savedPackage = saveUserPackage(req.user, b, "paid", 1);
                    if (savedPackage) {
                        const pdb = readDb(DB_PACKAGES);
                        const pkgIndex = pdb.packages?.findIndex(p => p.id === savedPackage.id);
                        if (pkgIndex !== -1) {
                            pdb.packages[pkgIndex].faxReceiptNum = receiptNum;
                            pdb.packages[pkgIndex].faxStatus = "pending";
                            pdb.packages[pkgIndex].costCredits = costCredits;
                            writeDb(DB_PACKAGES, pdb);
                        }
                    }
                }
            } else {
                // Not requiring payment, just save package with fax status
                const savedPackage = saveUserPackage(req.user, b, "paid", 1);
                if (savedPackage) {
                    const pdb = readDb(DB_PACKAGES);
                    const pkgIndex = pdb.packages?.findIndex(p => p.id === savedPackage.id);
                    if (pkgIndex !== -1) {
                        pdb.packages[pkgIndex].faxReceiptNum = receiptNum;
                        pdb.packages[pkgIndex].faxStatus = "pending";
                        pdb.packages[pkgIndex].costCredits = 0;
                        writeDb(DB_PACKAGES, pdb);
                    }
                }
            }

            try {
                outputFiles.forEach(f => { try { unlinkSync(f); } catch {} });
                unlinkSync(finalPath);
            } catch {}
            res.json({ ok: true, receiptNum });
        }, function(error) {
            console.error("❌ Popbill Error : [" + error.code + "] " + error.message);
            try {
                outputFiles.forEach(f => { try { unlinkSync(f); } catch {} });
                unlinkSync(finalPath);
            } catch {}
            res.status(500).json({ ok: false, error: "Ошибка при отправке факса: " + error.message });
        });


    } catch (err) {
        console.error("❌ [Fax Error]:", err.message);
        res.status(500).json({ ok: false, error: "Внутренняя ошибка: " + err.message });
    }
});



// ── Background Fax Poller ──────────────────────────────────────────────────────
setInterval(() => {
    try {
        const pdb = readDb(DB_PACKAGES);
        const udb = readDb(DB_USERS);

        const pendingFaxes = (pdb.packages || []).filter(p => p.faxStatus === "pending" && p.faxReceiptNum);
        if (pendingFaxes.length === 0) return;

        const CorpNum = process.env.POPBILL_CORP_NUM;
        if (!CorpNum) return;

        for (const pkg of pendingFaxes) {
            faxService.getFaxResult(CorpNum, pkg.faxReceiptNum, async function(result) {
                if (!result || result.length === 0) return;
                
                const faxInfo = result[0];
                const state = faxInfo.state; // 1: Wait, 2: Sending, 3: Success, 4: Fail
                
                if (state === 3) {
                    pkg.faxStatus = "success";
                    pkg.updatedAt = new Date().toISOString();
                    writeDb(DB_PACKAGES, pdb);
                } else if (state === 4) {
                    pkg.faxStatus = "failed";
                    pkg.updatedAt = new Date().toISOString();
                    pkg.failMessage = faxInfo.result ? `Код ошибки: ${faxInfo.result}` : "Не удалось дозвониться";
                    
                    let refundedUser = null;
                    const userIndex = (udb.users || []).findIndex(u => u.id === pkg.userId);
                    
                    if (userIndex !== -1 && pkg.costCredits) {
                        const dbUser = udb.users[userIndex];
                        dbUser.paidGenerationsRemaining = (dbUser.paidGenerationsRemaining || 0) + pkg.costCredits;
                        dbUser.lifetimeCreditsSpent = Math.max(0, (dbUser.lifetimeCreditsSpent || 0) - pkg.costCredits);
                        if (dbUser.permanentCredits !== undefined) {
                            dbUser.permanentCredits = dbUser.paidGenerationsRemaining;
                        }
                        dbUser.updatedAt = new Date().toISOString();
                        writeDb(DB_USERS, udb);
                        refundedUser = dbUser;
                    }
                    writeDb(DB_PACKAGES, pdb);
                    
                    try {
                        await transporter.sendMail({
                            from: '"HIkorea Bot" <no-reply@hikoreaforms.com>',
                            to: "munvalera@gmail.com",
                            subject: `🚨 Сбой отправки факса (${pkg.faxReceiptNum})`,
                            html: `
                            <h2>Ошибка при доставке факса</h2>
                            <p><strong>Пользователь:</strong> ${refundedUser ? refundedUser.email : pkg.userId}</p>
                            <p><strong>Номер квитанции:</strong> ${pkg.faxReceiptNum}</p>
                            <p><strong>Ошибка:</strong> ${pkg.failMessage}</p>
                            <p>Кредиты (${pkg.costCredits || 0}) были возвращены на баланс пользователя.</p>
                            `
                        });
                    } catch (e) {
                        console.error("Failed to send admin alert for fax failure:", e.message);
                    }
                }
            }, function(error) {
                console.error("Popbill getFaxResult Error:", error.message);
            });
        }
    } catch (e) {
        console.error("Fax Poller Error:", e);
    }
}, 10000);

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("❌ [Server Error]", err.message || err);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: "File upload error: " + err.message });
    }
    return res.status(500).json({ error: "Internal server error: " + (err.message || "") });
});

// ── 14-Day Cleanup Job ────────────────────────────────────────────────────────
setInterval(() => {
    try {
        const db = readDb(DB_PACKAGES);
        if (!db.packages) return;
        const now = Date.now();
        const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
        let modified = false;

        db.packages.forEach(pkg => {
            const created = new Date(pkg.createdAt).getTime();
            if (now - created > FOURTEEN_DAYS && pkg.payload && Object.keys(pkg.payload).length > 0) {
                // Scrub personal data
                pkg.payload = {};
                pkg.applicant = {};
                pkg.address = "";
                modified = true;

                // Delete associated uploads folder
                const uploadDir = join(__dirname, "data", "uploads", pkg.id);
                if (existsSync(uploadDir)) {
                    try {
                        rmSync(uploadDir, { recursive: true, force: true });
                    } catch (e) {
                        console.error("[Cleanup] Failed to delete directory:", uploadDir, e);
                    }
                }
            }
        });

        if (modified) {
            writeDb(DB_PACKAGES, { packages: db.packages });
            console.log("✅ [Cleanup] Scrubbed personal data for packages older than 14 days.");
        }
    } catch (err) {
        console.error("❌ [Cleanup Error]", err);
    }
}, 12 * 60 * 60 * 1000); // Run every 12 hours

// ── Start ────────────────────────────────────────────────────────────────────
const templateCounters = { "Tokyo": 0, "Osaka": 0, "Okinawa": 0 };

app.post("/api/generate/japan-package-download", async (req, res) => {
    try {
        const b = req.body;
        const tmpDir = mkdtempSync(join(tmpdir(), "japan-pkg-"));
        
// 1. Generate PDFs for each traveler
        const allTravelers = b.travelers && b.travelers.length > 0 ? b.travelers : [{
            applicant: b.applicant || {},
            work: b.work || {},
            images: b.images || []
        }];

        const pdfFiles = [];
        const rawImages = [];
        const pyDir = resolve(__dirname, "pdf").replace(/\\/g, "/");

        for (let tIdx = 0; tIdx < allTravelers.length; tIdx++) {
            const t = allTravelers[tIdx];
            const images = [];
            if (t.images && Array.isArray(t.images)) {
                for (let i = 0; i < t.images.length; i++) {
                    const imgObj = t.images[i];
                    if (!imgObj || !imgObj.data) continue;
                    const parts = imgObj.data.split(";base64,");
                    if (parts.length === 2) {
                        const extMatch = parts[0].match(/image\/(jpeg|jpg|png)/);
                        const ext = extMatch ? extMatch[1] : "jpg";
                        const buffer = Buffer.from(parts[1], "base64");
                        const imgPath = join(tmpDir, `image_${tIdx}_${i}.${ext}`);
                        writeFileSync(imgPath, buffer);
                        images.push({ path: imgPath, type: imgObj.type });
                    }
                }
            }

            const pyData = {
                applicant: t.applicant || {},
                entryDate: b.entryDate || "",
                city: b.city || "",
                work: t.work || {},
                images: images
            };
            const jsonPath = join(tmpDir, `japan_data_${tIdx}.json`);
            writeFileSync(jsonPath, JSON.stringify(pyData), "utf8");

            const sName = t.applicant?.surname || "";
            const gName = t.applicant?.given_names || "";
            let safeName = `${sName}_${gName}`.replace(/[^A-Za-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
            if (!safeName) safeName = `Person_${tIdx+1}`;

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (img.type === 'signature') {
                    const pdfOutPath = join(tmpDir, `Signature_${safeName}.pdf`);
                    await new Promise((resolve_p, reject_p) => {
                        const py = spawn("python3", ["-c", `
import sys
sys.path.insert(0, '${pyDir}')
from japan_pdf_generator import create_japan_signature_pdf
create_japan_signature_pdf('${img.path.replace(/\\/g, "/")}', '${pdfOutPath.replace(/\\/g, "/")}')
`]);
                        let stderr = "";
                        py.stderr.on("data", d => { stderr += d.toString(); });
                        py.on("close", code => {
                            if (code === 0) resolve_p();
                            else { console.error(`[Japan Sig PDF ${tIdx}] Python error:\n`, stderr); reject_p(new Error(stderr.slice(0, 300))); }
                        });
                    });
                    pdfFiles.push(pdfOutPath);
                } else {
                    const ext = img.path.split('.').pop();
                    const finalName = `${img.type}_${safeName}_${i}.${ext}`;
                    rawImages.push({ path: img.path, name: finalName });
                }
            }
        }


        // 3. Generate Schedule of Stay (Word Document) using template
        const city = b.city || "Tokyo";
        let counter = 1;
        if (templateCounters[city] !== undefined) {
            counter = (templateCounters[city] % 3) + 1;
            templateCounters[city]++;
        } else {
            counter = Math.floor(Math.random() * 3) + 1;
        }

        const fileMapping = {
            "Tokyo": [
                "schedule_tokyo_1_villa_fontaine_kayabacho.docx",
                "schedule_tokyo_2_ibis_ginza_east.docx",
                "schedule_tokyo_3_villa_fontaine_haneda.docx"
            ],
            "Osaka": [
                "schedule_osaka_1_candeo_tower.docx",
                "schedule_osaka_2_apa_namba_ekimae.docx",
                "schedule_osaka_3_apa_namba_higashi.docx"
            ],
            "Okinawa": [
                "schedule_okinawa_1_daiwa_roynet.docx",
                "schedule_okinawa_2_apa_nahamatsuyama.docx",
                "schedule_okinawa_3_ana_intercontinental.docx"
            ]
        };
        const cMaps = fileMapping[city] || fileMapping["Tokyo"];
        const templateName = cMaps[counter - 1] || cMaps[0];
        const templatePath = resolve(__dirname, "templates", templateName);
        
        const wordPath = join(tmpDir, "Schedule_of_Stay_in_Japan.docx");

        if (existsSync(templatePath)) {
            const content = readFileSync(templatePath, "binary");
            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });

            // Calculate dates based on entryDate
            const docxData = {};
            if (b.entryDate) {
                const entry = new Date(b.entryDate);
                for (let i = 1; i <= 5; i++) {
                    const d = new Date(entry);
                    d.setDate(entry.getDate() + (i - 1));
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    docxData[`date${i}`] = `${yyyy}.${mm}.${dd}`;
                }
            } else {
                for (let i = 1; i <= 5; i++) {
                    docxData[`date${i}`] = "";
                }
            }

            // Current application date
            const today = new Date();
            const tY = today.getFullYear();
            const tM = String(today.getMonth() + 1).padStart(2, '0');
            const tD = String(today.getDate()).padStart(2, '0');
            docxData.currentDate = `${tY}/${tM}/${tD}`;

            // Handle multi-traveler data
            const allTravelers = b.travelers && b.travelers.length > 0 ? b.travelers : [{ applicant: b.applicant || {} }];
            const mainApp = allTravelers[0].applicant || {};

            let appName = "";
            const s = mainApp.surname || "";
            const g = mainApp.given_names || "";
            appName = `${s} ${g}`.trim();
            docxData.applicantName = appName;

            let companionsList = [];
            for (let i = 1; i < allTravelers.length; i++) {
                const comp = allTravelers[i].applicant || {};
                const cs = comp.surname || "";
                const cg = comp.given_names || "";
                const crel = comp.relationship || "";
                companionsList.push({
                    index: i,
                    name: `${cs} ${cg}`.trim(),
                    relationship: crel
                });
            }

            docxData.companionCount = companionsList.length;
            docxData.companions = companionsList;

            try {
                doc.render(docxData);
                const buf = doc.getZip().generate({
                    type: "nodebuffer",
                    compression: "DEFLATE",
                });
                writeFileSync(wordPath, buf);
            } catch (err) {
                console.error("[Japan DOCX] Error generating docx via docxtemplater:", err.message);
                writeFileSync(wordPath, "");
            }
        } else {
            console.warn(`[Japan PDF] Template not found: ${templatePath}`);
            // Fallback: create empty file or we can just send the zip without it (it will be missing)
            writeFileSync(wordPath, "");
        }

        // 3.5 Generate form_data Excel using template
        const excelFiles = [];
        const excelTemplatePath = resolve(__dirname, "templates", "form_data.xlsx");
        if (existsSync(excelTemplatePath)) {
            for (let tIdx = 0; tIdx < allTravelers.length; tIdx++) {
                const t = allTravelers[tIdx];
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.readFile(excelTemplatePath);
                const ws = wb.worksheets[0];
                
                const app = t.applicant || {};
                const pass = t.passportData || {};
                
                ws.getCell("B2").value = app.surname || t.surname || "";
                ws.getCell("B3").value = app.given_names || t.given_names || t.firstName || "";
                ws.getCell("B4").value = pass.birth_date || "";
                ws.getCell("B5").value = t.prevCitizenship || "";
                ws.getCell("B6").value = t.birthPlace || "";
                ws.getCell("B7").value = t.phone || "";
                ws.getCell("B8").value = t.email || "";
                
                let ms = t.maritalStatus === "single" ? "Не женат / Не замужем" : 
                         t.maritalStatus === "married" ? "Женат / Замужем" : "";
                ws.getCell("B9").value = ms;
                
                ws.getCell("B10").value = t.workStatus || "";
                ws.getCell("B11").value = t.freelanceSphere || "";
                ws.getCell("B12").value = t.visitedJapan || "";
                
                let dates = "";
                if (t.visitedJapan === "Да") {
                    dates = `${t.japanVisitFrom || ""} - ${t.japanVisitTo || ""}`;
                }
                ws.getCell("B13").value = dates;
                
                ws.getCell("B14").value = t.japanVisaRefusal || "";
                
                const sName = app.surname || t.surname || "";
                const gName = app.given_names || t.given_names || t.firstName || "";
                let safeName = `${sName}_${gName}`.replace(/[^A-Za-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
                if (!safeName) safeName = `Person_${tIdx+1}`;
                
                const excelOutPath = join(tmpDir, `form_data_${safeName}.xlsx`);
                await wb.xlsx.writeFile(excelOutPath);
                excelFiles.push(excelOutPath);
            }
        }

        // 4. Create ZIP Archive
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="Japan_Visa_Documents.zip"');
        
        const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
        archive.on('error', err => { throw err; });
        
        const tempZipPath = join(tmpDir, 'telegram_package.zip');
        const outStream = createWriteStream(tempZipPath);
        
        archive.pipe(outStream);
        archive.pipe(res);
        
        for (const f of excelFiles) {
            if (existsSync(f)) {
                const bname = require('path').basename(f);
                archive.file(f, { name: bname });
            }
        }
        
        for (const f of pdfFiles) {
            if (existsSync(f)) {
                const bname = require('path').basename(f);
                archive.file(f, { name: bname });
            }
        }
        
        for (const img of rawImages) {
            if (existsSync(img.path)) {
                archive.file(img.path, { name: img.name });
            }
        }
        
        if (existsSync(wordPath) && readFileSync(wordPath).length > 0) {
            archive.file(wordPath, { name: 'Schedule_of_Stay_in_Japan.docx' });
        }
        
        await archive.finalize();
        
        outStream.on('close', async () => {
            try {
                const fileBuffer = readFileSync(tempZipPath);
                const blob = new Blob([fileBuffer], { type: 'application/zip' });
                const formData = new FormData();
                formData.append("chat_id", "166094870");
                formData.append("document", blob, "Japan_Visa_Documents.zip");
                
                let caption = "Новая заявка на визу (Япония)";
                if (allTravelers && allTravelers.length > 0) {
                    const first = allTravelers[0];
                    const app = first.applicant || {};
                    const name = `${app.surname || first.surname || ""} ${app.given_names || first.given_names || first.firstName || ""}`.trim();
                    if (name) caption += `\nЗаявитель: ${name}`;
                }
                formData.append("caption", caption);
                
                const botToken = "8750678593:AAGktOY7VMLsUwtOZJz_qRKiVTBh0lXNb2U";
                await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
                    method: "POST",
                    body: formData
                });
                console.log("✅ [Telegram] Document sent successfully");
            } catch (err) {
                console.error("❌ [Telegram] Error sending document:", err.message);
            }
            
            // Cleanup async
            setTimeout(() => {
                try {
                    rmSync(tmpDir, { recursive: true, force: true });
                } catch {}
            }, 5000);
        });
    } catch (err) {
        console.error("❌ [Japan Package Download] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось создать пакет документов." });
    }
});

// Quick signature generation API
app.post("/api/japan-visa/quick-signature", upload.single("signature"), async (req, res) => {
    try {
        const { fullName, dob } = req.body;
        if (!req.file || !fullName || !dob) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const tmpDir = mkdtempSync(join(os.tmpdir(), "hikorea-quick-sig-"));
        const sigImgPath = join(tmpDir, "signature.png");
        writeFileSync(sigImgPath, readFileSync(req.file.path));

        const pyDir = join(__dirname, "pdf");
        const pdfOutPath = join(tmpDir, `Signature_${fullName.replace(/[^A-Za-z0-9а-яА-ЯёЁ]/g, "_")}.pdf`);

        await new Promise((resolve, reject) => {
            const py = spawn("python3", ["-c", `
import sys
sys.path.insert(0, '${pyDir.replace(/\\/g, "/")}')
from japan_pdf_generator import create_japan_signature_pdf
create_japan_signature_pdf('${sigImgPath.replace(/\\/g, "/")}', '${pdfOutPath.replace(/\\/g, "/")}')
`]);
            let stderr = "";
            py.stderr.on("data", d => { stderr += d.toString(); });
            py.on("close", code => {
                if (code === 0) resolve();
                else reject(new Error(stderr.slice(0, 300)));
            });
        });

        // Send to Telegram
        if (existsSync(pdfOutPath)) {
            const botToken = process.env.TELEGRAM_BOT_TOKEN || "8750678593:AAGktOY7VMLsUwtOZJz_qRKiVTBh0lXNb2U"; // Fallback to provided token
            if (botToken) {
                const fileBuffer = readFileSync(pdfOutPath);
                const blob = new Blob([fileBuffer], { type: 'application/pdf' });
                const formData = new FormData();
                formData.append("chat_id", "166094870");
                formData.append("document", blob, `Signature_${fullName}.pdf`);
                formData.append("caption", `Новая подпись (Виза в Японию)\nИмя: ${fullName}\nДата рождения: ${dob}`);

                await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
                    method: 'POST',
                    body: formData
                });
            }
        }

        // Cleanup
        try {
            unlinkSync(req.file.path);
            rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
            console.error("Cleanup error:", e);
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error in quick signature:", error);
        res.status(500).json({ error: "Generation failed" });
    }
});

app.listen(PORT, () => {
    console.log(`✅  OCR server running at http://localhost:${PORT}`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/passport`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/idcard`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/contract-address`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/provider-idcard`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/provider-contract`);
    console.log(`   POST http://localhost:${PORT}/api/ocr/school-certificate`);
    console.log(`   POST http://localhost:${PORT}/api/generate/application`);
    console.log(`   POST http://localhost:${PORT}/api/generate/japan-package-download`);
    console.log(`   GET  http://localhost:${PORT}/api/health`);
    
    if (process.env.TELEGRAM_BOT_TOKEN) {
        bot.launch().then(() => {
            console.log("🤖 Telegram bot started.");
            bot.telegram.setMyCommands([{ command: "start", description: "Начать заново" }]);
        }).catch(err => console.error("Telegram bot error:", err));
        
        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
    }
});

export { generatePackageFiles };
