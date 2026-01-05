// affiliate-setup.js
// One-time setup script to initialize affiliate system

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { 
    getFirestore, 
    collection,
    doc,
    setDoc,
    getDocs,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAK9MheMvSeOpscic4lXUsIwa0J5ubVf6w",
    authDomain: "arcane-archives-3b0f5.firebaseapp.com",
    projectId: "arcane-archives-3b0f5",
    storageBucket: "arcane-archives-3b0f5.firebasestorage.app",
    messagingSenderId: "264237235055",
    appId: "1:264237235055:web:4a2e5605b0ffb5307f069a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Affiliate System Setup & Migration Script
 * Run this once to initialize the affiliate system
 */

class AffiliateSetup {
    constructor() {
        this.stats = {
            usersProcessed: 0,
            affiliatesCreated: 0,
            referralCodesGenerated: 0,
            errors: []
        };
    }

    /**
     * Main setup function
     */
    async setup() {
        console.log('🚀 Starting Affiliate System Setup...\n');

        try {
            // Step 1: Generate referral codes for existing users
            await this.generateReferralCodes();

            // Step 2: Initialize affiliate profiles for users with referrals
            await this.initializeAffiliateProfiles();

            // Step 3: Verify database structure
            await this.verifyDatabaseStructure();

            // Step 4: Print summary
            this.printSummary();

            console.log('\n✅ Setup Complete!\n');

        } catch (error) {
            console.error('❌ Setup failed:', error);
        }
    }

    /**
     * Step 1: Generate referral codes for all existing users
     */
    async generateReferralCodes() {
        console.log('📝 Step 1: Generating referral codes...');

        const usersSnapshot = await getDocs(collection(db, 'Users'));
        const updates = [];

        for (const userDoc of usersSnapshot.docs) {
            const data = userDoc.data();
            const userId = userDoc.id;

            // Skip if already has referral code
            if (data.referralCode) {
                console.log(`  ⏭️  ${data.Username || userId} already has code: ${data.referralCode}`);
                continue;
            }

            // Generate unique referral code
            const referralCode = this.generateUniqueCode(userId);

            // Update user document
            updates.push(
                updateDoc(doc(db, 'Users', userId), {
                    referralCode: referralCode,
                    referralCodeGeneratedAt: serverTimestamp()
                })
            );

            this.stats.referralCodesGenerated++;
            console.log(`  ✅ ${data.Username || userId} → ${referralCode}`);
        }

        await Promise.all(updates);
        console.log(`\n  Generated ${this.stats.referralCodesGenerated} referral codes\n`);
    }

    /**
     * Step 2: Initialize affiliate profiles for users who have referrals
     */
    async initializeAffiliateProfiles() {
        console.log('👥 Step 2: Initializing affiliate profiles...');

        const usersSnapshot = await getDocs(collection(db, 'Users'));
        const referralCounts = {};

        // Count referrals per user
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.referredBy) {
                referralCounts[data.referredBy] = (referralCounts[data.referredBy] || 0) + 1;
            }
        });

        // Create affiliate profiles for users with referrals
        const updates = [];

        for (const userDoc of usersSnapshot.docs) {
            const data = userDoc.data();
            const userId = userDoc.id;
            const referralCode = data.referralCode;

            // Skip if no referrals
            if (!referralCounts[referralCode]) {
                continue;
            }

            // Check if affiliate profile already exists
            const affiliateRef = doc(db, 'Affiliates', userId);
            
            // Create affiliate profile
            updates.push(
                setDoc(affiliateRef, {
                    userId: userId,
                    referralCode: referralCode,
                    availableBalance: 0,
                    pendingBalance: 0,
                    totalEarnings: 0,
                    totalWithdrawn: 0,
                    activeReferrals: 0,
                    totalReferrals: referralCounts[referralCode],
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp()
                }, { merge: true })
            );

            this.stats.affiliatesCreated++;
            console.log(`  ✅ Created affiliate profile for ${data.Username || userId} (${referralCounts[referralCode]} referrals)`);
        }

        await Promise.all(updates);
        console.log(`\n  Created ${this.stats.affiliatesCreated} affiliate profiles\n`);
    }

    /**
     * Step 3: Verify database structure
     */
    async verifyDatabaseStructure() {
        console.log('🔍 Step 3: Verifying database structure...');

        const collections = [
            'Affiliates',
            'WithdrawalRequests',
            'CommissionHistory',
            'TradeRebates'
        ];

        for (const collectionName of collections) {
            const snapshot = await getDocs(collection(db, collectionName));
            console.log(`  ✅ ${collectionName}: ${snapshot.size} documents`);
        }

        console.log();
    }

    /**
     * Generate unique referral code
     */
    generateUniqueCode(userId) {
        // Use first 8 characters of UID in uppercase
        // Format: XXXX-YYYY
        const code = userId.slice(0, 8).toUpperCase();
        return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    }

    /**
     * Print setup summary
     */
    printSummary() {
        console.log('📊 Setup Summary:');
        console.log('─'.repeat(50));
        console.log(`  Referral Codes Generated: ${this.stats.referralCodesGenerated}`);
        console.log(`  Affiliate Profiles Created: ${this.stats.affiliatesCreated}`);
        console.log(`  Errors: ${this.stats.errors.length}`);
        console.log('─'.repeat(50));

        if (this.stats.errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            this.stats.errors.forEach(error => {
                console.log(`  - ${error}`);
            });
        }
    }

    /**
     * Calculate and backfill commissions for existing affiliates
     * WARNING: Only run this once during initial setup
     */
    async backfillCommissions() {
        console.log('\n💰 Backfilling commissions for existing referrals...');

        const usersSnapshot = await getDocs(collection(db, 'Users'));
        const affiliateEarnings = {};

        // Calculate what each affiliate should have earned
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const referralCode = data.referredBy;
            const isActive = data.subscriptionStatus === 'active' || data.isPaid === true;

            if (referralCode && isActive) {
                if (!affiliateEarnings[referralCode]) {
                    affiliateEarnings[referralCode] = {
                        count: 0,
                        amount: 0
                    };
                }
                affiliateEarnings[referralCode].count++;
                affiliateEarnings[referralCode].amount += 25; // £25 per active member
            }
        });

        // Update affiliate balances
        for (const [referralCode, earnings] of Object.entries(affiliateEarnings)) {
            // Find user with this referral code
            const usersQuery = await getDocs(collection(db, 'Users'));
            let affiliateId = null;

            usersQuery.forEach(doc => {
                if (doc.data().referralCode === referralCode) {
                    affiliateId = doc.id;
                }
            });

            if (!affiliateId) continue;

            // Update affiliate balance
            const affiliateRef = doc(db, 'Affiliates', affiliateId);
            await updateDoc(affiliateRef, {
                availableBalance: earnings.amount,
                totalEarnings: earnings.amount,
                activeReferrals: earnings.count
            });

            console.log(`  ✅ ${referralCode}: £${earnings.amount} (${earnings.count} active members)`);
        }

        console.log('\n  ✅ Commissions backfilled\n');
    }
}

// Export for use
export const affiliateSetup = new AffiliateSetup();

// If running directly in console
if (typeof window !== 'undefined') {
    window.affiliateSetup = affiliateSetup;
    console.log('💡 Affiliate setup loaded. Run: affiliateSetup.setup()');
}

export default AffiliateSetup;