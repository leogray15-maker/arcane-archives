// course-module-tracker.js
// Universal module completion tracker for all Notion-exported course pages

import { protectPage, db } from "./auth-guard.js";
import { markModuleCompleted, markCourseCompleted, getUserStats, XP_REWARDS } from "./xp-system.js";

let currentUser = null;
let currentCourseId = null;
let completedModules = [];

// Initialize the module tracker
export async function initModuleTracker(courseId) {
  if (!courseId) {
    console.warn("No courseId provided to initModuleTracker");
    return;
  }

  currentCourseId = courseId;

  protectPage({
    onSuccess: async (user, userData) => {
      currentUser = user;
      
      // Get user's completed modules
      const stats = await getUserStats(user.uid);
      completedModules = stats.completedModuleIds || [];

      // Find all modules on the page and add completion buttons
      injectCompletionButtons();
      
      // Update UI to show which modules are already completed
      markCompletedModules();

      // Show course progress
      displayCourseProgress();
    },
    onFailure: () => {
      window.location.href = "login.html";
    }
  });
}

// Find all module sections and inject "Complete Module" buttons
function injectCompletionButtons() {
  // Different strategies to find modules depending on Notion export structure
  
  // Strategy 1: Look for h3 headings (common module headers)
  const h3Headers = document.querySelectorAll('h3[id]');
  h3Headers.forEach(header => {
    const moduleId = header.getAttribute('id');
    if (moduleId && !hasCompleteButton(header)) {
      injectButtonAfter(header, moduleId);
    }
  });

  // Strategy 2: Look for sections with class "notion-text-block" or similar
  const sections = document.querySelectorAll('.notion-page-section, .notion-text-block');
  sections.forEach((section, index) => {
    const sectionId = section.getAttribute('id') || `section-${index}`;
    if (!hasCompleteButton(section)) {
      const header = section.querySelector('h1, h2, h3, h4');
      if (header) {
        injectButtonAfter(header, sectionId);
      }
    }
  });

  // Strategy 3: Look for specific Notion block types
  const blocks = document.querySelectorAll('[class*="block-"], .notion-toggle-block, .notion-callout-block');
  blocks.forEach((block, index) => {
    const blockId = block.getAttribute('id') || `block-${index}`;
    if (!hasCompleteButton(block) && isModuleBlock(block)) {
      injectButtonInside(block, blockId);
    }
  });

  // Strategy 4: Explicit module markers (if Leo adds data-module-id attributes)
  const explicitModules = document.querySelectorAll('[data-module-id]');
  explicitModules.forEach(module => {
    const moduleId = module.getAttribute('data-module-id');
    if (moduleId && !hasCompleteButton(module)) {
      injectButtonInside(module, moduleId);
    }
  });
}

// Check if element already has a complete button
function hasCompleteButton(element) {
  return element.querySelector('.module-complete-btn') !== null;
}

// Determine if a block should be considered a module
function isModuleBlock(block) {
  // Check if block has substantial content
  const text = block.textContent?.trim() || '';
  return text.length > 50; // Only add buttons to blocks with decent content
}

// Inject button after an element (for headers)
function injectButtonAfter(element, moduleId) {
  const fullModuleId = `${currentCourseId}::${moduleId}`;
  const isCompleted = completedModules.includes(fullModuleId);

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'module-complete-container';
  buttonContainer.style.cssText = `
    margin: 1rem 0;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  `;

  const button = createCompleteButton(moduleId, isCompleted);
  buttonContainer.appendChild(button);

  element.parentNode.insertBefore(buttonContainer, element.nextSibling);
}

// Inject button inside an element (for blocks)
function injectButtonInside(element, moduleId) {
  const fullModuleId = `${currentCourseId}::${moduleId}`;
  const isCompleted = completedModules.includes(fullModuleId);

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'module-complete-container';
  buttonContainer.style.cssText = `
    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  `;

  const button = createCompleteButton(moduleId, isCompleted);
  buttonContainer.appendChild(button);

  element.appendChild(buttonContainer);
}

// Create the complete button
function createCompleteButton(moduleId, isCompleted) {
  const button = document.createElement('button');
  button.className = 'module-complete-btn';
  button.setAttribute('data-module-id', moduleId);
  
  if (isCompleted) {
    button.innerHTML = '✅ Completed';
    button.disabled = true;
    button.style.cssText = `
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      border: 1px solid rgba(34, 197, 94, 0.5);
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: default;
      transition: all 0.2s;
    `;
  } else {
    button.innerHTML = `Complete Module <span style="font-size: 0.85rem; opacity: 0.8;">(+${XP_REWARDS.MODULE_COMPLETED} XP)</span>`;
    button.style.cssText = `
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, #9333ea, #7e22ce);
      color: #fff;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 6px 16px rgba(147, 51, 234, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 12px rgba(147, 51, 234, 0.3)';
    });

    button.addEventListener('click', async () => {
      await handleModuleComplete(moduleId, button);
    });
  }

  return button;
}

// Handle module completion
async function handleModuleComplete(moduleId, button) {
  if (!currentUser || !currentCourseId) {
    alert('Error: User not authenticated');
    return;
  }

  button.disabled = true;
  button.innerHTML = 'Marking complete...';

  try {
    const result = await markModuleCompleted(currentUser.uid, currentCourseId, moduleId);

    if (result.alreadyCompleted) {
      button.innerHTML = '✅ Already Completed';
      return;
    }

    // Success animation
    button.innerHTML = `✅ +${XP_REWARDS.MODULE_COMPLETED} XP!`;
    button.style.background = 'linear-gradient(135deg, #22c55e, #15803d)';
    button.style.border = '1px solid rgba(34, 197, 94, 0.5)';

    setTimeout(() => {
      button.innerHTML = '✅ Completed';
      button.style.background = 'rgba(34, 197, 94, 0.15)';
      button.style.color = '#22c55e';
    }, 2000);

    // Update local state
    const fullModuleId = `${currentCourseId}::${moduleId}`;
    completedModules.push(fullModuleId);

    // Check if course is now complete
    checkCourseCompletion();

    // Update progress display
    displayCourseProgress();

  } catch (err) {
    console.error('Error completing module:', err);
    button.disabled = false;
    button.innerHTML = 'Error - Try Again';
    button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

    setTimeout(() => {
      button.innerHTML = `Complete Module (+${XP_REWARDS.MODULE_COMPLETED} XP)`;
      button.style.background = 'linear-gradient(135deg, #9333ea, #7e22ce)';
    }, 2000);
  }
}

// Mark already completed modules
function markCompletedModules() {
  document.querySelectorAll('.module-complete-btn').forEach(btn => {
    const moduleId = btn.getAttribute('data-module-id');
    const fullModuleId = `${currentCourseId}::${moduleId}`;
    
    if (completedModules.includes(fullModuleId) && !btn.disabled) {
      btn.innerHTML = '✅ Completed';
      btn.disabled = true;
      btn.style.cssText = `
        padding: 0.6rem 1.2rem;
        border-radius: 8px;
        border: 1px solid rgba(34, 197, 94, 0.5);
        background: rgba(34, 197, 94, 0.15);
        color: #22c55e;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: default;
      `;
    }
  });
}

// Check if all modules in course are complete
async function checkCourseCompletion() {
  const totalModules = document.querySelectorAll('.module-complete-btn').length;
  const completedInThisCourse = completedModules.filter(id => id.startsWith(`${currentCourseId}::`)).length;

  if (totalModules > 0 && completedInThisCourse === totalModules) {
    // Course complete!
    const wasNew = await markCourseCompleted(currentUser.uid, currentCourseId);
    
    if (wasNew) {
      showCourseCompletionCelebration();
    }
  }
}

// Display course progress at top of page
function displayCourseProgress() {
  let progressBar = document.getElementById('course-progress-bar');
  
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'course-progress-bar';
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: rgba(15, 23, 42, 0.95);
      z-index: 1000;
      backdrop-filter: blur(8px);
    `;
    document.body.prepend(progressBar);
  }

  const totalModules = document.querySelectorAll('.module-complete-btn').length;
  const completedInThisCourse = completedModules.filter(id => id.startsWith(`${currentCourseId}::`)).length;
  const percentage = totalModules > 0 ? (completedInThisCourse / totalModules) * 100 : 0;

  progressBar.innerHTML = `
    <div style="
      height: 100%;
      width: ${percentage}%;
      background: linear-gradient(90deg, #9333ea, #a78bfa, #fbbf24);
      transition: width 0.5s ease;
    "></div>
  `;

  // Add progress indicator
  let progressText = document.getElementById('course-progress-text');
  if (!progressText && totalModules > 0) {
    progressText = document.createElement('div');
    progressText.id = 'course-progress-text';
    progressText.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.5);
      border-radius: 999px;
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      color: #e5e5e5;
      z-index: 1001;
      backdrop-filter: blur(12px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.prepend(progressText);
  }

  if (progressText) {
    progressText.innerHTML = `
      <span style="color: #a78bfa; font-weight: 600;">${completedInThisCourse}</span> / ${totalModules} modules
    `;
  }
}

// Show celebration when course is completed
function showCourseCompletionCelebration() {
  const celebration = document.createElement('div');
  celebration.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(147, 51, 234, 0.25), rgba(15, 23, 42, 0.98));
    border: 2px solid #9333ea;
    border-radius: 24px;
    padding: 3rem;
    text-align: center;
    z-index: 10000;
    box-shadow: 0 30px 120px rgba(0,0,0,0.8);
    animation: celebrationPop 0.3s ease-out;
  `;

  celebration.innerHTML = `
    <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
    <h2 style="font-size: 2rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, #a78bfa, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
      Course Complete!
    </h2>
    <p style="color: #9ca3af; font-size: 1.1rem; margin-bottom: 1.5rem;">
      You've earned <span style="color: #fbbf24; font-weight: 600;">+${XP_REWARDS.COURSE_COMPLETED} XP</span> bonus!
    </p>
    <button onclick="this.parentElement.remove()" style="
      padding: 0.8rem 2rem;
      background: linear-gradient(135deg, #9333ea, #7e22ce);
      border: none;
      border-radius: 999px;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(147, 51, 234, 0.4);
    ">
      Continue Learning
    </button>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes celebrationPop {
      0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
      100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(celebration);

  // Confetti effect (optional - simple version)
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        top: -10px;
        left: ${Math.random() * 100}%;
        width: 10px;
        height: 10px;
        background: ${['#9333ea', '#a78bfa', '#fbbf24', '#22c55e'][Math.floor(Math.random() * 4)]};
        border-radius: 50%;
        opacity: 0.8;
        z-index: 9999;
        animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
      `;
      
      const fallStyle = document.createElement('style');
      fallStyle.textContent = `
        @keyframes confettiFall {
          to {
            transform: translateY(100vh) rotate(${Math.random() * 360}deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(fallStyle);
      
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 4000);
    }, i * 30);
  }
}

// Export for use in course pages
window.initModuleTracker = initModuleTracker;