const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const target = `            const pdfOutPath = join(tmpDir, \`Japan_Application_Package_\${safeName}.pdf\`);
            
            await new Promise((resolve_p, reject_p) => {
                const py = spawn("python3", ["-c", \`
import sys
sys.path.insert(0, '\${pyDir}')
from japan_pdf_generator import create_japan_pdf_package
create_japan_pdf_package('\${jsonPath.replace(/\\\\/g, "/")}', '\${pdfOutPath.replace(/\\\\/g, "/")}')
\`]);
                let stderr = "";
                py.stderr.on("data", d => { stderr += d.toString(); });
                py.on("close", code => {
                    if (code === 0) resolve_p();
                    else { console.error(\`[Japan PDF \${tIdx}] Python error:\\n\`, stderr); reject_p(new Error(stderr.slice(0, 300))); }
                });
            });
            
            pdfFiles.push(pdfOutPath);`;

const replacement = `            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (img.type === 'signature') {
                    const pdfOutPath = join(tmpDir, \`Signature_\${safeName}.pdf\`);
                    await new Promise((resolve_p, reject_p) => {
                        const py = spawn("python3", ["-c", \`
import sys
sys.path.insert(0, '\${pyDir}')
from japan_pdf_generator import create_japan_signature_pdf
create_japan_signature_pdf('\${img.path.replace(/\\\\/g, "/")}', '\${pdfOutPath.replace(/\\\\/g, "/")}')
\`]);
                        let stderr = "";
                        py.stderr.on("data", d => { stderr += d.toString(); });
                        py.on("close", code => {
                            if (code === 0) resolve_p();
                            else { console.error(\\\`[Japan Sig PDF \\\${tIdx}] Python error:\\n\\\`, stderr); reject_p(new Error(stderr.slice(0, 300))); }
                        });
                    });
                    pdfFiles.push(pdfOutPath);
                } else {
                    const ext = img.path.split('.').pop();
                    const finalName = \`\${img.type}_\${safeName}_\${i}.\${ext}\`;
                    rawImages.push({ path: img.path, name: finalName });
                }
            }`;

if (code.includes(target)) {
    fs.writeFileSync('server.js', code.replace(target, replacement));
    console.log("Replaced successfully!");
} else {
    console.log("Target not found!");
}
