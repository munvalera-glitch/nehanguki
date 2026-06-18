import fs from "fs";
import { resolve } from "path";

const DB_PACKAGES = resolve("data", "packages.json");
if (!fs.existsSync(DB_PACKAGES)) {
  console.log("packages.json does not exist!");
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(DB_PACKAGES, "utf8"));
const packages = db.packages || [];

console.log("=== DB PACKAGES STATS ===");
console.log("Total packages in DB:", packages.length);

const unpaid = packages.filter(p => p.paymentStatus !== "paid");
const paid = packages.filter(p => p.paymentStatus === "paid");

console.log("Unpaid Packages count:", unpaid.length);
console.log("Paid Packages count:", paid.length);

if (unpaid.length > 0) {
  console.log("\nSample Unpaid Package:");
  console.log(JSON.stringify(unpaid[0], null, 2));
}

if (paid.length > 0) {
  console.log("\nSample Paid Package:");
  console.log(JSON.stringify(paid[0], null, 2));
}
