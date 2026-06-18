import fs from 'fs';
import path from 'path';

const BACKUP_DIR = '/var/backups/hikoreaforms_cleanup';
const DATA_DIR = '/var/www/hikoreaforms/data';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PACKAGES_FILE = path.join(DATA_DIR, 'packages.json');

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let packages = {};
try {
  if (fs.existsSync(PACKAGES_FILE)) {
    const rawData = fs.readFileSync(PACKAGES_FILE, 'utf8');
    packages = JSON.parse(rawData);
  }
} catch (e) {
  console.error("Error reading packages.json:", e.message);
}

let filesFound = 0;
let filesMoved = 0;
let foldersAffected = 0;

if (fs.existsSync(UPLOADS_DIR)) {
  const folders = fs.readdirSync(UPLOADS_DIR);
  for (const folder of folders) {
    const folderPath = path.join(UPLOADS_DIR, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    // Check if this package is password_recovery
    let isPasswordRecovery = false;
    // Iterate over all users to find this package
    for (const userId in packages) {
      const userPkgs = packages[userId];
      for (const p of userPkgs) {
        if (p.id === folder) {
          if (p.action === 'password_recovery') {
            isPasswordRecovery = true;
          }
        }
      }
    }
    
    const files = fs.readdirSync(folderPath);
    let folderHasMovedFile = false;
    for (const file of files) {
      filesFound++;
      
      // Determine if we should move this file
      let shouldMove = false;
      if (file === 'signature.jpg') {
        shouldMove = false;
      } else if (isPasswordRecovery && (file === 'idCard.jpg' || file === 'idCardBack.jpg')) {
        shouldMove = false;
      } else if (file === 'passport.jpg' || file === 'idCard.jpg' || file === 'idCardBack.jpg' || file === 'contract.jpg' || file === 'providerIdCard.jpg' || file === 'guarantorPassport.jpg' || file.endsWith('.pdf')) {
        // Includes all document photos and scan-copy PDFs
        shouldMove = true;
      } else if (file.endsWith('.jpg') || file.endsWith('.png')) {
        shouldMove = true; // Any other leftover photo
      }
      
      if (shouldMove) {
        const sourcePath = path.join(folderPath, file);
        const targetFolder = path.join(BACKUP_DIR, folder);
        if (!fs.existsSync(targetFolder)) {
          fs.mkdirSync(targetFolder, { recursive: true });
        }
        const targetPath = path.join(targetFolder, file);
        
        try {
          fs.renameSync(sourcePath, targetPath);
          filesMoved++;
          folderHasMovedFile = true;
        } catch (e) {
          console.error(`Failed to move ${sourcePath}:`, e.message);
        }
      }
    }
    
    if (folderHasMovedFile) foldersAffected++;
  }
}

console.log("Cleanup Report:");
console.log("===============================");
console.log(`Total files found: ${filesFound}`);
console.log(`Files moved to backup: ${filesMoved}`);
console.log(`Folders affected: ${foldersAffected}`);
console.log(`Backup Location: ${BACKUP_DIR}`);
console.log("===============================");
