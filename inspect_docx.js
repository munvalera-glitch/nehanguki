const fs = require('fs');
const JSZip = require('jszip');

async function inspect() {
    const data = fs.readFileSync('templates/schedule_tokyo_1_villa_fontaine_kayabacho.docx');
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file('word/document.xml').async('string');
    console.log(docXml.substring(0, 500) + '... (truncated)');
    // Let's grep for "companions" or "name"
    const matches = docXml.match(/<w:t>.*?<\/w:t>/g);
    if (matches) {
        console.log("Text nodes:");
        console.log(matches.filter(m => m.includes('companion') || m.includes('name') || m.includes('1.')).join('\n'));
    }
}
inspect();
