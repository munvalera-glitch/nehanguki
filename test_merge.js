const { execSync } = require('child_process');
const outputFiles = ["/var/folders/wc/1vfp78f15x59py_b8phbswwc0000gn/T/pkg-WXERH0/03_occupation.pdf"];
const fileList  = JSON.stringify(outputFiles.map(f => f.replace(/\\/g, "/")));
const pyScript = `
import fitz, json
files = json.loads('${fileList.replace(/'/g, "\\\\'")}')
print(files)
`;
console.log("Script:", pyScript);
try {
    execSync(`python3 -c "${pyScript.replace(/"/g, '\\"')}"`);
} catch(e) {
    console.log("Error:", e.message);
}
