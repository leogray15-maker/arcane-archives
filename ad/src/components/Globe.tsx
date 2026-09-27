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

/** The Watchtower globe: dotted land, gold graticule, pins that drop with sonar rings, travelling arcs. */
export const Globe: React.FC<{ size: number; pins: number[]; scale: number; spinStart?: number }> = ({ size, pins, scale, spinStart = 0 }) => {
  const frame = useCurrentFrame();
  const rotY = (-118 - (frame - spinStart) * 0.16) * DEG;
  return (
    <ThreeCanvas width={size} height={size} camera={{ fov: 30, position: [0, 0, 5.3], near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
      <group scale={scale}>
      <group rotation={[0.5, rotY, 0]}>
        <mesh>
          <sphereGeometry args={[1, 96, 96]} />
          <meshBasicMaterial color="#0B0A14" />
        </mesh>
        <Graticule />
        <Land />
        {PINS.map((c, i) => (
          <Pin key={c} city={c} at={pins[i]} />
        ))}
        {ARCS.map(([a, b, col], i) => (
          <Arc key={i} a={a} b={b} color={col} at={pins[Math.min(i + 1, pins.length - 1)] + 4} />
        ))}
      </group>
      <Atmosphere />
      </group>
    </ThreeCanvas>
  );
};
