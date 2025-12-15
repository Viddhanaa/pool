'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';

// Animated particles for futuristic effect
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-accent/60 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

// Hexagon grid background
function HexGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hexGrid" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
            <path
              d="M28 0 L56 16.66 L56 50 L28 66.66 L0 50 L0 16.66 Z"
              fill="none"
              stroke="rgba(0, 255, 255, 0.3)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexGrid)" />
      </svg>
    </div>
  );
}

// Orbital ring animation
function OrbitalRings() {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      {[300, 400, 500].map((size, i) => (
        <motion.div
          key={size}
          className="absolute left-1/2 top-1/2 rounded-full border border-accent/10"
          style={{
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 30 + i * 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <div
            className="absolute w-2 h-2 bg-accent rounded-full shadow-[0_0_10px_rgba(0,255,255,0.8)]"
            style={{ top: -4, left: '50%', marginLeft: -4 }}
          />
        </motion.div>
      ))}
    </div>
  );
}

export function HeroSection() {
  return (
    <div className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background-secondary" />
      
      {/* Hex grid pattern */}
      <HexGrid />
      
      {/* Floating particles */}
      <FloatingParticles />
      
      {/* Orbital rings */}
      <OrbitalRings />

      {/* Radial glow effects */}
      <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-purple/15 rounded-full blur-[150px]" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl px-4">
        {/* Animated logo mark */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring' }}
          className="mb-8"
        >
          <div className="relative inline-flex items-center justify-center w-24 h-24 mx-auto">
            {/* Outer ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-accent/30"
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {/* Inner glow */}
            <div className="absolute inset-2 rounded-full bg-accent/20 backdrop-blur-sm" />
            {/* Icon */}
            <Sparkles className="relative w-10 h-10 text-accent" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-6xl md:text-8xl font-bold tracking-tight mb-4"
        >
          <span className="bg-gradient-to-r from-accent via-cyan-300 to-accent bg-clip-text text-transparent">
            VIDDHANA
          </span>
        </motion.h1>

        {/* Subtitle - minimal */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-xl text-foreground-muted mb-10 tracking-widest uppercase"
        >
          Next-Gen Mining Pool
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex justify-center mb-16"
        >
          <Button asChild size="xl" variant="glow" className="group">
            <Link href="/register" className="gap-3">
              Start Mining
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ArrowRight className="h-5 w-5" />
              </motion.span>
            </Link>
          </Button>
        </motion.div>

        {/* Feature icons - minimal, icon-focused */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex justify-center gap-8 md:gap-16"
        >
          <FeatureIcon icon={Sparkles} label="AI-Powered" color="purple" />
          <FeatureIcon icon={Zap} label="Instant" color="accent" />
          <FeatureIcon icon={Shield} label="Secure" color="success" />
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background-secondary to-transparent" />
    </div>
  );
}

interface FeatureIconProps {
  icon: React.ElementType;
  label: string;
  color: 'accent' | 'purple' | 'success';
}

function FeatureIcon({ icon: Icon, label, color }: FeatureIconProps) {
  const colorClasses = {
    accent: 'text-accent border-accent/30 shadow-[0_0_20px_rgba(0,255,255,0.2)]',
    purple: 'text-purple border-purple/30 shadow-[0_0_20px_rgba(139,92,246,0.2)]',
    success: 'text-success border-success/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]',
  };

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      whileHover={{ scale: 1.1, y: -5 }}
      transition={{ type: 'spring', stiffness: 400 }}
    >
      <div className={`p-4 rounded-xl border bg-white/5 backdrop-blur-sm ${colorClasses[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-xs text-foreground-muted uppercase tracking-wider">{label}</span>
    </motion.div>
  );
}
