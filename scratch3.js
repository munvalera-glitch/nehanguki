import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PASSPORT_PROMPT = `
You are a passport data extraction assistant.
JSON schema:
{
  "surname": "string",
  "given_names": "string",
  "full_name": "string",
  "mrz_line1": "string"
}
`.trim();

async function run() {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: "Here is a passport with surname TSOY, given names LYUBOV." },
                        { text: PASSPORT_PROMPT },
                    ],
                },
            ],
            config: {
                temperature: 0,
                topP: 1,
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
            },
        });
        console.log("FINISH REASON:", response.candidates[0].finishReason);
        console.log("TEXT:", response.text);
    } catch (e) {
        console.error(e);
    }
}
run();
