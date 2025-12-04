/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, Line, Stars, Environment, Icosahedron, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Represents a node in the DePIN/Wealth network
const NetworkNode: React.FC<{ position: [number, number, number]; color: string }> = ({ position, color }) => {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
    </mesh>
  );
};

// Connections between nodes
const Connections = () => {
  const count = 15;
  const lines: React.ReactElement[] = [];
  const positions: [number, number, number][] = [];

  // Generate random positions on a sphere
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const r = 3;
    positions.push([
      r * Math.cos(theta) * Math.sin(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(phi)
    ]);
  }

  positions.forEach((pos, i) => {
    positions.forEach((target, j) => {
      if (i < j && new THREE.Vector3(...pos).distanceTo(new THREE.Vector3(...target)) < 2.5) {
        lines.push(
          <Line
            key={`${i}-${j}`}
            points={[pos, target]}
            color="#10B981" // Emerald
            opacity={0.2}
            transparent
            lineWidth={1}
          />
        );
      }
    });
  });

  return (
    <group>
      {positions.map((pos, i) => (
        <NetworkNode key={i} position={pos} color={i % 3 === 0 ? "#D4AF37" : "#10B981"} />
      ))}
      {lines}
    </group>
  );
};

export const HeroScene: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#D4AF37" />
        
        <Float speed={1} rotationIntensity={0.2} floatIntensity={0.2}>
          <group rotation={[0, 0, Math.PI / 6]}>
            <Connections />
            <Icosahedron args={[2.8, 1]} >
               <meshStandardMaterial color="#0F172A" wireframe transparent opacity={0.1} />
            </Icosahedron>
          </group>
        </Float>

        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
      </Canvas>
    </div>
  );
};

// Represents Tokenization of Assets (Fractional Ownership)
export const QuantumComputerScene: React.FC = () => {
  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={1} />
        <spotLight position={[5, 5, 5]} intensity={2} color="#D4AF37" />
        <Environment preset="city" />
        
        <Float rotationIntensity={0.5} floatIntensity={0.5} speed={2}>
          {/* Central 'Asset' Core */}
          <Sphere args={[1, 64, 64]}>
             <MeshDistortMaterial 
                color="#D4AF37" 
                envMapIntensity={1} 
                clearcoat={1} 
                clearcoatRoughness={0.1} 
                metalness={0.9} 
                distort={0.3} 
                speed={2} 
             />
          </Sphere>

          {/* Orbiting Fractions (Tokens) */}
          <group>
             {[...Array(8)].map((_, i) => {
                 const angle = (i / 8) * Math.PI * 2;
                 const radius = 2;
                 return (
                     <mesh key={i} position={[Math.cos(angle) * radius, Math.sin(angle) * radius * 0.5, Math.sin(angle) * radius]}>
                         <boxGeometry args={[0.3, 0.3, 0.3]} />
                         <meshStandardMaterial color="#10B981" metalness={0.5} roughness={0.2} />
                     </mesh>
                 )
             })}
          </group>
        </Float>
      </Canvas>
    </div>
  );
}