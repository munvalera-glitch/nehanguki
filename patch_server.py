import re

with open("server.js", "r", encoding="utf-8") as f:
    code = f.read()

# Replace docxtemplater logic
old_docx_logic = """            // Current application date
            const today = new Date();
            const tY = today.getFullYear();
            const tM = String(today.getMonth() + 1).padStart(2, '0');
            const tD = String(today.getDate()).padStart(2, '0');
            docxData.currentDate = `${tY}/${tM}/${tD}`;

            // Applicant name
            let appName = "";
            if (b.applicant) {
                const s = b.applicant.surname || "";
                const g = b.applicant.given_names || "";
                appName = `${s} ${g}`.trim();
            }
            docxData.applicantName = appName;

            doc.render(docxData);"""

new_docx_logic = """            // Current application date
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
                companionsList.push({
                    index: i,
                    name: `${cs} ${cg}`.trim(),
                    relationship: comp.relationshipToApplicant || "Friend"
                });
            }
            docxData.companions = companionsList;
            docxData.companionCount = companionsList.length > 0 ? String(companionsList.length) : "";

            doc.render(docxData);"""

if old_docx_logic in code:
    code = code.replace(old_docx_logic, new_docx_logic)
else:
    print("WARNING: Old docx logic not found!")

# Now replace the python generation logic to handle loops over travelers
old_py_logic = """        // 1. Write the base64 images to files
        const images = [];
        if (b.images && Array.isArray(b.images)) {
            for (let i = 0; i < b.images.length; i++) {
                const imgObj = b.images[i];
                if (!imgObj || !imgObj.data) continue;
                const parts = imgObj.data.split(";base64,");
                if (parts.length === 2) {
                    const extMatch = parts[0].match(/image\/(jpeg|jpg|png)/);
                    const ext = extMatch ? extMatch[1] : "jpg";
                    const buffer = Buffer.from(parts[1], "base64");
                    const imgPath = join(tmpDir, `image_${i}.${ext}`);
                    writeFileSync(imgPath, buffer);
                    images.push({ path: imgPath, type: imgObj.type });
                }
            }
        }
        
        // Write the main data to json for the python script
        const pyData = {
            applicant: b.applicant || {},
            entryDate: b.entryDate || "",
            city: b.city || "",
            work: b.work || {},
            images: images
        };
        const jsonPath = join(tmpDir, "japan_data.json");
        writeFileSync(jsonPath, JSON.stringify(pyData), "utf8");
        
        // 2. Run Python script to generate package.pdf
        const pdfOutPath = join(tmpDir, "Japan_Application_Package.pdf");
        const pyDir = resolve(__dirname, "pdf").replace(/\\\\/g, "/");
        await new Promise((resolve_p, reject_p) => {
            const py = spawn("python3", ["-c", `
import sys
sys.path.insert(0, '${pyDir}')
from japan_pdf_generator import create_japan_pdf_package
create_japan_pdf_package('${jsonPath.replace(/\\\\/g, "/")}', '${pdfOutPath.replace(/\\\\/g, "/")}')
`]);
            let stderr = "";
            py.stderr.on("data", d => { stderr += d.toString(); });
            py.on("close", code => {
                if (code === 0) resolve_p();
                else { console.error("[Japan PDF] Python error:\\\\n", stderr); reject_p(new Error(stderr.slice(0, 300))); }
            });
        });"""

new_py_logic = """        const allTravelers = b.travelers && b.travelers.length > 0 ? b.travelers : [{
            applicant: b.applicant || {},
            work: b.work || {},
            images: b.images || []
        }];

        const pdfFiles = [];
        const pyDir = resolve(__dirname, "pdf").replace(/\\\\/g, "/");

        for (let tIdx = 0; tIdx < allTravelers.length; tIdx++) {
            const t = allTravelers[tIdx];
            const images = [];
            if (t.images && Array.isArray(t.images)) {
                for (let i = 0; i < t.images.length; i++) {
                    const imgObj = t.images[i];
                    if (!imgObj || !imgObj.data) continue;
                    const parts = imgObj.data.split(";base64,");
                    if (parts.length === 2) {
                        const extMatch = parts[0].match(/image\\/(jpeg|jpg|png)/);
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

            const pdfOutPath = join(tmpDir, `Japan_Application_Package_${safeName}.pdf`);
            
            await new Promise((resolve_p, reject_p) => {
                const py = spawn("python3", ["-c", `
import sys
sys.path.insert(0, '${pyDir}')
from japan_pdf_generator import create_japan_pdf_package
create_japan_pdf_package('${jsonPath.replace(/\\\\/g, "/")}', '${pdfOutPath.replace(/\\\\/g, "/")}')
`]);
                let stderr = "";
                py.stderr.on("data", d => { stderr += d.toString(); });
                py.on("close", code => {
                    if (code === 0) resolve_p();
                    else { console.error(`[Japan PDF ${tIdx}] Python error:\\n`, stderr); reject_p(new Error(stderr.slice(0, 300))); }
                });
            });
            
            pdfFiles.push(pdfOutPath);
        }"""

# Need to handle backslashes correctly in the regex/string replace.
# To avoid python literal issues, I'll use simple string replacements.

code = code.replace("        // 1. Write the base64 images to files", "// 1. Generate PDFs for each traveler\n" + new_py_logic)
code = code.replace("""        const images = [];
        if (b.images && Array.isArray(b.images)) {
            for (let i = 0; i < b.images.length; i++) {
                const imgObj = b.images[i];
                if (!imgObj || !imgObj.data) continue;
                const parts = imgObj.data.split(";base64,");
                if (parts.length === 2) {
                    const extMatch = parts[0].match(/image\/(jpeg|jpg|png)/);
                    const ext = extMatch ? extMatch[1] : "jpg";
                    const buffer = Buffer.from(parts[1], "base64");
                    const imgPath = join(tmpDir, `image_${i}.${ext}`);
                    writeFileSync(imgPath, buffer);
                    images.push({ path: imgPath, type: imgObj.type });
                }
            }
        }
        
        // Write the main data to json for the python script
        const pyData = {
            applicant: b.applicant || {},
            entryDate: b.entryDate || "",
            city: b.city || "",
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
        });""", "")

old_zip_logic = """        // 4. Create ZIP Archive
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="Japan_Visa_Documents.zip"');
        
        const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
        archive.pipe(res);
        
        if (existsSync(pdfOutPath)) archive.file(pdfOutPath, { name: "Japan_Application_Package.pdf" });
        if (existsSync(wordPath)) archive.file(wordPath, { name: "Schedule_of_Stay_in_Japan.docx" });
        
        await archive.finalize();"""

new_zip_logic = """        // 4. Create ZIP Archive
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="Japan_Visa_Documents.zip"');
        
        const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
        archive.pipe(res);
        
        for (const f of pdfFiles) {
            if (existsSync(f)) {
                const bname = require('path').basename(f);
                archive.file(f, { name: bname });
            }
        }
        if (existsSync(wordPath)) archive.file(wordPath, { name: "Schedule_of_Stay_in_Japan.docx" });
        
        await archive.finalize();"""
        
if old_zip_logic in code:
    code = code.replace(old_zip_logic, new_zip_logic)

with open("server.js", "w", encoding="utf-8") as f:
    f.write(code)

