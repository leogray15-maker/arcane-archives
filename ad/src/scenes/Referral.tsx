import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInOut, fmt, lerp, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Label, Panel } from "../components/ui";
import { MONO, SANS } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;

const Icon: React.FC<{ d: string }> = ({ d }) => (
  <svg width={22} height={22} viewBox="0 0 24 24">
    <path d={d} fill="none" stroke={C.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The referral page: link, copy, share, then referrals and Arcane Credits. No cash figures. */
export const Referral: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"referral">();
  const cfg = useSpec<"referral">();
  const link = `${config.brand.url}/?ref=${cfg.refCode}`;
  const typed = Math.round(ease(frame, [cue.typing.from, cue.typing.to], [0, link.length], (t) => t));
  const cardIn = spr(frame, 2, 17, 120);
  // Cursor path to the copy button, then a click.
  const btn = { x: 800, y: 800 };
  const cur = ease(frame, [cue.typing.to + 2, cue.click - 2], [0, 1], easeInOut);
  const cx = lerp(930, btn.x, cur);
  const cy = lerp(1060, btn.y, cur);
  const clicked = frame >= cue.click;
  const press = clicked ? 1 - ease(frame, [cue.click, cue.click + 8], [1, 0]) * 0.06 : 1;
  const toast = spr(frame, cue.click + 2, 14, 200);
  const toastOut = ease(frame, [cue.click + 50, cue.click + 60]);
  const statsIn = spr(frame, cue.tiles[0] - 6, 17, 120);
  const credits = ease(frame, [cue.credits.from, cue.credits.to], [0, 1250], (t) => t * (2 - t));

  const tiles = [
    { n: 4, label: "TOTAL REFERRALS", col: C.violetBright },
    { n: 3, label: "ACTIVE MEMBERS", col: C.gold },
    { n: 1, label: "PENDING", col: C.goldBright },
  ];

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <Panel style={{ left: 60, top: 620, width: 880, height: 370, padding: "30px 32px", transform: `translateY(${(1 - cardIn) * 70}px)`, opacity: Math.min(1, cardIn * 1.5) }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ width: 62, height: 62, borderRadius: 16, border: `1px solid ${C.violet}66`, background: `${C.violet}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={28} height={28} viewBox="0 0 24 24">
              <path d="M10 14 a4 4 0 0 0 5.66 0 l3-3 a4 4 0 0 0 -5.66 -5.66 l-1 1 M14 10 a4 4 0 0 0 -5.66 0 l-3 3 a4 4 0 0 0 5.66 5.66 l1 -1" fill="none" stroke={C.violetBright} strokeWidth={1.8} strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 32, color: C.text }}>Your Referral Link</div>
            <div style={{ fontFamily: SANS, fontSize: 21, color: C.muted, marginTop: 4 }}>Share it with people you'd want in the room.</div>
          </div>
        </div>
        <Label size={15} style={{ marginTop: 30 }}>
          COPY YOUR LINK
        </Label>
        <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
          <div style={{ flex: 1, height: 70, borderRadius: 14, background: "#07070A", border: `1px solid ${C.cardLine}`, display: "flex", alignItems: "center", padding: "0 20px", fontFamily: MONO, fontSize: 21, color: C.text }}>
            {link.slice(0, typed)}
            <span style={{ width: 2, height: 28, background: C.violetBright, marginLeft: 2, opacity: frame < cue.typing.to + 6 && Math.floor(frame / 8) % 2 === 0 ? 1 : 0 }} />
          </div>
          <div
            style={{
              width: 190,
              height: 70,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${C.violetBright}, ${C.violet})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontFamily: SANS,
              fontWeight: 600,
              fontSize: 23,
              color: "#fff",
              transform: `scale(${press})`,
              boxShadow: clicked ? `0 0 ${30 * (1 - toastOut)}px ${C.violet}` : undefined,
            }}
          >
            {clicked ? "Copied" : "Copy Link"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
          {[
            { t: "Message", d: "M4 5 h16 v11 H9 l-5 4 Z" },
            { t: "Post", d: "M4 20 L20 4 M9 4 h11 v11" },
            { t: "Email", d: "M3 6 h18 v12 H3 Z M3 6 l9 7 9-7" },
          ].map((b, i) => {
            const p = spr(frame, cue.shares[i], 14, 200);
            return (
              <div
                key={b.t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 22px",
                  borderRadius: 12,
                  border: `1px solid ${C.cardLine}`,
                  background: "#101019",
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: 21,
                  color: C.text,
                  opacity: frame >= cue.shares[i] ? Math.min(1, p * 1.5) : 0.25,
                  transform: `translateY(${frame >= cue.shares[i] ? (1 - p) * 12 : 0}px)`,
                }}
              >
                <Icon d={b.d} />
                {b.t}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* toast */}
      <div
        style={{
          position: "absolute",
          top: 706,
          left: 700,
          width: 220,
          height: 52,
          borderRadius: 26,
          background: "#15131F",
          border: `1px solid ${C.gold}88`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontFamily: SANS,
          fontSize: 20,
          color: C.goldBright,
          opacity: clicked ? Math.min(1, toast * 1.5) * (1 - toastOut) : 0,
          transform: `translateY(${(1 - toast) * 14}px)`,
        }}
      >
        ✓ Link copied
      </div>

      {/* cursor */}
      {frame > cue.typing.to && frame < cue.click + 30 && (
        <svg width={40} height={40} viewBox="0 0 24 24" style={{ position: "absolute", left: cx, top: cy, transform: `scale(${clicked ? press : 1})`, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.6))", opacity: 1 - ease(frame, [cue.click + 16, cue.click + 30]) }}>
          <path d="M4 2 L4 19 L8.5 14.5 L11.5 21 L14 20 L11 13.5 L17 13.5 Z" fill="#fff" stroke="#000" strokeWidth={1} />
        </svg>
      )}

      {/* stats */}
      <div style={{ position: "absolute", top: 1030, left: 60, width: 880, display: "flex", gap: 18, opacity: frame >= cue.tiles[0] - 6 ? Math.min(1, statsIn * 1.5) : 0, transform: `translateY(${(1 - statsIn) * 40}px)` }}>
        {tiles.map((t, i) => {
          const p = spr(frame, cue.tiles[i], 12, 200);
          const n = frame >= cue.tiles[i] ? t.n : 0;
          return (
            <Panel key={t.label} style={{ position: "relative", flex: 1, height: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 56, color: t.col, transform: `scale(${frame >= cue.tiles[i] ? 0.8 + 0.2 * p : 1})` }}>{n}</div>
              <Label size={14} style={{ marginTop: 6, letterSpacing: "0.2em" }}>
                {t.label}
              </Label>
            </Panel>
          );
        })}
      </div>
      <Panel
        glow={frame >= cue.credits.to ? ease(frame, [cue.credits.to, cue.credits.to + 20], [1, 0]) : 0}
        style={{ left: 60, top: 1210, width: 880, height: 230, padding: "28px 34px", opacity: frame >= cue.credits.from - 8 ? ease(frame, [cue.credits.from - 8, cue.credits.from + 4]) : 0 }}
      >
        <Label color={C.gold}>◆ ARCANE CREDITS</Label>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 84, color: C.goldBright, fontVariantNumeric: "tabular-nums", textShadow: `0 0 30px ${C.gold}55` }}>{fmt(credits)}</div>
          <div style={{ fontFamily: SANS, fontSize: 22, color: C.muted, textAlign: "right" }}>
            for every member
            <br />
            you bring in
          </div>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};
