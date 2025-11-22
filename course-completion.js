// ===============================
// Course Completion Engine
// ===============================

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

/* -------------------------------
   Auto init on every course page
-------------------------------- */
export function autoInitCourseCompletion() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const courseId = extractCourseId();
    const moduleElements = [...document.querySelectorAll(".module")];
    const totalModules = moduleElements.length;

    if (!courseId || totalModules === 0) return;

    await ensureCourseDoc(user.uid, courseId, totalModules);

    initUI(user.uid, courseId, moduleElements);
  });
}

/* -------------------------------
   Get course name from page path
-------------------------------- */
function extractCourseId() {
  const path = window.location.pathname; // /courses/BULKING/index.html
  const parts = path.split("/");
  return parts[parts.length - 2] || null;
}

/* -------------------------------
   Create course doc if missing
-------------------------------- */
async function ensureCourseDoc(uid, cid, total) {
  const ref = doc(db, "Users", uid, "courses", cid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      modulesCompleted: 0,
      totalModules: total,
      completed: false,
      progress: 0,
    });
  }
}

/* -------------------------------
   Initialize UI + click handlers
-------------------------------- */
function initUI(uid, cid, modules) {
  const container = document.getElementById("courseCompletionContainer");

  container.innerHTML = `
    <div id="progressDisplay"
         style="margin-top:20px; font-size:18px; font-weight:600;">
       Loading progress...
    </div>
  `;

  modules.forEach((m) => {
    m.style.cursor = "pointer";
    m.style.minHeight = "40px";
    m.style.border = "1px solid rgba(255,255,255,0.1)";
    m.style.marginBottom = "8px";
    m.style.borderRadius = "8px";
    m.style.padding = "10px";

    m.addEventListener("click", () =>
      markModuleComplete(uid, cid, m.dataset.moduleId)
    );
  });

  refreshProgress(uid, cid);
}

/* -------------------------------
   Mark module complete
-------------------------------- */
async function markModuleComplete(uid, cid, moduleId) {
  const ref = doc(db, "Users", uid, "courses", cid);
  const snap = await getDoc(ref);
  const data = snap.data();

  const alreadyDone = data[`m${moduleId}`] === true;
  if (alreadyDone) return;

  await updateDoc(ref, {
    [`m${moduleId}`]: true,
    modulesCompleted: data.modulesCompleted + 1,
  });

  refreshProgress(uid, cid);
}

/* -------------------------------
   Update progress UI
-------------------------------- */
async function refreshProgress(uid, cid) {
  const ref = doc(db, "Users", uid, "courses", cid);
  const snap = await getDoc(ref);
  const d = snap.data();

  const progress = Math.round(
    (d.modulesCompleted / d.totalModules) * 100
  );

  await updateDoc(ref, { progress });

  document.querySelector("#progressDisplay").innerHTML = `
      Progress: <strong>${progress}%</strong>
  `;

  if (progress >= 100 && !d.completed) {
    await updateDoc(ref, { completed: true });
  }
}
