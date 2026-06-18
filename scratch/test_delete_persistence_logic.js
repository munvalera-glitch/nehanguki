import fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PACKAGES_ORIG = resolve("data", "packages.json");
const DB_PACKAGES_TEST = resolve("scratch", "packages_test.json");

// Copy database to sandbox
if (fs.existsSync(DB_PACKAGES_ORIG)) {
  fs.mkdirSync(resolve("scratch"), { recursive: true });
  fs.copyFileSync(DB_PACKAGES_ORIG, DB_PACKAGES_TEST);
} else {
  console.error("Original packages.json not found!");
  process.exit(1);
}

// Emulate readDb and writeDb
function readDb(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}
function writeDb(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// Emulate the DELETE endpoint logic
function handleDeletePackage(req, res) {
  // 1. Auth check
  if (!req.isAuthenticated()) {
    return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
  }

  const packageId = req.params.id;
  if (!packageId) {
    return res.status(400).json({ ok: false, error: "PACKAGE_ID_REQUIRED" });
  }

  const db = readDb(DB_PACKAGES_TEST);
  db.packages = db.packages || [];

  const pkgIndex = db.packages.findIndex(p => p.id === packageId);
  if (pkgIndex === -1) {
    return res.status(404).json({ ok: false, error: "PACKAGE_NOT_FOUND" });
  }

  const pkg = db.packages[pkgIndex];

  if (pkg.userId !== req.user.id) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN", message: "You are not authorized to delete this package." });
  }

  if (pkg.paymentStatus === "paid") {
    return res.status(400).json({ ok: false, error: "CANNOT_DELETE_PAID_PACKAGE", message: "Paid orders cannot be deleted." });
  }

  db.packages.splice(pkgIndex, 1);
  writeDb(DB_PACKAGES_TEST, db);

  return res.status(200).json({ ok: true, message: "Package deleted successfully" });
}

// Helper to create mock response
function createMockResponse() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    }
  };
  return response;
}

// --- TEST RUNS ---

console.log("Running Delete Persistence Logic Tests...");

const dbBefore = readDb(DB_PACKAGES_TEST);
const sampleUnpaid = dbBefore.packages.find(p => p.paymentStatus !== "paid");
const samplePaid = dbBefore.packages.find(p => p.paymentStatus === "paid");

if (!sampleUnpaid || !samplePaid) {
  console.error("Missing test data: need at least 1 unpaid and 1 paid package in DB");
  process.exit(1);
}

// Test Case 1: Unpaid package belonging to user is deleted successfully.
console.log("\n[TEST 1] Deleting unpaid package belonging to user...");
const req1 = {
  isAuthenticated: () => true,
  user: { id: sampleUnpaid.userId },
  params: { id: sampleUnpaid.id }
};
const res1 = createMockResponse();
handleDeletePackage(req1, res1);

console.log("Response status:", res1.statusCode);
console.log("Response body:", res1.body);

if (res1.statusCode === 200 && res1.body.ok === true) {
  console.log("✅ TEST 1 PASSED: Unpaid package deleted successfully.");
} else {
  console.error("❌ TEST 1 FAILED!");
}

// Verify deletion in sandbox DB
const dbAfter1 = readDb(DB_PACKAGES_TEST);
const foundInDb1 = dbAfter1.packages.some(p => p.id === sampleUnpaid.id);
if (!foundInDb1) {
  console.log("✅ Sandbox DB confirmed deletion of package.");
} else {
  console.error("❌ Sandbox DB still contains package!");
}

// Test Case 2: Package belonging to another user fails with FORBIDDEN (403)
console.log("\n[TEST 2] Deleting package belonging to another user...");
const req2 = {
  isAuthenticated: () => true,
  user: { id: "some-other-user-id" },
  params: { id: samplePaid.id }
};
const res2 = createMockResponse();
handleDeletePackage(req2, res2);

console.log("Response status:", res2.statusCode);
console.log("Response body:", res2.body);

if (res2.statusCode === 403 && res2.body.error === "FORBIDDEN") {
  console.log("✅ TEST 2 PASSED: Correctly forbidden to delete another user's package.");
} else {
  console.error("❌ TEST 2 FAILED!");
}

// Test Case 3: Paid package belonging to user fails with CANNOT_DELETE_PAID_PACKAGE (400)
console.log("\n[TEST 3] Deleting paid package belonging to user...");
const req3 = {
  isAuthenticated: () => true,
  user: { id: samplePaid.userId },
  params: { id: samplePaid.id }
};
const res3 = createMockResponse();
handleDeletePackage(req3, res3);

console.log("Response status:", res3.statusCode);
console.log("Response body:", res3.body);

if (res3.statusCode === 400 && res3.body.error === "CANNOT_DELETE_PAID_PACKAGE") {
  console.log("✅ TEST 3 PASSED: Correctly blocked deleting a paid package.");
} else {
  console.error("❌ TEST 3 FAILED!");
}

// Cleanup sandbox
try {
  fs.unlinkSync(DB_PACKAGES_TEST);
} catch {}
console.log("\nCleanup completed.");
