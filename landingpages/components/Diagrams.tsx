/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Layers, Globe, Users, TrendingUp, ShieldCheck, Activity, Smartphone } from 'lucide-react';

// --- QUAD-CORE ARCHITECTURE DIAGRAM ---
export const SurfaceCodeDiagram: React.FC = () => {
  // Re-purposing this component for the "Quad-Core" Architecture
  const [activeLayer, setActiveLayer] = useState<number | null>(null);

  const layers = [
    { id: 1, title: 'AI Core "Prometheus"', icon: <Brain size={24}/>, desc: 'Quantitative analysis, risk management, and personalized automated strategies.', color: 'bg-indigo-600' },
    { id: 2, title: 'Atlas Chain (Layer 3)', icon: <Layers size={24}/>, desc: 'High-speed custom execution layer with <$0.001 fees and 100k TPS.', color: 'bg-blue-600' },
    { id: 3, title: 'DeFi + RWA Engine', icon: <TrendingUp size={24}/>, desc: 'Tokenization of Real World Assets (Real Estate, Energy) linked to DeFi liquidity.', color: 'bg-emerald-600' },
    { id: 4, title: 'DePIN & SocialFi', icon: <Globe size={24}/>, desc: 'Physical infrastructure verification and community-driven wealth creation.', color: 'bg-amber-600' },
  ];

  return (
    <div className="flex flex-col items-center p-8 bg-white rounded-xl shadow-lg border border-slate-200 my-8">
      <h3 className="font-serif text-2xl mb-2 text-slate-900">The "Quad-Core" Architecture</h3>
      <p className="text-sm text-slate-500 mb-8 text-center max-w-md">
        Four integrated technologies working in harmony to secure and grow your wealth. Click to explore.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl relative">
         {/* Central Connection Lines (Visual only) */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-100 rounded-full z-0 flex items-center justify-center border border-slate-200">
            <div className="w-2 h-2 bg-wealth-gold rounded-full animate-pulse"></div>
         </div>

         {layers.map((layer) => (
             <motion.div
                key={layer.id}
                onClick={() => setActiveLayer(layer.id === activeLayer ? null : layer.id)}
                className={`relative z-10 p-6 rounded-xl border cursor-pointer transition-all duration-300 ${activeLayer === layer.id ? 'border-wealth-gold shadow-md bg-slate-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                whileHover={{ scale: 1.02 }}
             >
                <div className={`w-12 h-12 ${layer.color} rounded-lg flex items-center justify-center text-white mb-4 shadow-sm`}>
                    {layer.icon}
                </div>
                <h4 className="font-bold text-lg text-slate-800 mb-2">{layer.title}</h4>
                <p className={`text-sm text-slate-600 leading-relaxed ${activeLayer === layer.id ? 'block' : 'hidden md:block'}`}>
                    {layer.desc}
                </p>
             </motion.div>
         ))}
      </div>
    </div>
  );
};

// --- WEALTH OS WORKFLOW DIAGRAM ---
export const TransformerDecoderDiagram: React.FC = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        setStep(s => (s + 1) % 4);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const steps = [
      { label: "Data Input", sub: "Bank API, IoT, Crypto" },
      { label: "AI Analysis", sub: "Risk Profile & Strategy" },
      { label: "Execution", sub: "Atlas Chain L3" },
      { label: "Growth", sub: "Yield & Rewards" }
  ];

  return (
    <div className="flex flex-col items-center p-8 bg-slate-50 rounded-xl border border-slate-200 my-8">
      <h3 className="font-serif text-xl mb-4 text-slate-900">How VIDDHANA Works</h3>
      <p className="text-sm text-slate-600 mb-8 text-center max-w-md">
        From raw financial data to optimized wealth growth in milliseconds.
      </p>

      <div className="flex items-center justify-between w-full max-w-2xl relative">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
        <div 
            className="absolute top-1/2 left-0 h-1 bg-wealth-emerald -translate-y-1/2 z-0 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
        ></div>

        {steps.map((s, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${i <= step ? 'bg-white border-wealth-emerald text-wealth-emerald shadow-sm' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
                    {i === 0 && <Smartphone size={18} />}
                    {i === 1 && <Brain size={18} />}
                    {i === 2 && <ShieldCheck size={18} />}
                    {i === 3 && <Activity size={18} />}
                </div>
                <div className="text-center">
                    <div className={`text-xs font-bold uppercase tracking-wider ${i <= step ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</div>
                    <div className="text-[10px] text-slate-500">{s.sub}</div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

// --- PERFORMANCE / YIELD COMPARISON ---
export const PerformanceMetricDiagram: React.FC = () => {
    // Comparison data: Traditional Bank vs VIDDHANA
    // Values represent Annual Yield %
    
    return (
        <div className="flex flex-col md:flex-row gap-8 items-center p-8 bg-slate-900 text-white rounded-xl my-8 border border-slate-800 shadow-2xl">
            <div className="flex-1 min-w-[240px]">
                <h3 className="font-serif text-2xl mb-2 text-wealth-gold">The Wealth Gap</h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    Inflation eats away at traditional savings. VIDDHANA leverages DeFi and Real World Assets to provide yields that beat inflation and grow real wealth.
                </p>
                
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Inflation Rate (Est.)</span>
                        <span className="text-red-400 font-mono">~5-8%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Bank Savings Yield</span>
                        <span className="text-slate-200 font-mono">2-6%</span>
                    </div>
                    <div className="w-full h-[1px] bg-slate-700"></div>
                    <div className="flex items-center justify-between text-base font-bold">
                        <span className="text-wealth-gold">VIDDHANA Target Yield</span>
                        <span className="text-wealth-emerald font-mono">8-15%</span>
                    </div>
                </div>
            </div>
            
            <div className="relative w-64 h-72 bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 flex justify-around items-end">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none opacity-10">
                   <div className="w-full h-[1px] bg-slate-400"></div>
                   <div className="w-full h-[1px] bg-slate-400"></div>
                   <div className="w-full h-[1px] bg-slate-400"></div>
                   <div className="w-full h-[1px] bg-slate-400"></div>
                </div>

                {/* Bank Bar */}
                <div className="w-20 flex flex-col justify-end items-center h-full z-10 group">
                    <div className="flex-1 w-full flex items-end justify-center relative mb-3">
                        <motion.div 
                            className="w-full bg-slate-500 rounded-t-md opacity-80"
                            initial={{ height: 0 }}
                            whileInView={{ height: '30%' }}
                            transition={{ duration: 1 }}
                        />
                        <div className="absolute top-[60%] text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">Real Loss</div>
                    </div>
                    <div className="h-8 flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Traditional<br/>Bank</div>
                </div>

                {/* VIDDHANA Bar */}
                <div className="w-20 flex flex-col justify-end items-center h-full z-10">
                     <div className="flex-1 w-full flex items-end justify-center relative mb-3">
                        <motion.div 
                            className="w-full bg-gradient-to-t from-wealth-emerald to-wealth-gold rounded-t-md shadow-[0_0_20px_rgba(16,185,129,0.3)] relative overflow-hidden"
                            initial={{ height: 0 }}
                            whileInView={{ height: '85%' }}
                            transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.2 }}
                        >
                           <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/30"></div>
                        </motion.div>
                        <div className="absolute -top-8 bg-wealth-gold text-slate-900 text-xs font-bold px-2 py-1 rounded shadow-lg">Win</div>
                    </div>
                     <div className="h-8 flex items-center text-[10px] font-bold text-wealth-emerald uppercase tracking-wider text-center">VIDDHANA<br/>OS</div>
                </div>
            </div>
        </div>
    )
}