// course-module-tracker.js - COMPLETE MODULE & COURSE TRACKER
import { auth, db, doc, getDoc, updateDoc, setDoc } from '/universal-auth.js';

const STORAGE_KEY = 'aa_module_progress_v2';

// Wait for user authentication
async function waitForAuth(maxWait = 5000) {
  const start = Date.now();
  while (!auth.currentUser && (Date.now() - start) < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return auth.currentUser;
}

// Get progress from localStorage
function getLocalProgress() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { modules: {}, courses: {} };
  } catch (e) {
    console.error('[AA] localStorage parse error:', e);
    return { modules: {}, courses: {} };
  }
}

// Save progress to localStorage
function saveLocalProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('[AA] localStorage save error:', e);
  }
}

// Sync with Firestore (Firestore = source of truth)
async function syncWithFirestore(userId) {
  try {
    const userRef = doc(db, 'Users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const firestoreModules = userData.completedModuleIds || [];
      const firestoreCourses = userData.completedCourseIds || [];
      
      const synced = {
        modules: {},
        courses: {}
      };
      
      firestoreModules.forEach(id => { synced.modules[id] = true; });
      firestoreCourses.forEach(id => { synced.courses[id] = true; });
      
      saveLocalProgress(synced);
      console.log('[AA] Synced with Firestore:', firestoreModules.length, 'modules');
      return synced;
    }
  } catch (error) {
    console.error('[AA] Firestore sync error:', error);
  }
  
  return getLocalProgress();
}

// Update button visual state
function updateButtonState(button, isCompleted) {
  const primarySpan = button.querySelector('.aa-pill-primary');
  const secondarySpan = button.querySelector('.aa-pill-secondary');
  
  if (!primarySpan || !secondarySpan) {
    console.warn('[AA] Button missing required spans:', button);
    return;
  }

  if (isCompleted) {
    button.classList.add('completed');
    primarySpan.textContent = '✓ Module Completed';
    secondarySpan.style.display = 'none';
  } else {
    button.classList.remove('completed');
    primarySpan.textContent = 'Complete Module';
    secondarySpan.textContent = '+50 XP';
    secondarySpan.style.display = 'inline';
  }
}

// Check if all modules on current page are complete
async function checkPageCompletion(courseId) {
  const user = auth.currentUser;
  if (!user) return;

  const buttons = document.querySelectorAll('.aa-pill-button');
  const allComplete = Array.from(buttons).every(btn => btn.classList.contains('completed'));
  
  if (!allComplete) return;

  // Check if course already completed in Firestore
  try {
    const userRef = doc(db, 'Users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const completedCourses = userSnap.data().completedCourseIds || [];
      if (completedCourses.includes(courseId)) {
        console.log('[AA] Course already completed:', courseId);
        return; // Don't fire event again
      }
    }

    // Mark course as complete in local storage
    const progress = getLocalProgress();
    const pageKey = `__page_${courseId}_${window.location.pathname}`;
    if (!progress.courses[pageKey]) {
      progress.courses[pageKey] = true;
      saveLocalProgress(progress);
      
      // Fire course completion event
      console.log('[AA] 🎉 All modules complete! Dispatching course completion event');
      document.dispatchEvent(new CustomEvent('aa:courseComplete', {
        detail: { courseId, moduleCount: buttons.length }
      }));
    }
  } catch (error) {
    console.error('[AA] Error checking course completion:', error);
  }
}

// Handle button click
async function handleButtonClick(e) {
  e.preventDefault();
  
  const button = e.currentTarget;
  const moduleId = button.dataset.moduleId;
  const courseId = button.dataset.courseId || document.body.dataset.aaCourse || 'unknown-course';
  
  if (!moduleId) {
    console.error('[AA] Button missing data-module-id');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.error('[AA] User not authenticated');
    return;
  }

  const fullModuleId = `${courseId}/${moduleId}`;
  const progress = getLocalProgress();
  const wasCompleted = progress.modules[fullModuleId] || false;
  const nowCompleted = !wasCompleted;

  // Update localStorage
  progress.modules[fullModuleId] = nowCompleted;
  saveLocalProgress(progress);

  // Update button UI immediately
  updateButtonState(button, nowCompleted);

  console.log(`[AA] Button clicked: ${courseId} / ${moduleId} - toggle to: ${nowCompleted}`);

  // Dispatch event for XP system
  document.dispatchEvent(new CustomEvent('aa:moduleToggle', {
    detail: {
      courseId,
      moduleId,
      fullModuleId,
      completed: nowCompleted
    }
  }));

  // Check if all modules on page are now complete
  if (nowCompleted) {
    setTimeout(() => checkPageCompletion(courseId), 500);
  }
}

// Initialize module tracker
async function initModuleTracker() {
  console.log('[AA] Module tracker initializing...');
  
  const user = await waitForAuth();
  if (!user) {
    console.error('[AA] No user authenticated');
    return;
  }

  console.log('[AA] User authenticated:', user.uid);
  
  // ✅ Set window.currentUser for XP listener
  window.currentUser = user;

  // Sync with Firestore
  const progress = await syncWithFirestore(user.uid);

  // Find all module buttons
  const buttons = document.querySelectorAll('.aa-pill-button');
  console.log('[AA] Found', buttons.length, 'module buttons');

  if (buttons.length === 0) {
    console.warn('[AA] No .aa-pill-button elements found on page');
    return;
  }

  // Get course ID from body or first button
  const courseIdFromBody = document.body.dataset.aaCourse;
  const courseIdFromButton = buttons[0]?.dataset.courseId;
  const courseId = courseIdFromBody || courseIdFromButton || 'unknown-course';

  console.log('[AA] Course ID:', courseId);

  // Assign course ID to all buttons if not set
  buttons.forEach((button, index) => {
    if (!button.dataset.courseId) {
      button.dataset.courseId = courseId;
    }

    // Auto-generate module ID if missing
    if (!button.dataset.moduleId) {
      button.dataset.moduleId = `module-${index + 1}`;
      console.warn('[AA] Auto-generated moduleId for button:', button.dataset.moduleId);
    }

    const fullModuleId = `${button.dataset.courseId}/${button.dataset.moduleId}`;
    const isCompleted = progress.modules[fullModuleId] || false;

    // Set initial button state
    updateButtonState(button, isCompleted);

    // Add click handler
    button.addEventListener('click', handleButtonClick);
  });

  console.log('[AA] Module tracker initialized successfully');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModuleTracker);
} else {
  initModuleTracker();
}

// Export helper for other pages
export function getStoredCourseProgress() {
  return getLocalProgress();
}