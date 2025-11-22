// xp-system.js - Universal XP Management System
import { db } from './universal-auth.js';
import { 
    doc, 
    updateDoc, 
    getDoc,
    increment,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// XP Awards for different actions
export const XP_VALUES = {
    WIN_POSTED: 50,          // Win posted and approved by admin
    COURSE_COMPLETED: 100,   // Complete a course
    CALL_ATTENDED: 75,       // Attend a live call
    DAILY_LOGIN: 10,         // Daily login bonus
    COMMUNITY_MESSAGE: 5,    // Post in community (max 50/day)
    PROFILE_COMPLETE: 50     // Complete profile setup
};

// Level thresholds
export const LEVELS = [
    { name: 'Apprentice', minXp: 0, maxXp: 499 },
    { name: 'Initiate', minXp: 500, maxXp: 1499 },
    { name: 'Disciple', minXp: 1500, maxXp: 2999 },
    { name: 'Adept', minXp: 3000, maxXp: 5999 },
    { name: 'Master', minXp: 6000, maxXp: 9999 },
    { name: 'Grandmaster', minXp: 10000, maxXp: 19999 },
    { name: 'Legend', minXp: 20000, maxXp: Infinity }
];

/**
 * Award XP to a user and update their level
 */
export async function awardXP(userId, xpAmount, reason = '') {
    try {
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            console.error('User not found');
            return null;
        }

        const currentXp = userSnap.data().Xp || 0;
        const newXp = currentXp + xpAmount;
        const newLevel = calculateLevel(newXp);

        await updateDoc(userRef, {
            Xp: newXp,
            Level: newLevel
        });

        console.log(`✅ Awarded ${xpAmount} XP to user. Reason: ${reason}. New total: ${newXp}`);
        
        return {
            oldXp: currentXp,
            newXp: newXp,
            xpAwarded: xpAmount,
            level: newLevel,
            leveledUp: calculateLevel(currentXp) !== newLevel
        };
    } catch (error) {
        console.error('Error awarding XP:', error);
        return null;
    }
}

/**
 * Calculate level based on XP
 */
export function calculateLevel(xp) {
    for (const level of LEVELS) {
        if (xp >= level.minXp && xp <= level.maxXp) {
            return level.name;
        }
    }
    return 'Apprentice';
}

/**
 * Get XP progress for current level
 */
export function getLevelProgress(xp) {
    const currentLevel = LEVELS.find(l => xp >= l.minXp && xp <= l.maxXp);
    if (!currentLevel) return { progress: 0, xpInLevel: 0, xpNeeded: 0 };

    const xpInLevel = xp - currentLevel.minXp;
    const xpNeeded = currentLevel.maxXp - currentLevel.minXp;
    const progress = Math.min((xpInLevel / xpNeeded) * 100, 100);

    return {
        progress: Math.round(progress),
        xpInLevel,
        xpNeeded,
        currentLevel: currentLevel.name,
        nextLevel: getNextLevel(currentLevel.name)
    };
}

/**
 * Get next level name
 */
function getNextLevel(currentLevelName) {
    const currentIndex = LEVELS.findIndex(l => l.name === currentLevelName);
    if (currentIndex === -1 || currentIndex === LEVELS.length - 1) {
        return null;
    }
    return LEVELS[currentIndex + 1].name;
}

/**
 * Track course completion
 */
export async function completeCourse(userId, courseId, courseName) {
    try {
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            console.error('User not found');
            return null;
        }

        const userData = userSnap.data();
        const completedCourses = userData.completedCourses || [];
        
        // Check if already completed
        if (completedCourses.includes(courseId)) {
            console.log('Course already completed');
            return null;
        }

        // Add to completed courses
        completedCourses.push(courseId);

        // Update user data
        await updateDoc(userRef, {
            completedCourses: completedCourses,
            CoursesCompleted: increment(1)
        });

        // Award XP
        const result = await awardXP(userId, XP_VALUES.COURSE_COMPLETED, `Completed course: ${courseName}`);

        console.log(`✅ Course completed: ${courseName}`);
        
        return {
            ...result,
            totalCoursesCompleted: completedCourses.length,
            courseId,
            courseName
        };
    } catch (error) {
        console.error('Error completing course:', error);
        return null;
    }
}

/**
 * Check if course is completed
 */
export async function isCourseCompleted(userId, courseId) {
    try {
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return false;
        }

        const completedCourses = userSnap.data().completedCourses || [];
        return completedCourses.includes(courseId);
    } catch (error) {
        console.error('Error checking course completion:', error);
        return false;
    }
}

/**
 * Get all user stats
 */
export async function getUserStats(userId) {
    try {
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return null;
        }

        const userData = userSnap.data();
        const xp = userData.Xp || 0;
        const completedCourses = userData.completedCourses || [];
        
        return {
            xp,
            level: userData.Level || 'Apprentice',
            levelProgress: getLevelProgress(xp),
            coursesCompleted: completedCourses.length,
            winsPosted: userData.WinsPosted || 0,
            callsAttended: userData.CallAttended || 0,
            completedCourseIds: completedCourses
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return null;
    }
}

/**
 * Track daily login and award XP (once per day)
 */
export async function trackDailyLogin(userId) {
    try {
        const userRef = doc(db, 'Users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return null;
        }

        const userData = userSnap.data();
        const lastLogin = userData.lastLoginDate;
        const today = new Date().toDateString();

        // Check if already logged in today
        if (lastLogin && new Date(lastLogin.toDate()).toDateString() === today) {
            console.log('Already logged in today');
            return null;
        }

        // Award daily login XP
        await updateDoc(userRef, {
            lastLoginDate: new Date()
        });

        return await awardXP(userId, XP_VALUES.DAILY_LOGIN, 'Daily login bonus');
    } catch (error) {
        console.error('Error tracking daily login:', error);
        return null;
    }
}

/**
 * Initialize XP display on page
 */
export function initXPDisplay(containerId, userId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    getUserStats(userId).then(stats => {
        if (!stats) return;

        const progress = stats.levelProgress;
        container.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgba(147, 51, 234, 0.15), rgba(15, 23, 42, 0.95));
                border: 1px solid rgba(147, 51, 234, 0.6);
                border-radius: 16px;
                padding: 1.2rem;
                margin: 1rem 0;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                    <div>
                        <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: #a3a3a3;">Level</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: #fbbf24;">${stats.level}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: #a3a3a3;">XP</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: #a78bfa;">${stats.xp.toLocaleString()}</div>
                    </div>
                </div>
                
                <div style="background: rgba(15, 23, 42, 0.8); border-radius: 999px; height: 12px; overflow: hidden; margin-bottom: 0.5rem;">
                    <div style="
                        background: linear-gradient(90deg, #9333ea, #a78bfa);
                        height: 100%;
                        width: ${progress.progress}%;
                        transition: width 0.5s ease;
                    "></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #a3a3a3;">
                    <span>${progress.xpInLevel.toLocaleString()} / ${progress.xpNeeded.toLocaleString()} XP</span>
                    <span>${progress.progress}%</span>
                </div>
                
                ${progress.nextLevel ? `
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #a3a3a3; text-align: center;">
                        Next: ${progress.nextLevel}
                    </div>
                ` : ''}
            </div>
        `;
    });
}