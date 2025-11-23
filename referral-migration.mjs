// referral-migration.js
// Run this ONCE to fix your existing Firebase data and add referral tracking

import { db } from './universal-auth.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc,
    setDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

async function migrateUserData() {
    console.log('🔄 Starting user data migration...');
    
    try {
        const usersRef = collection(db, 'Users');
        const snapshot = await getDocs(usersRef);
        
        let updated = 0;
        let errors = 0;

        for (const userDoc of snapshot.docs) {
            try {
                const userId = userDoc.id;
                const data = userDoc.data();
                
                // Prepare updates
                const updates = {};
                
                // Ensure all XP/Level fields use capital letters (consistent with user-init.js)
                if (data.xp !== undefined && data.Xp === undefined) {
                    updates.Xp = data.xp;
                }
                
                if (data.level !== undefined && data.Level === undefined) {
                    updates.Level = data.level;
                }
                
                if (data.winsPosted !== undefined && data.WinsPosted === undefined) {
                    updates.WinsPosted = data.winsPosted;
                }
                
                if (data.callsAttended !== undefined && data.CallAttended === undefined) {
                    updates.CallAttended = data.callsAttended;
                }
                
                if (data.coursesCompleted !== undefined && data.CoursesCompleted === undefined) {
                    updates.CoursesCompleted = data.coursesCompleted;
                }
                
                if (data.modulesCompleted !== undefined && data.ModulesCompleted === undefined) {
                    updates.ModulesCompleted = data.modulesCompleted;
                }
                
                // Add referral code if missing (first 8 chars of UID)
                if (!data.referralCode) {
                    updates.referralCode = userId.slice(0, 8).toUpperCase();
                }
                
                // Ensure completedCourseIds and completedModuleIds exist
                if (!data.completedCourseIds) {
                    updates.completedCourseIds = [];
                }
                
                if (!data.completedModuleIds) {
                    updates.completedModuleIds = [];
                }
                
                // Only update if there are changes
                if (Object.keys(updates).length > 0) {
                    const userRef = doc(db, 'Users', userId);
                    await setDoc(userRef, updates, { merge: true });
                    updated++;
                    console.log(`✅ Updated user ${data.Username || userId}`);
                }
                
            } catch (err) {
                console.error(`❌ Error updating user ${userDoc.id}:`, err);
                errors++;
            }
        }
        
        console.log(`\n🎉 Migration complete!`);
        console.log(`✅ Updated: ${updated} users`);
        console.log(`❌ Errors: ${errors}`);
        
        return { updated, errors };
        
    } catch (err) {
        console.error('❌ Migration failed:', err);
        throw err;
    }
}

// Function to manually trigger referral XP award (if needed)
async function awardReferralXP(referrerId, referredUserId) {
    try {
        const referrerRef = doc(db, 'Users', referrerId);
        const referredRef = doc(db, 'Users', referredUserId);
        
        const [referrerSnap, referredSnap] = await Promise.all([
            getDoc(referrerRef),
            getDoc(referredRef)
        ]);
        
        if (!referrerSnap.exists() || !referredSnap.exists()) {
            console.error('User not found');
            return;
        }
        
        const referredData = referredSnap.data();
        const isActive = referredData.subscriptionStatus === 'active' || referredData.isPaid === true;
        
        const xpToAward = isActive ? 250 : 50; // 50 for signup, 200 bonus for active
        
        const referrerData = referrerSnap.data();
        const currentXP = referrerData.Xp || 0;
        const newXP = currentXP + xpToAward;
        
        // Update referrer's XP
        await updateDoc(referrerRef, {
            Xp: newXP,
            Level: getLevelFromXP(newXP)
        });
        
        console.log(`✅ Awarded ${xpToAward} XP to referrer ${referrerData.Username}`);
        
    } catch (err) {
        console.error('Error awarding referral XP:', err);
    }
}

function getLevelFromXP(xp) {
    if (xp >= 5000) return "Archmage";
    if (xp >= 3000) return "Master";
    if (xp >= 1500) return "Adept";
    if (xp >= 500) return "Scholar";
    return "Apprentice";
}

// Export functions
export { migrateUserData, awardReferralXP };

// Auto-run migration if this script is loaded directly
if (typeof window !== 'undefined') {
    console.log('⚠️ Run migrateUserData() in the console to fix your data');
    window.migrateUserData = migrateUserData;
    window.awardReferralXP = awardReferralXP;
}