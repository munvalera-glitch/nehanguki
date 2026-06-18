const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");

const content = fs.readFileSync("templates/schedule_tokyo_1_villa_fontaine_kayabacho.docx", "binary");
const zip = new PizZip(content);
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

doc.render({
    date1: "2026.06.11",
    currentDate: "2026/06/11",
    applicantName: "Ivan Ivanov",
    companionCount: 1,
    companions: [{ index: 1, name: "Maria Ivanova", relationship: "Wife" }]
});

const buf = doc.getZip().generate({ type: "nodebuffer" });
fs.writeFileSync("/tmp/test_out.docx", buf);
console.log("Done");
