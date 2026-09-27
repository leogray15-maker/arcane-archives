import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ease, easeInOut, rng, spr } from "../../anim";
import { Globe } from "../../components/Globe";
import { BEAT, MONO, SANS, T } from "../theme";
import { popFrames } from "../timeline";
import { clamp, Kicker, Label, LivePill, Panel, Tag, usePunch, useSeg, Words } from "../ui";

// ---------------------------------------------------------------- Watchtower dashboard (from the site)
const ROWS = [
  { name: "Ukraine", score: 81, d: 0, col: T.red },
  { name: "Russia", score: 78, d: 13, col: T.orange },
  { name: "Syria", score: 75, d: 7, col: T.orange },
  { name: "Pakistan", score: 70, d: 0, col: T.orange },
  { name: "Yemen", score: 70, d: 0, col: T.orange },
];
const FORECASTS = [
  { t: "Black Sea maritime disruption", p: 50, tag: "SUPPLY CHAIN" },
  { t: "Iran security escalation", p: 70, tag: "CONFLICT" },
  { t: "Energy repricing risk", p: 67, tag: "MARKET" },
  { t: "Cyber threat concentration: US", p: 50, tag: "CYBER" },
];
// Focus = where the camera sits inside the 880x1060 dashboard (centre point, zoom).
const FOCUS: Record<string, { x: number; y: number; z: number }> = {
  overview: { x: 440, y: 530, z: 1 },
  instability: { x: 290, y: 330, z: 1.55 },
  risk: { x: 720, y: 330, z: 2.1 },
  forecasts: { x: 440, y: 810, z: 1.02 },
};

export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg, firstOfType } = useSeg();
  const focus = (seg.p?.focus as string) ?? "overview";
  const punch = usePunch();
  const lines = seg.lines;
  // First dashboard segment: land on the overview, then push into its focus on beat 3 of bar 2.
  const from = firstOfType ? FOCUS.overview : FOCUS[focus];
  const to = FOCUS[focus];
  const move = firstOfType ? ease(frame, [BEAT * 4, BEAT * 6], [0, 1], easeInOut) : 1;
  const prev = !firstOfType ? (focus === "risk" ? FOCUS.instability : FOCUS.risk) : from;
  const snap = !firstOfType ? spr(frame, 0, 18, 170) : 1;
  const cx = firstOfType ? from.x + (to.x - from.x) * move : prev.x + (to.x - prev.x) * snap;
  const cy = firstOfType ? from.y + (to.y - from.y) * move : prev.y + (to.y - prev.y) * snap;
  const z = firstOfType ? from.z + (to.z - from.z) * move : prev.z + (to.z - prev.z) * snap;
  const ff = firstOfType ? frame : frame + 200; // later segments show data already live
  const dashIn = firstOfType ? spr(frame, 0, 16, 140) : 1;
  // The dashboard is seen through a fixed window (x 60..940) so nothing slides under the action rail.
  const WIN = { top: lines ? 600 : 400, bottom: 1470 };
  const VIEW = { x: 500, y: (WIN.top + WIN.bottom) / 2 };
  const riskP = focus === "risk" ? ease(frame, [4, 40]) : 1;
  const fp = (i: number) => (focus === "forecasts" ? ease(frame, [4 + i * 5, 26 + i * 5]) : ff > 100 ? 1 : 0);

  return (
    <AbsoluteFill>
      {seg.kicker && <Kicker text={seg.kicker} />}
      {lines && <Words lines={lines} frames={popFrames(lines, 0, 6)} size={100} top={340} />}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, overflow: "hidden", clipPath: `inset(${WIN.top}px ${1080 - 940}px ${1920 - WIN.bottom}px 60px round 28px)` }}>
        <div
          style={{
            position: "absolute",
            left: VIEW.x - cx * z,
            top: VIEW.y - cy * z,
            width: 880,
            height: 1060,
            transform: `scale(${z * (0.9 + 0.1 * dashIn) * (1 + punch * 0.008)})`,
            transformOrigin: "0 0",
            opacity: dashIn,
          }}
        >
          <Panel style={{ left: 0, top: 0, width: 880, height: 1060, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Label size={18} color={T.text}>GLOBAL SITUATION</Label>
              <LivePill />
            </div>
            {/* instability */}
            <Panel style={{ left: 28, top: 90, width: 500, height: 480, padding: 24, background: T.panel2, boxShadow: "none" }}>
              <Label size={14}>COUNTRY INSTABILITY</Label>
              {ROWS.map((r, i) => {
                const fill = ease(ff, [6 + i * 4, 30 + i * 4]);
                const dp = r.d ? spr(ff, BEAT * 2 + i * 4, 11, 260) : 0;
                return (
                  <div key={r.name} style={{ marginTop: i ? 22 : 26 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 6, background: r.col }} />
                      <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, color: T.text, flex: 1 }}>{r.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 26, color: T.text }}>{Math.round(r.score * fill)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 20, width: 56, textAlign: "right", color: r.d ? T.red : T.red + "99", transform: `scale(${r.d ? 0.7 + 0.3 * dp : 1})`, opacity: r.d ? dp : 1 }}>{r.d ? `↑${r.d}` : "→"}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: T.line, marginTop: 12 }}>
                      <div style={{ width: `${r.score * fill}%`, height: 6, borderRadius: 3, background: r.col }} />
                    </div>
                  </div>
                );
              })}
            </Panel>
            {/* strategic risk */}
            <Panel style={{ left: 548, top: 90, width: 304, height: 480, padding: 24, background: T.panel2, boxShadow: "none" }}>
              <Label size={14}>STRATEGIC RISK</Label>
              <svg width={256} height={256} style={{ marginTop: 40 }}>
                <circle cx={128} cy={128} r={96} fill="none" stroke={T.line} strokeWidth={16} />
                <circle cx={128} cy={128} r={96} fill="none" stroke={T.orange} strokeWidth={16} strokeLinecap="round" strokeDasharray={`${603 * 0.68 * riskP} 603`} transform="rotate(-90 128 128)" />
                <text x={128} y={140} textAnchor="middle" fontFamily={SANS} fontWeight={800} fontSize={72} fill={T.orange}>
                  {Math.round(68 * riskP)}
                </text>
                <text x={128} y={176} textAnchor="middle" fontFamily={MONO} fontSize={18} letterSpacing="0.3em" fill={T.orange}>
                  HIGH
                </text>
              </svg>
              <div style={{ fontFamily: MONO, fontSize: 18, color: T.muted, textAlign: "center", marginTop: 26 }}>Trend · Stable</div>
            </Panel>
            {/* forecasts */}
            <Panel style={{ left: 28, top: 590, width: 824, height: 440, padding: 24, background: T.panel2, boxShadow: "none" }}>
              <Label size={14}>AI FORECASTS</Label>
              {FORECASTS.map((fc, i) => (
                <div key={fc.t} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: i ? 0 : 18, height: 92, borderTop: `1px solid ${T.line}` }}>
                  <span style={{ fontFamily: SANS, fontSize: 24, color: T.text, flex: 1 }}>{fc.t}</span>
                  <span style={{ width: 100, height: 6, borderRadius: 3, background: T.line }}>
                    <span style={{ display: "block", width: `${fc.p * fp(i)}%`, height: 6, borderRadius: 3, background: T.green }} />
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 22, color: T.green, width: 54, textAlign: "right" }}>{Math.round(fc.p * fp(i))}%</span>
                  <Tag>{fc.tag}</Tag>
                </div>
              ))}
            </Panel>
          </Panel>
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, top: WIN.top, width: 880, height: WIN.bottom - WIN.top, borderRadius: 28, border: `1.5px solid ${T.line}`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 1494, left: 60, width: 880, textAlign: "center", fontFamily: MONO, fontSize: 19, color: T.dim, letterSpacing: "0.08em" }}>Illustrative preview. The real thing is live inside.</div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- globe with layers on the beat
const LAYERS = ["CONFLICT", "SHIPPING", "CABLES", "MILITARY"];
const LAYER_COL = [T.red, T.gold, T.lav, T.text];
export const GlobeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const lines = seg.lines ?? ["", ""];
  const at = [BEAT * 1, BEAT * 2, BEAT * 3, BEAT * 4];
  const rise = spr(frame, 0, 16, 120);
  return (
    <AbsoluteFill>
      <Words lines={lines} frames={[[at[0], at[1]], [at[2], at[3]]]} size={96} top={300} />
      <div style={{ position: "absolute", left: -40, top: 470, width: 1080, height: 1080, opacity: rise, transform: `translateY(${(1 - rise) * 100}px)` }}>
        <Globe size={1080} scale={0.62 + 0.18 * rise + frame * 0.0006} lon0={-128} tilt={0.55} spin={0.12} layers={{ conflicts: at[0], shipping: at[1], cables: at[2], military: at[3] }} />
      </div>
      <div style={{ position: "absolute", top: 1430, left: 60, width: 880, display: "flex", gap: 14 }}>
        {LAYERS.map((l, i) => {
          const on = frame >= at[i];
          const p = spr(frame, at[i], 12, 260);
          return (
            <div key={l} style={{ flex: 1, height: 64, borderRadius: 32, border: `1.5px solid ${on ? LAYER_COL[i] : T.line}`, background: on ? `${LAYER_COL[i]}1f` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 17, letterSpacing: "0.14em", color: on ? T.text : T.dim, transform: `scale(${on ? 0.9 + 0.1 * p : 1})` }}>
              {l}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the vault, scrolled
const VAULT: { realm: string; items: string[] }[] = [
  { realm: "Mind & Psychology", items: ["Mind HiJacking", "Mindset Mastery", "Advanced Mindset Mastery", "Productive Isolation", "Never Procrastinate Again", "1st Principles / Mental Models", "Full Stoicism", "Full Thinking", "Leadership Protocol", "The Glitched Brain Protocol", "Discipline Mastery Protocol", "Mastering The Silent Grind", "The Red Book", "Rules For Life", "Dark Psychology", "Arcane Philosophies", "Deep Psychology", "Top 1%"] },
  { realm: "Wealth & Business", items: ["Entrepreneurship Mastery", "The Journey To Getting Rich", "Escaping Hell", "The Reality Shifting Entrepreneur", "The Secrets Of The Rich", "Copywriting Accelerator", "Copywriting Ebook", "Copywriting Mastery", "30 Day: Build A Profitable Business", "Make A Product That Prints $", "The Inbound Method", "The Sales Mastery Protocol", "Advanced Content Playbook", "Personal Brand Mastery", "Human Behaviour & Emotion Vault", "Diving Into The Writing Psychology", "Premium Archive"] },
  { realm: "Health & Investing", items: ["Terminate Playlist", "Bulking Protocol", "Health Ascendance", "Biohacking", "Full Investing Guide"] },
  { realm: "Systems", items: ["Full Trading Programme", "The Deep Work System", "Efficiency Blueprint", "Daily Quests", "+2 more inside"] },
];
export const VaultScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg, duration } = useSeg();
  const lines = seg.lines ?? [""];
  // Fast, decelerating scroll through every protocol.
  const scroll = ease(frame, [0, duration - 20], [0, 3050], easeInOut);
  const count = Math.min(46, Math.round(ease(frame, [0, duration - 20], [0, 46], easeInOut)));
  let y = 0;
  const blocks: React.ReactNode[] = [];
  let n = 0;
  VAULT.forEach((v, vi) => {
    blocks.push(
      <div key={`h${vi}`} style={{ position: "absolute", top: y, left: 0, width: 880 }}>
        <Label color={T.lav} size={16}>{`REALM ${String(vi + 1).padStart(2, "0")}`}</Label>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 48, letterSpacing: "-0.04em", color: T.text, marginTop: 8 }}>{v.realm}</div>
      </div>,
    );
    y += 120;
    v.items.forEach((it, k) => {
      const col = k % 2;
      n++;
      blocks.push(
        <div key={`${vi}-${k}`} style={{ position: "absolute", top: y + Math.floor(k / 2) * 118, left: col * 450, width: 430, height: 100, borderRadius: 16, background: T.panel, border: `1px solid ${T.line}`, padding: "16px 20px", boxSizing: "border-box" }}>
          <div style={{ fontFamily: MONO, fontSize: 15, color: T.dim }}>{String(k + 1).padStart(2, "0")}</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", color: T.text, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it}</div>
        </div>,
      );
    });
    y += Math.ceil(v.items.length / 2) * 118 + 50;
  });
  void n;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 60, top: 560, width: 880, height: 980, overflow: "hidden", maskImage: "linear-gradient(to bottom, transparent, black 120px, black 820px, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 120px, black 820px, transparent)" }}>
        <div style={{ position: "absolute", left: 0, top: 120 - scroll, width: 880, filter: `blur(${Math.min(3, Math.abs(ease(frame, [0, duration - 20], [0, 3050], easeInOut) - ease(frame - 1, [0, duration - 20], [0, 3050], easeInOut)) / 30)}px)` }}>{blocks}</div>
      </div>
      <Words lines={lines} frames={popFrames(lines, BEAT * 4, 7.5)} size={104} top={330} />
      <div style={{ position: "absolute", top: 460, left: 500 - 170, width: 340, height: 64, borderRadius: 32, border: `1.5px solid ${T.lav}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 24, letterSpacing: "0.16em", color: T.lav, background: T.bg, opacity: frame >= BEAT * 4 ? 0 : 1 }}>
        {`${count} PROTOCOLS`}
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- how it works, one step per bar
export const Step: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const punch = usePunch();
  const n = seg.p?.n as number;
  const p = spr(frame, 0, 14, 220);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + punch * 0.01})` }}>
      <div style={{ position: "absolute", top: 380, left: 60, width: 880, display: "flex", gap: 14 }}>
        {[1, 2, 3].map((k) => (
          <div key={k} style={{ flex: 1, height: 8, borderRadius: 4, background: k <= n ? T.lav : T.line, opacity: k === n ? 0.4 + 0.6 * p : 1 }} />
        ))}
      </div>
      <div style={{ position: "absolute", top: 470, left: 60, fontFamily: SANS, fontWeight: 900, fontSize: 260, letterSpacing: "-0.07em", color: T.lav, lineHeight: 1, transform: `translateY(${(1 - p) * 60}px)`, opacity: p }}>{`0${n}`}</div>
      <Label size={26} color={T.muted} style={{ position: "absolute", top: 780, left: 64, opacity: clamp(frame, 4, 10) }}>
        {seg.p?.when as string}
      </Label>
      <Words lines={[seg.p?.title as string]} frames={popFrames([seg.p?.title as string], 7, 5)} size={110} top={840} align="left" />
      <div style={{ position: "absolute", top: 1000, left: 64, width: 860, fontFamily: SANS, fontSize: 38, lineHeight: 1.3, color: T.muted, opacity: clamp(frame, 18, 26) }}>{seg.p?.sub as string}</div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- War Room
export const WarRoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const lines = seg.lines ?? ["", ""];
  const r = rng(5);
  const L = "ABCDEFGHJKLMNPRSTVWY";
  const cardP = spr(frame, 0, 16, 160);
  const secs = 2537 + Math.floor(frame / 30);
  return (
    <AbsoluteFill>
      <Words lines={lines} frames={popFrames(lines, 0, 6)} size={92} top={320} />
      <Panel style={{ left: 60, top: 640, width: 880, height: 700, padding: 36, transform: `translateY(${(1 - cardP) * 80}px)`, opacity: cardP }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label size={20} color={T.text}>THE WAR ROOM</Label>
          <LivePill />
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 56, letterSpacing: "-0.04em", color: T.text, marginTop: 26 }}>Weekly member call</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 18, marginTop: 34 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const ini = L[Math.floor(r() * L.length)] + L[Math.floor(r() * L.length)];
            const speaking = i === Math.floor(frame / 15) % 10;
            const p = spr(frame, 4 + i * 3.75, 13, 260);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "center", transform: `scale(${p})` }}>
                <div style={{ width: 120, height: 120, borderRadius: 60, background: "radial-gradient(circle at 30% 25%, #2A2440, #111117)", border: `3px solid ${speaking ? T.green : T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 30, color: "#C9C5D8" }}>{ini}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 40 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", height: 60 }}>
            {Array.from({ length: 34 }, (_, i) => (
              <div key={i} style={{ width: 7, height: 10 + Math.abs(Math.sin(frame / 2.1 + i * 0.8) * Math.sin(frame / 4.7 + i * 0.3)) * 46, borderRadius: 4, background: i < 22 ? T.lav : T.line }} />
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 28, color: T.muted }}>{`00:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`}</div>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};
