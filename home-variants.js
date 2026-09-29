// Shared runtime for the homepage redesign variants (index-v1/v2/v3.html):
// affiliate click tracking, the member-proof gallery and the "already cleared"
// CTA label. Mirrors the behaviour of index.html so any variant can replace it.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const app = initializeApp({
    apiKey: "AIzaSyAK9MheMvSeOpscic4lXUsIwa0J5ubVf6w",
    authDomain: "arcane-archives-3b0f5.firebaseapp.com",
    projectId: "arcane-archives-3b0f5",
    storageBucket: "arcane-archives-3b0f5.firebasestorage.app",
    messagingSenderId: "264237235055",
    appId: "1:264237235055:web:4a2e5605b0ffb5307f069a",
    measurementId: "G-YGPLQHDXMM"
});
const db = getFirestore(app);

// ---------- affiliate click tracking (once per session) ----------
(async function trackAffiliateClick() {
    try {
        const ref = localStorage.getItem('arcane_ref');
        if (!ref || sessionStorage.getItem('arcane_click_sid')) return;
        const sid = Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem('arcane_click_sid', sid);
        await addDoc(collection(db, 'AffiliateClicks'), {
            referralCode: ref,
            timestamp: serverTimestamp(),
            landingPage: window.location.pathname,
            userAgent: (navigator.userAgent || '').slice(0, 200),
            sessionId: sid
        });
    } catch (e) { console.warn('Click tracking error:', e); }
})();

// ---------- returning visitors who already cleared the assessment ----------
try {
    const v = JSON.parse(localStorage.getItem('arcane_assessment') || 'null');
    if (v && v.passed) {
        document.querySelectorAll('[data-join-label]').forEach((el) => {
            el.textContent = 'View your result & claim your place';
        });
    }
} catch (e) {}

// ---------- member proof gallery ----------
// Markup contract: #proofGallery (scroll strip), optional #proofSection
// (hidden when empty), #proofPrev / #proofNext, and <dialog id="proofDialog">
// containing an <img>.
const gallery = document.getElementById('proofGallery');
if (gallery) {
    const section = document.getElementById('proofSection');
    const dialog = document.getElementById('proofDialog');
    const dialogImg = dialog ? dialog.querySelector('img') : null;
    let images = [];
    let current = 0;

    const show = (i) => {
        if (!dialog || !dialogImg || !images.length) return;
        current = (i + images.length) % images.length;
        dialogImg.src = images[current].imageUrl;
        dialogImg.alt = images[current].caption || 'Member screenshot';
        if (!dialog.open) dialog.showModal();
    };

    try {
        const snap = await getDocs(query(collection(db, 'SocialProof'), orderBy('createdAt', 'desc')));
        gallery.textContent = '';
        snap.forEach((d) => images.push(d.data()));
        images = images.filter((it) => typeof it.imageUrl === 'string' && /^https:\/\//.test(it.imageUrl));
        images.forEach((item, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'proof-item';
            btn.setAttribute('aria-label', 'Open member screenshot ' + (i + 1));
            const img = document.createElement('img');
            img.src = item.imageUrl;
            img.alt = item.caption || 'Member screenshot';
            img.loading = 'lazy';
            btn.appendChild(img);
            btn.addEventListener('click', () => show(i));
            gallery.appendChild(btn);
        });
    } catch (err) {
        console.error('Error loading social proof:', err);
        gallery.textContent = '';
    }
    if (!images.length && section) section.hidden = true;

    const step = () => Math.max(280, gallery.clientWidth * 0.8);
    document.getElementById('proofPrev')?.addEventListener('click', () => gallery.scrollBy({ left: -step(), behavior: 'smooth' }));
    document.getElementById('proofNext')?.addEventListener('click', () => gallery.scrollBy({ left: step(), behavior: 'smooth' }));

    if (dialog) {
        dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
        dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
        dialog.querySelector('[data-prev]')?.addEventListener('click', () => show(current - 1));
        dialog.querySelector('[data-next]')?.addEventListener('click', () => show(current + 1));
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') show(current - 1);
            if (e.key === 'ArrowRight') show(current + 1);
        });
    }
}
