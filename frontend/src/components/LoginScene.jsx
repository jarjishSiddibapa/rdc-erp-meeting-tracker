import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const BRAND = '#00B51A';

function FloatingIcosahedron({ position, scale, speed }) {
  const ref = useRef();
  useFrame((_, delta) => {
    ref.current.rotation.x += delta * speed * 0.3;
    ref.current.rotation.y += delta * speed * 0.5;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={BRAND} wireframe transparent opacity={0.35} />
    </mesh>
  );
}

function Particles({ count = 120 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={BRAND} size={0.05} sizeAttenuation transparent opacity={0.55} />
    </points>
  );
}

// A quiet, low-poly ambient scene layered over the RDC infographic — brand-green wireframe
// shapes drifting slowly. Explicitly transparent (no background mesh, alpha: true) so it
// reads as floating particles on the image rather than a differently-colored backdrop.
export default function LoginScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Particles />
        <FloatingIcosahedron position={[-4, 2, -2]} scale={1.1} speed={1} />
        <FloatingIcosahedron position={[4.5, -2.5, -3]} scale={1.6} speed={0.6} />
        <FloatingIcosahedron position={[3, 3, -4]} scale={0.7} speed={1.4} />
      </Suspense>
    </Canvas>
  );
}
