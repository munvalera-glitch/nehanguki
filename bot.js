import "dotenv/config";
import { Telegraf, session, Markup } from "telegraf";
import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generatePackageFiles } from "./server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Environment ─────────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN is not set in .env. Bot will not start.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ── Helper: Extract JSON from Gemini response ──────────────────────────────
function extractJsonFromText(text) {
    let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    } else {
        throw new Error("No JSON object found in text");
    }
    return JSON.parse(cleaned);
}

// ── Gemini OCR Helpers ──────────────────────────────────────────────────────
const PASSPORT_PROMPT = `
You are a passport data extraction assistant. Return ONLY valid JSON object.
JSON schema:
{
  "surname": "string",
  "given_names": "string",
  "full_name": "string",
  "nationality": "string",
  "passport_number": "string",
  "birth_date": "string",
  "sex": "string",
  "issue_date": "string",
  "expiry_date": "string"
}
`.trim();

const IDCARD_PASSWORD_RECOVERY_PROMPT = `
You are a Korean alien registration card (외국인등록증) data extraction assistant. Return ONLY valid JSON object.
JSON schema:
{
  "registration_number": "string",
  "full_name": "string",
  "surname": "string",
  "given_names": "string",
  "nationality": "string"
}
`.trim();

const IDCARD_BACK_PASSWORD_RECOVERY_PROMPT = `
You are a Korean alien registration card (외국인등록증) data extraction assistant. Return ONLY valid JSON object.
Extract only the current Korean address from the back side of the ID-card (the lowest entry).
JSON schema:
{
  "address": "string"
}
`.trim();

const CONTRACT_ADDRESS_PROMPT = `
You are a Korean lease contract (임대차계약서) data extraction assistant. Return ONLY valid JSON object.
Extract the residential address (소재지 / 주소) from the image.
JSON schema:
{
  "address": "string"
}
`.trim();

async function callGemini(mimetype, base64Data, promptText) {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [
            { inlineData: { mimeType: mimetype, data: base64Data } },
            { text: promptText },
        ]}],
        config: { temperature: 0, responseMimeType: "application/json" },
    });
    return extractJsonFromText(response.text ?? "");
}

// ── Telegraf Bot Setup ──────────────────────────────────────────────────────
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
bot.use(session());

const initSession = (ctx) => {
    ctx.session = {
        step: "visa",
        expectedTasks: 0,
        finishedTasks: 0,
        editingField: null,
        data: {
            visaType: "",
            action: "",
            surname: "",
            givenNames: "",
            birthDate: "",
            sex: "",
            nationality: "",
            idNumber: "",
            passportNumber: "",
            passportIssueDate: "",
            passportExpiryDate: "",
            address: "",
            phone: "",
            login: "",
            photos: {}
        }
    };
};

const sendStartMenu = async (ctx) => {
    initSession(ctx);
    // Send persistent keyboard first (or together)
    await ctx.reply("Меню обновлено:", Markup.keyboard([
        ["🔄 Начать заново"]
    ]).resize());

    await ctx.reply(
        "👋 Здравствуйте! Добро пожаловать в бот оформления документов.\nПожалуйста, выберите ваш тип визы:",
        Markup.inlineKeyboard([
            [Markup.button.callback("F-4", "VISA_F4")],
            [Markup.button.callback("F-1 / F-3 / F-6", "VISA_F1")],
            [Markup.button.callback("Другие визы", "VISA_OTHER")]
        ])
    );
};

bot.command("start", sendStartMenu);
bot.hears("🔄 Начать заново", sendStartMenu);

bot.action(/VISA_(.+)/, async (ctx) => {
    if (!ctx.session) initSession(ctx);
    ctx.session.data.visaType = ctx.match[1];
    ctx.session.step = "action";
    
    await ctx.editMessageText(
        `Выбрана виза: ${ctx.match[1]}\nТеперь выберите тип заявления:`,
        Markup.inlineKeyboard([
            [Markup.button.callback("Восстановление пароля HiKorea", "ACTION_password_recovery")],
            [Markup.button.callback("Смена адреса", "ACTION_address_change")],
            [Markup.button.callback("Первичное получение ID", "ACTION_initial")],
            [Markup.button.callback("Продление визы", "ACTION_extension")],
            [Markup.button.callback("Перевыпуск ID", "ACTION_reissue")]
        ])
    );
});

bot.action(/ACTION_(.+)/, async (ctx) => {
    if (!ctx.session) initSession(ctx);
    const action = ctx.match[1];
    ctx.session.data.action = action;
    
    await ctx.answerCbQuery();

    if (action === "password_recovery") {
        ctx.session.step = "ask_id_front";
        await ctx.reply("Пожалуйста, загрузите фотографию лицевой стороны вашей ID-карты (айдишки).");
    } else {
        ctx.session.step = "ask_passport";
        await ctx.reply("Пожалуйста, загрузите фотографию разворота вашего паспорта.");
    }
});

bot.on("photo", async (ctx) => {
    if (!ctx.session || !ctx.session.step) return;

    const step = ctx.session.step;
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    const fileUrl = await ctx.telegram.getFileLink(fileId);

    const processingMsg = await ctx.reply("⌛ Обрабатываю фото...");

    try {
        const res = await fetch(fileUrl);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString("base64");
        
        let prompt = "";
        let fieldMap = {};
        
        if (step === "ask_passport") {
            prompt = PASSPORT_PROMPT;
            fieldMap = { surname: "surname", givenNames: "given_names", birthDate: "birth_date", sex: "sex", nationality: "nationality", passportNumber: "passport_number", passportIssueDate: "issue_date", passportExpiryDate: "expiry_date" };
        } else if (step === "ask_id_front") {
            prompt = IDCARD_PASSWORD_RECOVERY_PROMPT;
            fieldMap = { surname: "surname", givenNames: "given_names", idNumber: "registration_number", nationality: "nationality" };
        } else if (step === "ask_id_back") {
            prompt = IDCARD_BACK_PASSWORD_RECOVERY_PROMPT;
            fieldMap = { address: "address" };
        } else if (step === "ask_contract") {
            prompt = CONTRACT_ADDRESS_PROMPT;
            fieldMap = { address: "address" };
        }

        if (prompt) {
            const data = await callGemini("image/jpeg", base64Image, prompt);
            for (const [stateKey, jsonKey] of Object.entries(fieldMap)) {
                if (data[jsonKey]) ctx.session.data[stateKey] = data[jsonKey];
            }
        }
    } catch (err) {
        console.error("OCR Error:", err);
    }

    try { await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id); } catch (e) {}

    // Advance state immediately
    if (step === "ask_passport") {
        if (ctx.session.data.action === "initial") {
            ctx.session.step = "ask_contract";
            await ctx.reply("Принято! Теперь загрузите фотографию договора аренды жилья.");
        } else {
            ctx.session.step = "ask_id_front";
            await ctx.reply("Принято! Теперь загрузите фотографию лицевой стороны ID-карты.");
        }
    } 
    else if (step === "ask_id_front") {
        if (ctx.session.data.action === "password_recovery") {
            ctx.session.step = "ask_id_back";
            await ctx.reply("Принято! Теперь загрузите фотографию обратной стороны ID-карты (где указан адрес).");
        } else {
            ctx.session.step = "ask_contract";
            await ctx.reply("Принято! Теперь загрузите фотографию договора аренды жилья.");
        }
    }
    else if (step === "ask_id_back") {
        ctx.session.step = "ask_phone";
        await ctx.reply("Принято! Напишите ваш номер телефона.");
    }
    else if (step === "ask_contract") {
        ctx.session.step = "ask_phone";
        await ctx.reply("Принято! Напишите ваш номер телефона.");
    }
});

bot.on("text", async (ctx) => {
    if (!ctx.session || !ctx.session.step) return;

    const text = ctx.message.text.trim();
    const step = ctx.session.step;

    if (step === "ask_phone") {
        ctx.session.data.phone = text;
        if (ctx.session.data.action === "password_recovery") {
            ctx.session.step = "ask_login";
            await ctx.reply("Принято. Напишите ваш логин на HiKorea (если не помните, напишите 'не помню').");
        } else {
            ctx.session.step = "review_data";
            await sendReviewMessage(ctx);
        }
    }
    else if (step === "ask_login") {
        ctx.session.data.login = text;
        ctx.session.step = "review_data";
        await sendReviewMessage(ctx);
    }
    else if (step === "editing_field" && ctx.session.editingField) {
        ctx.session.data[ctx.session.editingField] = text;
        ctx.session.editingField = null;
        ctx.session.step = "review_data";
        await sendReviewMessage(ctx);
    }
});

async function sendReviewMessage(ctx) {
    const d = ctx.session.data;
    
    let info = "📄 **Пожалуйста, проверьте ваши данные:**\n\n";
    info += `• Фамилия: ${d.surname || "Не найдено"}\n`;
    info += `• Имя: ${d.givenNames || "Не найдено"}\n`;
    info += `• Номер паспорта: ${d.passportNumber || "Не найдено"}\n`;
    info += `• Дата рождения: ${d.birthDate || "Не найдено"}\n`;
    info += `• Пол: ${d.sex || "Не найдено"}\n`;
    info += `• Гражданство: ${d.nationality || "Не найдено"}\n`;
    info += `• Номер ID: ${d.idNumber || "Не найдено"}\n`;
    info += `• Адрес: ${d.address || "Не найдено"}\n`;
    info += `• Телефон: ${d.phone || "Не найдено"}\n`;

    if (d.login) info += `• Логин HiKorea: ${d.login || "Не найдено"}\n`;

    info += "\nЕсли вы заметили ошибку распознавания, нажмите на кнопку ниже для исправления.";

    await ctx.reply(info, Markup.inlineKeyboard([
        [Markup.button.callback("✏️ Изменить Фамилию", "EDIT_surname"), Markup.button.callback("✏️ Изменить Имя", "EDIT_givenNames")],
        [Markup.button.callback("✏️ Изменить Номер паспорта", "EDIT_passportNumber"), Markup.button.callback("✏️ Изменить Дату рождения", "EDIT_birthDate")],
        [Markup.button.callback("✏️ Изменить Номер ID", "EDIT_idNumber"), Markup.button.callback("✏️ Изменить Пол", "EDIT_sex")],
        [Markup.button.callback("✏️ Изменить Адрес", "EDIT_address"), Markup.button.callback("✏️ Изменить Гражданство", "EDIT_nationality")],
        [Markup.button.callback("✏️ Изменить Телефон", "EDIT_phone")],
        [Markup.button.callback("✅ Все верно! Сгенерировать PDF", "GENERATE_PDF")],
        [Markup.button.callback("🔄 Начать заново", "RESTART")]
    ]));
}

bot.action(/EDIT_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.editingField = ctx.match[1];
    ctx.session.step = "editing_field";
    
    // Convert field key to Russian for prompt
    const fieldNames = {
        surname: "Фамилию",
        givenNames: "Имя (Given Names)",
        passportNumber: "Номер паспорта",
        birthDate: "Дату рождения (в формате YYYY-MM-DD)",
        sex: "Пол (M/F)",
        nationality: "Гражданство (на англ.)",
        idNumber: "Номер ID (формат 123456-1234567)",
        address: "Адрес",
        phone: "Номер телефона"
    };

    await ctx.editMessageText(`Введите правильное значение для поля: **${fieldNames[ctx.session.editingField] || ctx.session.editingField}**`);
});

bot.action("RESTART", async (ctx) => {
    initSession(ctx);
    await ctx.editMessageText("Мы начали заново. Используйте команду /start чтобы выбрать тип визы.");
});

bot.action("GENERATE_PDF", async (ctx) => {
    await ctx.editMessageText("⏳ Генерирую PDF документы, подождите...");
    
    const d = ctx.session.data;
    
    const payload = {
        visaType: d.visaType === "VISA_F4" ? "F4" : (d.visaType === "VISA_F1" ? "F1" : "other"),
        action: d.action,
        housingType: d.address && !d.address.includes("не указан") ? "other" : "own",
        surname: d.surname,
        givenNames: d.givenNames,
        birthDate: d.birthDate,
        sex: d.sex,
        nationality: d.nationality,
        idNumber: d.idNumber,
        passportNumber: d.passportNumber,
        passportIssueDate: d.passportIssueDate,
        passportExpiryDate: d.passportExpiryDate,
        address: d.address,
        phone: d.phone,
        isStudent: false,
    };

    try {
        const tmpDir = mkdtempSync(join(tmpdir(), "bot-pkg-"));
        const { finalPath, outputFiles } = await generatePackageFiles(payload, tmpDir);
        
        const pdfBuffer = readFileSync(finalPath);
        
        await ctx.replyWithDocument({ source: pdfBuffer, filename: "HiKorea_Application.pdf" }, {
            caption: "✅ Ваши документы готовы! Вы можете скачать PDF файл."
        });

        // Cleanup
        try {
            outputFiles.forEach(f => { try { unlinkSync(f); } catch {} });
            unlinkSync(finalPath);
        } catch {}

    } catch (e) {
        console.error("PDF Gen error:", e);
        await ctx.reply("❌ Произошла ошибка при генерации PDF. Пожалуйста, попробуйте еще раз.");
    }
});

export { bot };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    bot.launch().then(() => console.log("Bot is running..."));
}
