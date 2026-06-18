const templateCounters = { "Tokyo": 0, "Osaka": 0, "Okinawa": 0 };

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

        // 3. Generate Schedule of Stay (Word Document) using template
        const city = b.city || "Tokyo";
        let counter = 1;
        if (templateCounters[city] !== undefined) {
            counter = (templateCounters[city] % 3) + 1;
            templateCounters[city]++;
        } else {
            counter = Math.floor(Math.random() * 3) + 1;
        }

        const templateName = `ITINERARY ${counter} - ${city.toUpperCase()}, JAPAN.docx`;
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
            const dates = {};
            if (b.entryDate) {
                const entry = new Date(b.entryDate);
                for (let i = 1; i <= 5; i++) {
                    const d = new Date(entry);
                    d.setDate(entry.getDate() + (i - 1));
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    dates[`date${i}`] = `${yyyy}-${mm}-${dd}`;
                }
            } else {
                for (let i = 1; i <= 5; i++) {
                    dates[`date${i}`] = "";
                }
            }

            doc.render(dates);

            const buf = doc.getZip().generate({
                type: "nodebuffer",
                compression: "DEFLATE",
            });
            writeFileSync(wordPath, buf);
        } else {
            console.warn(`[Japan PDF] Template not found: ${templatePath}`);
            // Fallback: create empty file or we can just send the zip without it (it will be missing)
            writeFileSync(wordPath, "");
        }

        // 4. Create ZIP Archive
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="Japan_Visa_Documents.zip"');
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', err => { throw err; });
        archive.pipe(res);
        
        if (existsSync(pdfOutPath)) {
            archive.file(pdfOutPath, { name: 'Japan_Application_Package.pdf' });
        }
        if (existsSync(wordPath) && readFileSync(wordPath).length > 0) {
            archive.file(wordPath, { name: 'Schedule_of_Stay_in_Japan.docx' });
        }
        
        await archive.finalize();
        
        // Cleanup async
        setTimeout(() => {
            try {
                unlinkSync(jsonPath);
                unlinkSync(pdfOutPath);
                unlinkSync(wordPath);
                images.forEach(img => { try { unlinkSync(img); } catch {} });
                rmSync(tmpDir, { recursive: true, force: true });
            } catch {}
        }, 5000);
        
    } catch (err) {
        console.error("❌ [Japan Package Download] Error:", err.message);
        return res.status(500).json({ ok: false, error: "Не удалось создать пакет документов." });
    }
});
