// referral-migration-admin.js
// Node-only migration script for XP, Level & Referral fixes

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Init Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Level calculator
function getLevelFromXP(xp) {
  if (xp >= 5000) return "Archmage";
  if (xp >= 3000) return "Master";
  if (xp >= 1500) return "Adept";
  if (xp >= 500) return "Scholar";
  return "Apprentice";
}

// Migration
async function migrate() {
  console.log("🔄 Starting migration...");

  const users = await db.collection("Users").get();

  let updated = 0;
  let errors = 0;

  for (const docSnap of users.docs) {
    const userId = docSnap.id;
    const data = docSnap.data();
    const updates = {};

    try {
      // XP normalisation
      const xp =
        typeof data.Xp === "number"
          ? data.Xp
          : typeof data.xp === "number"
          ? data.xp
          : 0;

      updates.Xp = xp;
      updates.Level = getLevelFromXP(xp);

      // Referral code
      const correctRefCode = userId.slice(0, 8).toUpperCase();
      if (data.referralCode !== correctRefCode) {
        updates.referralCode = correctRefCode;
      }

      // Fix lowercase → Uppercase
      if (data.winsPosted && !data.WinsPosted) updates.WinsPosted = data.winsPosted;
      if (data.callsAttended && !data.CallAttended)
        updates.CallAttended = data.callsAttended;
      if (data.coursesCompleted && !data.CoursesCompleted)
        updates.CoursesCompleted = data.coursesCompleted;

      // Ensure arrays exist
      if (!Array.isArray(data.completedCourseIds))
        updates.completedCourseIds = [];
      if (!Array.isArray(data.completedModuleIds))
        updates.completedModuleIds = [];

      await docSnap.ref.set(updates, { merge: true });
      updated++;
      console.log("✅ Updated:", userId, updates);
    } catch (err) {
      console.error("❌ Error:", userId, err);
      errors++;
    }
  }

  console.log("\n🎉 Migration Complete");
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  process.exit(0);
}

migrate();
