import { awardXP, markCourseCompleted } from "./xp-system.js";

window.addEventListener("aa:moduleToggle", async (e) => {
  const { courseId, moduleId, completed, course } = e.detail;

  // ✅ Only award XP when toggled ON
  if (completed === true) {
    console.log("✅ Module completed:", courseId, moduleId);
    // XP already awarded inside tracker → DO NOT award here
  }

  // ✅ Course just reached 100%
  if (course.completed === true && course.previouslyCompleted === false) {
    console.log("🏆 Course completed:", courseId);
    try {
      await markCourseCompleted(window.currentUser.uid, courseId);
    } catch (err) {
      console.error("❌ Failed to mark course completed:", err);
    }
  }
});
