import "dotenv/config";
import { Telegraf, session, Markup } from "telegraf";
import { GoogleGenAI } from "@google/genai";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generatePackageFiles } from "./server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN is not set in .env. Bot will not start.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

// ── Gemini OCR Prompts ──────────────────────────────────────────────────────
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

const SCHOOL_CERTIFICATE_PROMPT = `
You are a Korean school certificate data extraction assistant. Extract the school name (학교명).
Return ONLY valid JSON object.
JSON schema:
{
  "school_name": "string"
}
`.trim();

const GUARANTOR_PASSPORT_PROMPT = `
You are a passport data extraction assistant for a Guarantor (신원보증인). Return ONLY valid JSON object.
JSON schema:
{
  "full_name": "string",
  "nationality": "string"
}
`.trim();

const PROVIDER_IDCARD_PROMPT = `
You are a Korean alien registration card data extraction assistant for an Accommodation Provider (유숙자).
Return ONLY valid JSON object.
JSON schema:
{
  "full_name": "string",
  "registration_number": "string",
  "nationality": "string"
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

// ── State Machine Logic ─────────────────────────────────────────────────────
function calculateAge(birthDate) {
    if (!birthDate) return 0;
    const parts = birthDate.split('-');
    if (parts.length !== 3) return 0;
    const dob = new Date(parts[0], parts[1] - 1, parts[2]);
    const diff = Date.now() - dob.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function getSequence(d) {
    let sequence = ["visa", "action"];
    if (!d.visaType || !d.action) return sequence;

    if (d.action === "initial" || d.action === "address_change" || d.action === "extension") {
        sequence.push("housing");
    }

    if (d.action !== "password_recovery") sequence.push("ask_passport");
    sequence.push("ask_id_front");
    
    if (d.action === "password_recovery") {
        sequence.push("ask_id_back");
    }

    sequence.push("ask_student");
    if (d.isStudent === true) {
        sequence.push("ask_school_cert");
    }

    if (d.visaType === "VISA_F1" && d.action !== "address_change" && d.action !== "reissue") {
        sequence.push("ask_guarantor_passport");
    }

    if (d.action !== "password_recovery") {
        sequence.push("ask_contract");
    }

    if (d.action !== "password_recovery" && d.housingType === "other" && d.action !== "reissue" && d.action !== "address_change") {
        sequence.push("ask_provider_id");
    }

    if (d.action !== "password_recovery" && d.housingType === "other") {
        sequence.push("ask_provider_rel");
    }

    const isStudent = d.isStudent === true;
    const age = calculateAge(d.birthDate);
    if (d.action !== "password_recovery" && d.action !== "address_change" && d.action !== "initial" && !isStudent && age >= 19 && d.visaType !== "VISA_F1") {
        sequence.push("ask_occupation");
    }

    sequence.push("ask_phone");
    if (d.action === "password_recovery") {
        sequence.push("ask_login");
    }
    
    sequence.push("review_data");

    return sequence;
}

function getNextUncompletedStep(ctx) {
    const d = ctx.session.data;
    const sequence = getSequence(d);
    
    for (const step of sequence) {
        if (step === "visa" && !d.visaType) return "visa";
        if (step === "action" && !d.action) return "action";
        if (step === "housing" && !d.housingType) return "housing";
        if (step === "ask_passport" && !d.passportNumber) return "ask_passport";
        if (step === "ask_id_front" && !d.idNumber) return "ask_id_front";
        if (step === "ask_id_back" && !d.address) return "ask_id_back";
        if (step === "ask_student" && d.isStudent === null) return "ask_student";
        if (step === "ask_school_cert" && !d.schoolName) return "ask_school_cert";
        if (step === "ask_guarantor_passport" && !d.guarantorFullName) return "ask_guarantor_passport";
        if (step === "ask_contract" && !d.address) return "ask_contract";
        if (step === "ask_provider_id" && !d.providerIdNumber) return "ask_provider_id";
        if (step === "ask_provider_rel" && !d.providerRel) return "ask_provider_rel";
        if (step === "ask_occupation" && !d.occupationType) return "ask_occupation";
        if (step === "ask_phone" && !d.phone) return "ask_phone";
        if (step === "ask_login" && !d.login) return "ask_login";
    }
    return "review_data";
}

async function navigateToNextStep(ctx) {
    const nextStep = getNextUncompletedStep(ctx);
    ctx.session.step = nextStep;

    if (nextStep === "visa") {
        await ctx.reply(
            "👋 Здравствуйте! Добро пожаловать в бот оформления документов.\nПожалуйста, выберите ваш тип визы:",
            Markup.inlineKeyboard([
                [Markup.button.callback("F-4", "VISA_F4")],
                [Markup.button.callback("F-1 / F-3 / F-6", "VISA_F1")],
                [Markup.button.callback("Другие визы", "VISA_OTHER")]
            ])
        );
    } else if (nextStep === "action") {
        await ctx.reply(
            "Выберите тип заявления:",
            Markup.inlineKeyboard([
                [Markup.button.callback("Восстановление пароля HiKorea", "ACTION_password_recovery")],
                [Markup.button.callback("Смена адреса", "ACTION_address_change")],
                [Markup.button.callback("Первичное получение ID", "ACTION_initial")],
                [Markup.button.callback("Продление визы", "ACTION_extension")],
                [Markup.button.callback("Перевыпуск ID", "ACTION_reissue")]
            ])
        );
    } else if (nextStep === "housing") {
        await ctx.reply("Договор аренды жилья оформлен на ваше имя?", Markup.inlineKeyboard([
            [Markup.button.callback("Да, на мое имя", "HOUSING_OWN")],
            [Markup.button.callback("Нет, на другое имя", "HOUSING_OTHER")]
        ]));
    } else if (nextStep === "ask_passport") {
        await ctx.reply("Пожалуйста, загрузите фотографию разворота вашего паспорта.");
    } else if (nextStep === "ask_id_front") {
        await ctx.reply("Пожалуйста, загрузите фотографию лицевой стороны вашей ID-карты.");
    } else if (nextStep === "ask_id_back") {
        await ctx.reply("Загрузите фотографию обратной стороны ID-карты (где указан адрес).");
    } else if (nextStep === "ask_student") {
        await ctx.reply("Вы являетесь студентом (초/중/고)?", Markup.inlineKeyboard([
            [Markup.button.callback("Да", "STUDENT_YES")],
            [Markup.button.callback("Нет", "STUDENT_NO")]
        ]));
    } else if (nextStep === "ask_school_cert") {
        await ctx.reply("Пожалуйста, загрузите фото справки со школы (School Certificate).");
    } else if (nextStep === "ask_guarantor_passport") {
        await ctx.reply("Пожалуйста, загрузите фото разворота паспорта поручителя (Guarantor).");
    } else if (nextStep === "ask_contract") {
        await ctx.reply("Пожалуйста, загрузите фотографию договора аренды жилья (Contract) для подтверждения адреса.");
    } else if (nextStep === "ask_provider_id") {
        await ctx.reply("Пожалуйста, загрузите фотографию лицевой стороны ID-карты предоставителя жилья.");
    } else if (nextStep === "ask_provider_rel") {
        await ctx.reply("Кем вам приходится предоставитель жилья?", Markup.inlineKeyboard([
            [Markup.button.callback("Семья/Родственник", "REL_family_relative")],
            [Markup.button.callback("Работодатель", "REL_employer")],
            [Markup.button.callback("Другое", "REL_other")]
        ]));
    } else if (nextStep === "ask_occupation") {
        await ctx.reply("Сведения о занятости (Выберите ваш статус):", Markup.inlineKeyboard([
            [Markup.button.callback("Временно не работаю", "JOB_unemployed")],
            [Markup.button.callback("Производство / прочее", "JOB_production"), Markup.button.callback("Склад / логистика", "JOB_warehouse")],
            [Markup.button.callback("Стройка", "JOB_construction"), Markup.button.callback("Магазин / продажи", "JOB_retail")],
            [Markup.button.callback("Офис / документы", "JOB_office"), Markup.button.callback("Свой бизнес", "JOB_business")]
        ]));
    } else if (nextStep === "ask_phone") {
        await ctx.reply("Пожалуйста, напишите ваш номер телефона.");
    } else if (nextStep === "ask_login") {
        await ctx.reply("Напишите ваш логин на HiKorea (если не помните, напишите 'не помню').");
    } else if (nextStep === "review_data") {
        await sendReviewMessage(ctx);
    }
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
bot.use(session());

const initSession = (ctx) => {
    ctx.session = {
        step: "visa",
        editingField: null,
        data: {
            visaType: "",
            action: "",
            housingType: "",
            isStudent: null,
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
            schoolName: "",
            guarantorFullName: "",
            guarantorNationality: "",
            providerFullName: "",
            providerIdNumber: "",
            providerNationality: "",
            providerRel: "",
            occupationType: "",
            phone: "",
            login: "",
            photos: {}
        }
    };
};

const sendStartMenu = async (ctx) => {
    initSession(ctx);
    await ctx.reply("Меню обновлено:", Markup.keyboard([["🔄 Начать заново"]]).resize());
    await navigateToNextStep(ctx);
};

bot.command("start", sendStartMenu);
bot.hears("🔄 Начать заново", sendStartMenu);

bot.action(/VISA_(.+)/, async (ctx) => {
    if (!ctx.session) initSession(ctx);
    ctx.session.data.visaType = `VISA_${ctx.match[1]}`;
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/ACTION_(.+)/, async (ctx) => {
    if (!ctx.session) initSession(ctx);
    ctx.session.data.action = ctx.match[1];
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/HOUSING_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.data.housingType = ctx.match[1] === "OWN" ? "self" : "other";
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/STUDENT_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.data.isStudent = ctx.match[1] === "YES";
    if (ctx.session.data.isStudent === false) {
        ctx.session.data.schoolName = "none"; // Mark as done to skip school cert
    }
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/REL_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.data.providerRel = ctx.match[1];
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/JOB_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.data.occupationType = ctx.match[1];
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
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
        
        if (step === "ask_passport" || (step === "editing_field" && ["surname", "givenNames", "birthDate", "sex", "nationality", "passportNumber"].includes(ctx.session.editingField))) {
            prompt = PASSPORT_PROMPT;
            fieldMap = { surname: "surname", givenNames: "given_names", birthDate: "birth_date", sex: "sex", nationality: "nationality", passportNumber: "passport_number", passportIssueDate: "issue_date", passportExpiryDate: "expiry_date" };
        } else if (step === "ask_id_front" || (step === "editing_field" && ctx.session.editingField === "idNumber")) {
            prompt = IDCARD_PASSWORD_RECOVERY_PROMPT;
            fieldMap = { surname: "surname", givenNames: "given_names", idNumber: "registration_number", nationality: "nationality" };
        } else if (step === "ask_id_back") {
            prompt = IDCARD_BACK_PASSWORD_RECOVERY_PROMPT;
            fieldMap = { address: "address" };
        } else if (step === "ask_contract" || (step === "editing_field" && ctx.session.editingField === "address")) {
            prompt = CONTRACT_ADDRESS_PROMPT;
            fieldMap = { address: "address" };
        } else if (step === "ask_school_cert" || (step === "editing_field" && ctx.session.editingField === "schoolName")) {
            prompt = SCHOOL_CERTIFICATE_PROMPT;
            fieldMap = { schoolName: "school_name" };
        } else if (step === "ask_guarantor_passport" || (step === "editing_field" && ctx.session.editingField === "guarantorFullName")) {
            prompt = GUARANTOR_PASSPORT_PROMPT;
            fieldMap = { guarantorFullName: "full_name", guarantorNationality: "nationality" };
        } else if (step === "ask_provider_id" || (step === "editing_field" && ctx.session.editingField === "providerIdNumber")) {
            prompt = PROVIDER_IDCARD_PROMPT;
            fieldMap = { providerFullName: "full_name", providerIdNumber: "registration_number", providerNationality: "nationality" };
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

    if (step === "editing_field") {
        ctx.session.editingField = null;
        ctx.session.step = "review_data";
        await sendReviewMessage(ctx);
    } else {
        await navigateToNextStep(ctx);
    }
});

bot.on("text", async (ctx) => {
    if (!ctx.session || !ctx.session.step) return;
    const text = ctx.message.text.trim();
    const step = ctx.session.step;

    if (step === "ask_phone") {
        ctx.session.data.phone = text;
        await navigateToNextStep(ctx);
    } else if (step === "ask_login") {
        ctx.session.data.login = text;
        await navigateToNextStep(ctx);
    } else if (step === "editing_field" && ctx.session.editingField) {
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
    if (d.housingType) info += `• Тип жилья: ${d.housingType === "self" ? "На мое имя" : "На другое имя"}\n`;
    info += `• Адрес: ${d.address || "Не найдено"}\n`;
    info += `• Телефон: ${d.phone || "Не найдено"}\n`;

    if (d.login) info += `• Логин HiKorea: ${d.login || "Не найдено"}\n`;
    if (d.isStudent) info += `• Школа: ${d.schoolName || "Не найдено"}\n`;
    if (d.guarantorFullName) info += `• Поручитель: ${d.guarantorFullName} (${d.guarantorNationality})\n`;
    if (d.providerIdNumber) info += `• Предоставитель жилья: ID ${d.providerIdNumber} (${d.providerFullName})\n`;
    if (d.providerRel) {
        const relMap = { family_relative: "Семья/Родственник", employer: "Работодатель", other: "Другое" };
        info += `• Отношение предоставителя: ${relMap[d.providerRel] || d.providerRel}\n`;
    }
    if (d.occupationType) {
        const jobMap = { unemployed: "Временно не работаю", production: "Производство", warehouse: "Склад", construction: "Стройка", retail: "Магазин", office: "Офис", business: "Бизнес" };
        info += `• Занятость: ${jobMap[d.occupationType] || d.occupationType}\n`;
    }

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

    await ctx.editMessageText(`Введите правильное значение для поля: **${fieldNames[ctx.session.editingField] || ctx.session.editingField}**\n\n📸 *Также вы можете отправить новую фотографию документа, и я попытаюсь распознать данные заново!*`, { parse_mode: "Markdown" });
});

bot.action("RESTART", async (ctx) => {
    initSession(ctx);
    await ctx.editMessageText("Мы начали заново.");
    await navigateToNextStep(ctx);
});

bot.action("GENERATE_PDF", async (ctx) => {
    await ctx.editMessageText("⏳ Генерирую PDF документы, подождите...");
    
    const d = ctx.session.data;
    
    const payload = {
        visaType: d.visaType === "VISA_F4" ? "F4" : (d.visaType === "VISA_F1" ? "F1" : "other"),
        action: d.action,
        housingType: d.housingType || (d.address && !d.address.includes("не указан") ? "other" : "own"),
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
        isStudent: d.isStudent,
        schoolName: d.schoolName !== "none" ? d.schoolName : "",
        guarantorFullName: d.guarantorFullName,
        guarantorNationality: d.guarantorNationality,
        providerFullName: d.providerFullName,
        providerIdNumber: d.providerIdNumber,
        providerNationality: d.providerNationality,
        accRelationship: d.providerRel,
        occupationType: d.occupationType,
    };

    try {
        const tmpDir = mkdtempSync(join(tmpdir(), "bot-pkg-"));
        const { finalPath, outputFiles } = await generatePackageFiles(payload, tmpDir);
        
        const pdfBuffer = readFileSync(finalPath);
        
        await ctx.replyWithDocument({ source: pdfBuffer, filename: "HiKorea_Application.pdf" }, {
            caption: "✅ Ваши документы готовы! Вы можете скачать PDF файл."
        });

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
