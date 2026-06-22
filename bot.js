import "dotenv/config";
import popbill from "popbill";
import { Telegraf, session, Markup } from "telegraf";
import { GoogleGenAI } from "@google/genai";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generatePackageFiles } from "./server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

popbill.config({
    LinkID: process.env.POPBILL_LINK_ID,
    SecretKey: process.env.POPBILL_SECRET_KEY,
    IsTest: false,
    defaultErrorHandler: function(Error) { console.error('Popbill Error', Error); }
});
const faxService = popbill.FaxService();
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
  "nationality": "string",
  "passport_number": "string",
  "sex": "string"
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
    const today = new Date();
    const dob = new Date(parts[0], parts[1] - 1, parts[2]);
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
    return a;
}

function getSequence(d) {
    let sequence = ["visa", "action"];
    if (!d.visaType || !d.action) return sequence;

    if (d.action !== "password_recovery") sequence.push("ask_passport");
    sequence.push("ask_id_front");
    
    if (d.action === "password_recovery") {
        sequence.push("ask_id_back");
    }

    sequence.push("ask_phone");

    if (d.action === "extension") {
        sequence.push("ask_student");
        if (d.isStudent === true) {
            sequence.push("ask_school_cert");
        }
    }

    if (d.visaType === "VISA_F1" && d.action !== "address_change" && d.action !== "reissue") {
        sequence.push("ask_guarantor_passport");
        sequence.push("ask_guarantor_phone");
        sequence.push("ask_guarantor_rel");
    }

    if (d.action === "initial" || d.action === "address_change" || d.action === "extension") {
        sequence.push("housing");
        if (d.housingType === "other") {
            sequence.push("ask_acc_residence_type");
            sequence.push("ask_acc_ownership_type");
        }
    }

    if (d.action !== "password_recovery") {
        sequence.push("ask_contract");
    }

    if (d.action !== "password_recovery" && d.housingType === "other" && d.action !== "reissue" && d.action !== "address_change") {
        sequence.push("ask_provider_id");
    }

    if (d.action !== "password_recovery" && d.housingType === "other") {
        sequence.push("ask_provider_rel");
        sequence.push("ask_provider_phone");
    }

    const isStudent = d.isStudent === true;
    const age = calculateAge(d.birthDate);
    if (d.action !== "password_recovery" && d.action !== "address_change" && d.action !== "initial" && !isStudent && age >= 19 && d.visaType !== "VISA_F1") {
        sequence.push("ask_occupation");
    }

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
        if (step === "ask_acc_residence_type" && !d.acc_residence_type) return "ask_acc_residence_type";
        if (step === "ask_acc_ownership_type" && !d.acc_ownership_type) return "ask_acc_ownership_type";
        if (step === "ask_passport" && !d.passportNumber) return "ask_passport";
        if (step === "ask_id_front" && !d.idNumber) return "ask_id_front";
        if (step === "ask_id_back" && !d.address) return "ask_id_back";
        if (step === "ask_student" && d.isStudent === null) return "ask_student";
        if (step === "ask_school_cert" && !d.schoolName) return "ask_school_cert";
        if (step === "ask_guarantor_passport" && !d.guarantorFullName) return "ask_guarantor_passport";
        if (step === "ask_guarantor_phone" && !d.guarantorPhone) return "ask_guarantor_phone";
        if (step === "ask_guarantor_rel" && !d.guarantorRelationship) return "ask_guarantor_rel";
        if (step === "ask_contract" && !d.address) return "ask_contract";
        if (step === "ask_provider_id" && !d.providerIdNumber) return "ask_provider_id";
        if (step === "ask_provider_rel" && !d.providerRel) return "ask_provider_rel";
        if (step === "ask_provider_phone" && !d.providerPhone) return "ask_provider_phone";
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
    } else if (nextStep === "ask_acc_residence_type") {
        await ctx.reply("Выберите тип жилья:", Markup.inlineKeyboard([
            [Markup.button.callback("Частный дом / Квартира", "RESIDENCE_private_residence")],
            [Markup.button.callback("Общежитие", "RESIDENCE_dormitory")],
            [Markup.button.callback("Гостиница / Мотель", "RESIDENCE_accommodation")],
            [Markup.button.callback("Другое", "RESIDENCE_other")]
        ]));
    } else if (nextStep === "ask_acc_ownership_type") {
        await ctx.reply("Кому принадлежит жилье?", Markup.inlineKeyboard([
            [Markup.button.callback("Собственность (모가)", "OWNERSHIP_own")],
            [Markup.button.callback("В аренде (임대)", "OWNERSHIP_rent")],
            [Markup.button.callback("Другое (기타)", "OWNERSHIP_other")]
        ]));
    } else if (nextStep === "ask_passport") {
        const actionMap = {
            "password_recovery": "Восстановление пароля HiKorea",
            "address_change": "Смена адреса",
            "initial": "Первичное получение ID",
            "extension": "Продление визы",
            "reissue": "Перевыпуск ID"
        };
        const actionStr = actionMap[ctx.session.data.action] || ctx.session.data.action;
        await ctx.reply(`Вы выбрали: *${actionStr}*\nПожалуйста, загрузите фотографию разворота вашего паспорта.`, { parse_mode: 'Markdown' });
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
    } else if (nextStep === "ask_guarantor_phone") {
        await ctx.reply("Введите номер телефона поручителя (например, 010-1234-5678):");
    } else if (nextStep === "ask_guarantor_rel") {
        await ctx.reply("Кем вам приходится поручитель?", Markup.inlineKeyboard([
            [Markup.button.callback("Супруг/Супруга", "g_rel_spouse")],
            [Markup.button.callback("Родитель", "g_rel_parent")]
        ]));
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
    } else if (nextStep === "ask_provider_phone") {
        await ctx.reply("Пожалуйста, напишите номер телефона предоставителя жилья (представителя):", Markup.keyboard([["🔄 Начать заново"]]).resize());
    } else if (nextStep === "ask_occupation") {
        await ctx.reply("Сведения о занятости (Выберите ваш статус):", Markup.inlineKeyboard([
            [Markup.button.callback("Временно не работаю", "JOB_unemployed")],
            [Markup.button.callback("Производство / прочее", "JOB_production"), Markup.button.callback("Склад / логистика", "JOB_warehouse")],
            [Markup.button.callback("Стройка", "JOB_construction"), Markup.button.callback("Магазин / продажи", "JOB_retail")],
            [Markup.button.callback("Офис / документы", "JOB_office"), Markup.button.callback("Свой бизнес", "JOB_business")]
        ]));
    } else if (nextStep === "ask_phone") {
        await ctx.reply("Пожалуйста, напишите ваш личный номер телефона (заявителя):", Markup.keyboard([["🔄 Начать заново"]]).resize());
    } else if (nextStep === "ask_login") {
        await ctx.reply("Напишите ваш логин на HiKorea (если не помните, напишите 'не помню').");
    } else if (nextStep === "review_data") {
        await sendReviewMessage(ctx);
    }
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
bot.use(session());

const ADMIN_CHAT_ID = "166094870";
const ALLOWED_USERS_FILE = join(__dirname, "data", "allowed_users.json");

function getAllowedUsers() {
    try {
        if (!existsSync(ALLOWED_USERS_FILE)) return [];
        return JSON.parse(readFileSync(ALLOWED_USERS_FILE, "utf8"));
    } catch (e) {
        return [];
    }
}

function addAllowedUser(userId) {
    const users = getAllowedUsers();
    if (!users.includes(userId)) {
        users.push(userId);
        writeFileSync(ALLOWED_USERS_FILE, JSON.stringify(users, null, 2), "utf8");
    }
}

function removeAllowedUser(userId) {
    const users = getAllowedUsers();
    const updated = users.filter(id => id !== userId);
    writeFileSync(ALLOWED_USERS_FILE, JSON.stringify(updated, null, 2), "utf8");
}

bot.use(async (ctx, next) => {
    if (!ctx.from) return next();
    
    const userId = ctx.from.id;
    if (userId.toString() === ADMIN_CHAT_ID) return next();

    const allowed = getAllowedUsers();
    if (allowed.includes(userId)) return next();

    if (ctx.callbackQuery && ctx.callbackQuery.data === "REQUEST_ACCESS") {
        await ctx.answerCbQuery();
        await ctx.editMessageText("⏳ Ваш запрос отправлен администратору. Пожалуйста, ожидайте...");
        
        const username = ctx.from.username ? `@${ctx.from.username}` : "Без username";
        const name = `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim();
        
        await ctx.telegram.sendMessage(ADMIN_CHAT_ID, 
            `🔐 **Новый запрос доступа!**\n\nИмя: ${name}\nUsername: ${username}\nID: ${userId}`, 
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "✅ Разрешить", callback_data: `APPROVE_${userId}` },
                            { text: "❌ Отклонить", callback_data: `REJECT_${userId}` }
                        ]
                    ]
                }
            }
        );
        return;
    }

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery("Доступ закрыт.", { show_alert: true });
        return;
    }

    await ctx.reply(
        "⛔️ У вас нет доступа к этому боту.\n\nПожалуйста, запросите доступ у администратора, нажав на кнопку ниже:",
        Markup.inlineKeyboard([
            [Markup.button.callback("🔑 Запросить доступ", "REQUEST_ACCESS")]
        ])
    );
});

bot.action(/APPROVE_(.+)/, async (ctx) => {
    const userId = parseInt(ctx.match[1], 10);
    addAllowedUser(userId);
    await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ **ОДОБРЕНО**");
    try {
        await ctx.telegram.sendMessage(userId, "🎉 **Доступ разрешен!**\n\nТеперь вы можете пользоваться ботом. Отправьте /start для начала работы.", { parse_mode: "Markdown" });
    } catch (e) {}
});

bot.action(/REJECT_(.+)/, async (ctx) => {
    const userId = parseInt(ctx.match[1], 10);
    await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n❌ **ОТКЛОНЕНО**");
    try {
        await ctx.telegram.sendMessage(userId, "⛔️ **В доступе отказано.**", { parse_mode: "Markdown" });
    } catch (e) {}
});

bot.command('admin', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    
    const users = getAllowedUsers();
    if (users.length === 0) {
        return ctx.reply("Список допущенных пользователей пуст.");
    }
    
    let text = "👥 **Список допущенных пользователей:**\n\n";
    users.forEach((id, index) => {
        text += `${index + 1}. ID: \`${id}\`\n`;
    });
    text += "\nЧтобы удалить пользователя, отправьте команду:\n`/revoke 123456789`";
    
    await ctx.reply(text, { parse_mode: "Markdown" });
});

bot.command('revoke', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID) return;
    
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
        return ctx.reply("❌ Укажите ID пользователя. Пример: `/revoke 123456789`", { parse_mode: "Markdown" });
    }
    const userId = parseInt(parts[1], 10);
    removeAllowedUser(userId);
    await ctx.reply(`✅ Пользователь ${userId} удален из списка доступа.`);
});

const initSession = (ctx) => {
    ctx.session = {
        step: "visa",
        editingField: null,
        data: {
            visaType: "",
            action: "",
            housingType: "",
            acc_residence_type: "",
            acc_ownership_type: "",
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
            guarantorSex: "",
            guarantorPassportNumber: "",
            guarantorPhone: "",
            guarantorRelationship: "",
            providerFullName: "",
            providerIdNumber: "",
            providerNationality: "",
            providerRel: "",
            providerPhone: "",
            occupationType: "",
            phone: "",
            login: "",
            photos: {}
        }
    };
};

const sendStartMenu = async (ctx) => {
    initSession(ctx);
    await ctx.reply("Меню обновлено", Markup.keyboard([["🔄 Начать заново"]]).resize());
    await navigateToNextStep(ctx);
};

bot.command("start", sendStartMenu);
bot.command("reset", sendStartMenu);
bot.command("restart", sendStartMenu);
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

bot.action(/g_rel_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    const relStr = ctx.match[1];
    const d = ctx.session.data;
    if (relStr === "spouse") d.guarantorRelationship = "배우자";
    else if (relStr === "parent") {
        const sx = (d.guarantorSex || "").toLowerCase();
        d.guarantorRelationship = (sx === "m" || sx === "male" || sx === "мужской" || sx === "мужчина") ? "부" : "모";
    }
    else d.guarantorRelationship = "지인";
    
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/JOB_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.data.occupationType = ctx.match[1];
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/RESIDENCE_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.data.acc_residence_type = ctx.match[1];
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.action(/OWNERSHIP_(.+)/, async (ctx) => {
    if (!ctx.session) return;
    ctx.session.data.acc_ownership_type = ctx.match[1];
    await ctx.answerCbQuery();
    await navigateToNextStep(ctx);
});

bot.on(["photo", "document"], async (ctx) => {
    if (!ctx.session || !ctx.session.step) return;
    const step = ctx.session.step;
    
    let fileId;
    let mimeType;
    if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        fileId = photo.file_id;
        mimeType = "image/jpeg";
    } else if (ctx.message.document) {
        fileId = ctx.message.document.file_id;
        mimeType = ctx.message.document.mime_type || "image/jpeg";
        if (!mimeType.startsWith("image/")) {
            return ctx.reply("❌ Пожалуйста, отправьте изображение (в формате JPG или PNG). PDF и другие документы пока не поддерживаются.");
        }
    } else {
        return;
    }

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
            fieldMap = { guarantorFullName: "full_name", guarantorNationality: "nationality", guarantorPassportNumber: "passport_number", guarantorSex: "sex" };
        } else if (step === "ask_provider_id" || (step === "editing_field" && ctx.session.editingField === "providerIdNumber")) {
            prompt = PROVIDER_IDCARD_PROMPT;
            fieldMap = { providerFullName: "full_name", providerIdNumber: "registration_number", providerNationality: "nationality" };
        }

        if (prompt) {
            const data = await callGemini(mimeType, base64Image, prompt);
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
    } else if (step === "ask_provider_phone") {
        ctx.session.data.providerPhone = text;
        await navigateToNextStep(ctx);
    } else if (step === "ask_guarantor_phone") {
        ctx.session.data.guarantorPhone = text;
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
    if (d.guarantorFullName) {
        info += `• Поручитель: ${d.guarantorFullName} (${d.guarantorNationality}, ${d.guarantorSex || "?"})\n`;
        info += `• Отношение поручителя: ${d.guarantorRelationship || "?"}\n`;
        info += `• Телефон поручителя: ${d.guarantorPhone || "?"}\n`;
    }
    if (d.providerIdNumber) info += `• Предоставитель жилья: ID ${d.providerIdNumber} (${d.providerFullName})\n`;
    if (d.providerRel) {
        const relMap = { family_relative: "Семья/Родственник", employer: "Работодатель", other: "Другое" };
        info += `• Отношение предоставителя: ${relMap[d.providerRel] || d.providerRel}\n`;
    }
    if (d.providerPhone) info += `• Телефон предоставителя: ${d.providerPhone}\n`;
    if (d.occupationType) {
        const jobMap = { unemployed: "Временно не работаю", production: "Производство", warehouse: "Склад", construction: "Стройка", retail: "Магазин", office: "Офис", business: "Бизнес" };
        info += `• Занятость: ${jobMap[d.occupationType] || d.occupationType}\n`;
    }
    if (d.acc_residence_type) {
        const resMap = { private_residence: "Частный дом / Квартира", dormitory: "Общежитие", accommodation: "Гостиница / Мотель", other: "Другое" };
        info += `• Тип жилья: ${resMap[d.acc_residence_type] || d.acc_residence_type}\n`;
    }
    if (d.acc_ownership_type) {
        const ownMap = { own: "Собственность (모가)", rent: "В аренде (임대)", other: "Другое (기타)" };
        info += `• Принадлежность жилья: ${ownMap[d.acc_ownership_type] || d.acc_ownership_type}\n`;
    }

    info += "\nЕсли вы заметили ошибку распознавания, нажмите на кнопку ниже для исправления.";

    await ctx.reply(info, Markup.inlineKeyboard([
        [Markup.button.callback("✏️ Изменить Фамилию", "EDIT_surname"), Markup.button.callback("✏️ Изменить Имя", "EDIT_givenNames")],
        [Markup.button.callback("✏️ Изменить Номер паспорта", "EDIT_passportNumber"), Markup.button.callback("✏️ Изменить Дату рождения", "EDIT_birthDate")],
        [Markup.button.callback("✏️ Изменить Номер ID", "EDIT_idNumber"), Markup.button.callback("✏️ Изменить Пол", "EDIT_sex")],
        [Markup.button.callback("✏️ Изменить Адрес", "EDIT_address"), Markup.button.callback("✏️ Изменить Гражданство", "EDIT_nationality")],
        [Markup.button.callback("✏️ Изменить Телефон", "EDIT_phone")],
        [Markup.button.callback("✏️ Изм. Тип жилья", "EDIT_REASK_acc_residence_type"), Markup.button.callback("✏️ Изм. Принадлежность", "EDIT_REASK_acc_ownership_type")],
        [Markup.button.callback("🟩 СГЕНЕРИРОВАТЬ PDF 🟩", "GENERATE_PDF")]
    ]));
}

bot.action("EDIT_REASK_acc_residence_type", async (ctx) => {
    ctx.session.data.acc_residence_type = "";
    ctx.session.step = "ask_acc_residence_type";
    await navigateToNextStep(ctx);
});

bot.action("EDIT_REASK_acc_ownership_type", async (ctx) => {
    ctx.session.data.acc_ownership_type = "";
    ctx.session.step = "ask_acc_ownership_type";
    await navigateToNextStep(ctx);
});

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
        guarantorSex: d.guarantorSex,
        guarantorPassportNumber: d.guarantorPassportNumber,
        guarantorPhone: d.guarantorPhone,
        guarantorRelationship: d.guarantorRelationship,
        providerFullName: d.providerFullName,
        providerIdNumber: d.providerIdNumber,
        providerNationality: d.providerNationality,
        providerPhone: d.providerPhone,
        accRelationship: d.providerRel,
        accOwnershipType: d.acc_ownership_type,
        accResidenceType: d.acc_residence_type,
        occupationType: d.occupationType,
    };

    try {
        const tmpDir = mkdtempSync(join(tmpdir(), "bot-pkg-"));
        const { finalPath, outputFiles } = await generatePackageFiles(payload, tmpDir);
        
        const pdfBuffer = readFileSync(finalPath);
        
        await ctx.replyWithDocument({ source: pdfBuffer, filename: "HiKorea_Application.pdf" }, {
            caption: "✅ Ваше заявление успешно сгенерировано!"
        });
        
        const cleanupFiles = () => {
            try {
                outputFiles.forEach(f => { try { unlinkSync(f); } catch {} });
                unlinkSync(finalPath);
            } catch {}
        };

        if (d.action === "password_recovery") {
            const senderName = (d.surname || "") + " " + (d.givenNames || "");
            const CorpNum = process.env.POPBILL_CORP_NUM;
            const SenderNum = process.env.POPBILL_SENDER_NUM;
            const ReceiverNum = "050-4466-4550";
            const ReceiverName = "HiKorea Help Desk";
            const FilePath = [finalPath];

            const options = {
                SenderNum: SenderNum,
                SenderName: senderName.trim() || "Applicant",
                Receiver: ReceiverNum,
                ReceiverName: ReceiverName,
                FilePaths: FilePath,
            };

            await ctx.reply("📠 Отправляю факс в HiKorea...");

            faxService.sendFax(CorpNum, options, function(receiptNum) {
                console.log("✅ Fax sent successfully. ReceiptNum : " + receiptNum);
                ctx.reply(`✅ Факс отправлен!\nНомер квитанции: ${receiptNum}\nОжидайте подтверждения доставки...`);
                
                const pollInterval = setInterval(() => {
                    faxService.getFaxResult(CorpNum, receiptNum, function(result) {
                        if (!result || result.length === 0) return;
                        const faxInfo = result[0];
                        const state = faxInfo.state;
                        
                        if (state === 3) {
                            clearInterval(pollInterval);
                            ctx.reply(`✅ Доставлено!\nВаш факс (квитанция ${receiptNum}) был успешно доставлен в HiKorea.`);
                        } else if (state === 4) {
                            clearInterval(pollInterval);
                            const errMsg = faxInfo.result ? `Код ошибки: ${faxInfo.result}` : "Не удалось дозвониться";
                            ctx.reply(`❌ Ошибка доставки факса (квитанция ${receiptNum}).\nПричина: ${errMsg}`);
                        }
                    }, function(err) {
                        console.error("Popbill getFaxResult Error:", err.message);
                    });
                }, 10000);
                
                cleanupFiles();
            }, function(error) {
                console.error("❌ Popbill Error : [" + error.code + "] " + error.message);
                ctx.reply("❌ Произошла ошибка при отправке факса: " + error.message);
                cleanupFiles();
            });
        } else {
            cleanupFiles();
        }

    } catch (err) {
        console.error("PDF Gen error:", err);
        await ctx.reply("❌ Произошла ошибка при генерации PDF. Пожалуйста, попробуйте еще раз.");
    }
});

bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
    ctx.reply("❌ Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз.").catch(() => {});
});

export { bot };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    bot.telegram.setMyCommands([
        { command: 'start', description: 'Запуск бота' },
        { command: 'reset', description: 'Сбросить заявление и начать заново' }
    ]).catch(console.error);
    
    bot.launch().then(() => console.log("Bot is running..."));
}
