import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'packages.json')));
const pkg = db.packages.find(p => p.id === "1717231454553-t83a"); // Use an actual ID if possible, or just print them
console.log(db.packages.map(p => p.id).slice(0, 5));
