// referral-migration-admin.js
// Node-only migration script for XP, Level & Referral fixes
//
// Usage (from project root):
//   node referral-migration-admin.js

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// -------------------------
//  Firebase Admin Init
// -------------------------
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// -------------------------
//  Arcane Archives Levels
// -------------------------
// Seeker → Apprentice → Advanced Apprentice → Awakened Apprentice → Awakened Master → Arcane Master
function getLevelFromXP(xp) {
  if (xp >= 5000) return "Arcane Master";
  if (xp >= 3000) return "Awakened Master";
  if (xp >= 1500) return "Awakened Apprentice";
  if (xp >= 600)  return "Advanced Apprentice";
  if (xp >= 200)  return "Apprentice";
  return "Seeker";
}

// -------------------------
//  Main Migration
// -------------------------
async function migrate() {
  console.log("🚀 Starting referral / XP migration…");

  const usersSnap = await db.collection("Users").get();
  console.log(`Found ${usersSnap.size} users\n`);

  let updated = 0;
  let errors = 0;

  for (const docSnap of usersSnap.docs) {
    const userId = docSnap.id;
    const data = docSnap.data() || {};
    const updates = {};

    try {
      // 1) Normalise XP field: prefer Xp, fallback to xp, else 0
      let xp = 0;

      if (typeof data.Xp === "number") {
        xp = data.Xp;
      } else if (typeof data.xp === "number") {
        xp = data.xp;
        updates.Xp = xp;
        updates.xp = FieldValue.delete(); // remove old lowercase field
      } else {
        xp = 0;
        updates.Xp = 0;
      }

      // 2) Recalculate Level from XP using NEW hierarchy
      const level = getLevelFromXP(xp);
      if (data.Level !== level) {
        updates.Level = level;
      }

      // 3) Ensure completion counters exist
      if (typeof data.CoursesCompleted !== "number") {
        updates.CoursesCompleted =
          typeof data.coursesCompleted === "number"
            ? data.coursesCompleted
            : 0;
      }

      if (typeof data.ModulesCompleted !== "number") {
        updates.ModulesCompleted =
          typeof data.modulesCompleted === "number"
            ? data.modulesCompleted
            : 0;
      }

      // 4) Ensure completion ID arrays exist
      if (!Array.isArray(data.completedCourseIds)) {
        updates.completedCourseIds = [];
      }

      if (!Array.isArray(data.completedModuleIds)) {
        updates.completedModuleIds = [];
      }

      // 5) Normalise referralCode + referredBy
      const existingReferralCode = data.referralCode;
      const safeReferralCode =
        typeof existingReferralCode === "string" &&
        existingReferralCode.trim().length > 0
          ? existingReferralCode.trim().toUpperCase()
          : userId.slice(0, 8).toUpperCase();

      if (existingReferralCode !== safeReferralCode) {
        updates.referralCode = safeReferralCode;
      }

      // Fix bad casing on referredBy if needed
      if (!data.referredBy && typeof data.referredby === "string") {
        updates.referredBy = data.referredby;
      }

      // 6) Timestamps
      updates.updatedAt = FieldValue.serverTimestamp();

      // If there is nothing to change, skip
      const keys = Object.keys(updates);
      if (keys.length === 1 && keys[0] === "updatedAt") {
        console.log(`⚪ Skipped (no changes): ${userId}`);
        continue;
      }

      await db.collection("Users").doc(userId).set(updates, { merge: true });
      updated++;
      console.log("✅ Updated:", userId, updates);
    } catch (err) {
      errors++;
      console.error("❌ Error updating", userId, err);
    }
  }

  console.log("\n🎉 Migration complete");
  console.log(`Users updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  process.exit(0);
}

migrate();
