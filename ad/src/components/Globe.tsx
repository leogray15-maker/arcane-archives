import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import landDots from "../generated/land-dots.json";

const C = config.colors;
const DEG = Math.PI / 180;

export const latLon = (lat: number, lon: number, r = 1) => {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

export const CITIES = {
  london: [51.5, -0.12],
  newYork: [40.7, -74.0],
  dubai: [25.2, 55.3],
  kyiv: [50.45, 30.5],
  singapore: [1.35, 103.8],
  tokyo: [35.7, 139.7],
} as const;
type City = keyof typeof CITIES;

const PINS: City[] = ["london", "kyiv", "dubai", "newYork", "singapore", "tokyo"];
const ARCS: [City, City, string][] = [
  ["london", "newYork", C.gold],
  ["london", "dubai", C.violetBright],
  ["kyiv", "london", C.gold],
  ["dubai", "singapore", C.gold],
  ["singapore", "tokyo", C.violetBright],
  ["newYork", "dubai", C.violetBright],
];

const Atmosphere: React.FC = () => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(C.violet) } },
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 c; varying vec3 vN; void main(){ float i = pow(0.68 - dot(vN, vec3(0.0,0.0,1.0)), 4.0); gl_FragColor = vec4(c, 1.0) * i * 0.9; }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh material={mat}>
      <sphereGeometry args={[1.12, 64, 64]} />
    </mesh>
  );
};

const Land: React.FC = () => {
  const geo = useMemo(() => {
    const d = landDots as number[];
    const pos = new Float32Array((d.length / 2) * 3);
    for (let i = 0; i < d.length; i += 2) {
      const v = latLon(d[i + 1], d[i], 1.002);
      pos.set([v.x, v.y, v.z], (i / 2) * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial color="#A79EF5" size={0.011} sizeAttenuation transparent opacity={0.9} />
    </points>
  );
};

const Graticule: React.FC = () => {
  const lines = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = Array.from({ length: 129 }, (_, i) => latLon(lat, -180 + (i / 128) * 360, 1.003));
      out.push(new THREE.BufferGeometry().setFromPoints(pts));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = Array.from({ length: 65 }, (_, i) => latLon(-90 + (i / 64) * 180, lon, 1.003));
      out.push(new THREE.BufferGeometry().setFromPoints(pts));
    }
    return out;
  }, []);
  return (
    <group>
      {lines.map((g, i) => (
        // eslint-disable-next-line react/no-unknown-property
        <line key={i}>
          <primitive object={g} attach="geometry" />
          <lineBasicMaterial color={C.gold} transparent opacity={0.1} />
        </line>
      ))}
    </group>
  );
};

const Pin: React.FC<{ city: City; at: number }> = ({ city, at }) => {
  const frame = useCurrentFrame();
  const [lat, lon] = CITIES[city];
  const drop = spr(frame, at, 12, 180);
  const base = useMemo(() => latLon(lat, lon, 1), [lat, lon]);
  const normal = base.clone().normalize();
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), [normal.x, normal.y, normal.z]);
  if (frame < at) return null;
  const fadeIn = ease(frame, [at, at + 5]);
  const head = base.clone().multiplyScalar(1 + 0.06 + (1 - drop) * 0.22);
  const sonar = ((frame - at) % 30) / 30;
  const first = ease(frame, [at, at + 24], [0, 1]);
  return (
    <group>
      <mesh position={head}>
        <sphereGeometry args={[0.016, 16, 16]} />
        <meshBasicMaterial color={C.goldBright} />
      </mesh>
      <mesh position={base.clone().multiplyScalar(1 + (0.06 + (1 - drop) * 0.22) / 2)} quaternion={quat}>
        <cylinderGeometry args={[0.003, 0.003, 0.06 + (1 - drop) * 0.22, 6]} />
        <meshBasicMaterial color={C.gold} transparent opacity={0.8 * fadeIn} />
      </mesh>
      {[first, sonar].map((s, i) => (
        <mesh key={i} position={base.clone().multiplyScalar(1.004)} quaternion={quat} scale={0.02 + s * 0.16}>
          <ringGeometry args={[0.85, 1, 48]} />
          <meshBasicMaterial color={i ? C.gold : C.goldBright} transparent opacity={(1 - s) * (i ? 0.6 : 0.9)} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const Arc: React.FC<{ a: City; b: City; color: string; at: number }> = ({ a, b, color, at }) => {
  const frame = useCurrentFrame();
  const { geo, curve } = useMemo(() => {
    const va = latLon(...(CITIES[a] as unknown as [number, number]), 1.005);
    const vb = latLon(...(CITIES[b] as unknown as [number, number]), 1.005);
    const mid = va.clone().add(vb).normalize().multiplyScalar(1 + va.distanceTo(vb) * 0.32);
    const c = new THREE.QuadraticBezierCurve3(va, mid, vb);
    return { geo: new THREE.TubeGeometry(c, 96, 0.0045, 6, false), curve: c };
  }, [a, b]);
  const p = ease(frame, [at, at + 26]);
  geo.setDrawRange(0, Math.floor(p * 96) * 6 * 6);
  const t = ((frame - at) % 40) / 40;
  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      {p >= 1 && (
        <mesh position={curve.getPoint(t)}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
};

// ------------------------------------------------------------ Watchtower layers
const slerpPath = (pts: [number, number][], alt: number, perSeg = 48) => {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = latLon(pts[i][0], pts[i][1], 1).normalize();
    const b = latLon(pts[i + 1][0], pts[i + 1][1], 1).normalize();
    const ang = a.angleTo(b);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      const v = a.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(b.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang) || 1);
      out.push(v.normalize().multiplyScalar(alt));
    }
  }
  const last = pts[pts.length - 1];
  out.push(latLon(last[0], last[1], alt));
  return out;
};

const Route: React.FC<{ pts: [number, number][]; at: number; color: string; alt: number; width: number; dashed?: boolean; travellers?: number; speed?: number }> = ({
  pts,
  at,
  color,
  alt,
  width,
  travellers = 0,
  speed = 90,
}) => {
  const frame = useCurrentFrame();
  const { geo, curve, segs } = useMemo(() => {
    const path = slerpPath(pts, alt);
    const c = new THREE.CatmullRomCurve3(path);
    const s = path.length * 2;
    return { geo: new THREE.TubeGeometry(c, s, width, 5, false), curve: c, segs: s };
  }, [pts, alt, width]);
  if (frame < at) return null;
  const p = ease(frame, [at, at + 30]);
  geo.setDrawRange(0, Math.floor(p * segs) * 5 * 6);
  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {p >= 1 &&
        Array.from({ length: travellers }, (_, i) => {
          const t = (((frame - at) / speed + i / travellers) % 1 + 1) % 1;
          return (
            <mesh key={i} position={curve.getPoint(t)}>
              <sphereGeometry args={[0.009, 10, 10]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          );
        })}
    </group>
  );
};

const CONFLICTS: [number, number][] = [
  [48.8, 35.5], [31.4, 34.4], [15.5, 47.5], [15.6, 32.5], [35.2, 38.5], [33.5, 44.2], [21.9, 96.1], [16.8, -1.5], [2.0, 45.3],
];
const Conflicts: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <group>
      {CONFLICTS.map(([lat, lon], i) => {
        const f0 = at + i * 1.5;
        const inP = spr(frame, f0, 12, 180);
        const pos = latLon(lat, lon, 1.004);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());
        const pulse = (((frame - f0) % 36) + 36) % 36 / 36;
        return (
          <group key={i} position={pos} quaternion={q}>
            <mesh scale={0.03 * inP}>
              <circleGeometry args={[1, 32]} />
              <meshBasicMaterial color={C.down} transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh scale={0.03 + pulse * 0.09}>
              <ringGeometry args={[0.86, 1, 40]} />
              <meshBasicMaterial color={C.down} transparent opacity={(1 - pulse) * 0.8 * inP} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const SHIPPING: [number, number][][] = [
  [[51.9, 4.3], [49.5, -4], [43, -10], [36, -6], [37, 2], [35, 18], [31.5, 32.3], [27.5, 34], [20, 38.5], [12.6, 43.4], [12, 52], [8, 65], [5.8, 80], [5.9, 95], [1.3, 103.8], [10, 110], [22, 115], [31.2, 122.5]],
  [[40.5, -73.8], [45, -45], [49.5, -10], [50.5, -2], [51.9, 4.3]],
  [[26.6, 56.3], [24, 60], [19, 72.5]],
  [[1.3, 103.8], [-6, 106], [-20, 112], [-33.9, 115]],
];
const CABLES: [number, number][][] = [
  [[50.3, -4.5], [48, -30], [42, -60], [40.5, -73.5]],
  [[43.2, 5.4], [36, 14], [31.5, 29.5], [27, 34.3], [21.3, 39.1], [13, 44], [15, 60], [18.9, 72.8]],
  [[38.7, -9.4], [28, -16], [14, -18], [6.4, 3.3], [-10, 8], [-33.9, 18.4]],
  [[18.9, 72.8], [6, 80.5], [2, 96], [1.3, 103.8]],
];
const MILITARY = (() => {
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hubs: [number, number][] = [[46, 34], [43, 34.5], [34, 33], [27, 51], [14, 42], [55, 22], [36, 25], [12, 48]];
  return Array.from({ length: 34 }, (_, i) => {
    const h = hubs[i % hubs.length];
    return [h[0] + (r() - 0.5) * 7, h[1] + (r() - 0.5) * 9] as [number, number];
  });
})();
const Military: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <group>
      {MILITARY.map(([lat, lon], i) => {
        const f0 = at + (i % 12) * 1.2;
        const inP = spr(frame, f0, 12, 200);
        const pos = latLon(lat, lon, 1.02);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
        return (
          <mesh key={i} position={pos} quaternion={q} scale={inP}>
            <coneGeometry args={[0.012, 0.04, 3]} />
            <meshBasicMaterial color={i % 3 ? C.violetBright : "#ffffff"} />
          </mesh>
        );
      })}
    </group>
  );
};

export type LayerFrames = { conflicts?: number; shipping?: number; cables?: number; military?: number };

/** The Watchtower globe: dotted land, gold graticule, pins that drop with sonar rings, travelling arcs. */
export const Globe: React.FC<{ size: number; pins?: number[]; scale: number; spinStart?: number; layers?: LayerFrames; lon0?: number; tilt?: number; spin?: number }> = ({
  size,
  pins,
  scale,
  spinStart = 0,
  layers,
  lon0 = -118,
  tilt = 0.5,
  spin = 0.16,
}) => {
  const frame = useCurrentFrame();
  const rotY = (lon0 - (frame - spinStart) * spin) * DEG;
  return (
    <ThreeCanvas width={size} height={size} camera={{ fov: 30, position: [0, 0, 5.3], near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
      <group scale={scale}>
      <group rotation={[tilt, rotY, 0]}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshBasicMaterial color="#0B0A14" />
        </mesh>
        <Graticule />
        <Land />
        {pins &&
          PINS.map((c, i) => <Pin key={c} city={c} at={pins[i]} />)}
        {pins &&
          ARCS.map(([a, b, col], i) => <Arc key={i} a={a} b={b} color={col} at={pins[Math.min(i + 1, pins.length - 1)] + 4} />)}
        {layers?.conflicts !== undefined && <Conflicts at={layers.conflicts} />}
        {layers?.shipping !== undefined &&
          SHIPPING.map((r, i) => <Route key={`s${i}`} pts={r} at={layers.shipping! + i * 3} color={C.gold} alt={1.006} width={0.0038} travellers={3} speed={110} />)}
        {layers?.cables !== undefined &&
          CABLES.map((r, i) => <Route key={`c${i}`} pts={r} at={layers.cables! + i * 3} color={C.violetBright} alt={1.003} width={0.0028} travellers={2} speed={50} />)}
        {layers?.military !== undefined && <Military at={layers.military} />}
      </group>
      <Atmosphere />
      </group>
    </ThreeCanvas>
  );
};
