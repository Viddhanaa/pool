/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { HeroScene, QuantumComputerScene } from './components/QuantumScene';
import { SurfaceCodeDiagram, TransformerDecoderDiagram, PerformanceMetricDiagram } from './components/Diagrams';
import { ArrowDown, Menu, X, Users, Globe, Building2, Shield, TrendingUp, Smartphone, Brain } from 'lucide-react';

const FeatureCard = ({ title, desc, icon, delay }: { title: string, desc: string, icon: React.ReactNode, delay: string }) => {
  return (
    <div className="flex flex-col group animate-fade-in-up items-start p-8 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 w-full hover:border-wealth-gold/30" style={{ animationDelay: delay }}>
      <div className="mb-4 text-wealth-emerald p-3 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
        {icon}
      </div>
      <h3 className="font-serif text-2xl text-slate-900 mb-3">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
};

const PersonaCard = ({ name, role, goal, result }: { name: string, role: string, goal: string, result: string }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl font-serif text-slate-700">
                {name.charAt(0)}
            </div>
            <div>
                <h4 className="font-bold text-slate-900">{name}</h4>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{role}</p>
            </div>
        </div>
        <div className="space-y-3">
            <p className="text-sm text-slate-600"><strong className="text-slate-900">Goal:</strong> {goal}</p>
            <div className="h-[1px] bg-slate-100"></div>
            <p className="text-sm text-emerald-700 font-medium"><strong className="text-emerald-800">Result:</strong> {result}</p>
        </div>
    </div>
);

const App: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-wealth-gold selection:text-white">
      
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 bg-gradient-to-br from-wealth-gold to-yellow-600 rounded-lg flex items-center justify-center text-white font-serif font-bold text-2xl shadow-md">V</div>
            <span className={`font-serif font-bold text-xl tracking-tight transition-opacity ${scrolled ? 'text-slate-900' : 'text-slate-900 md:text-white'} `}>
              VIDDHANA
            </span>
          </div>
          
          <div className={`hidden md:flex items-center gap-8 text-sm font-medium tracking-wide ${scrolled ? 'text-slate-600' : 'text-white/90'}`}>
            <a href="#vision" onClick={scrollToSection('vision')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Vision</a>
            <a href="#architecture" onClick={scrollToSection('architecture')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Technology</a>
            <a href="#ecosystem" onClick={scrollToSection('ecosystem')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Ecosystem</a>
            <a href="#roadmap" onClick={scrollToSection('roadmap')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Roadmap</a>
            <a 
              href="#"
              className={`px-6 py-2 rounded-full transition-colors shadow-sm cursor-pointer font-bold ${scrolled ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-900 hover:bg-slate-100'}`}
            >
              Get App
            </a>
          </div>

          <button className={`md:hidden p-2 ${scrolled ? 'text-slate-900' : 'text-white'}`} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col items-center justify-center gap-8 text-xl font-serif animate-fade-in text-slate-900">
            <a href="#vision" onClick={scrollToSection('vision')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Vision</a>
            <a href="#architecture" onClick={scrollToSection('architecture')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Technology</a>
            <a href="#ecosystem" onClick={scrollToSection('ecosystem')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Ecosystem</a>
            <a href="#roadmap" onClick={scrollToSection('roadmap')} className="hover:text-wealth-gold transition-colors cursor-pointer uppercase">Roadmap</a>
            <a 
              href="#"
              onClick={() => setMenuOpen(false)} 
              className="px-8 py-3 bg-wealth-emerald text-white rounded-full shadow-lg cursor-pointer"
            >
              Get Beta Access
            </a>
        </div>
      )}

      {/* Hero Section */}
      <header className="relative h-screen flex items-center justify-center overflow-hidden bg-slate-900">
        <HeroScene />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(15,23,42,0)_0%,rgba(15,23,42,0.8)_80%,rgba(15,23,42,1)_100%)]" />

        <div className="relative z-10 container mx-auto px-6 text-center text-white">
          <div className="inline-block mb-6 px-4 py-1.5 border border-wealth-gold/50 text-wealth-gold text-xs tracking-[0.2em] uppercase font-bold rounded-full backdrop-blur-md bg-white/5">
            The Personal Wealth Operating System
          </div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium leading-tight mb-8 drop-shadow-2xl">
            Democratizing <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-wealth-gold to-yellow-200">Wealth Creation</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-300 font-light leading-relaxed mb-12">
            AI-driven insights. Real-world assets on-chain. Community-powered growth. <br/>
            Unlock the power of <span className="font-bold text-white">AI + L3 Blockchain + DeFi + DePIN</span>.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center">
             <a href="#vision" onClick={scrollToSection('vision')} className="px-8 py-4 bg-wealth-emerald text-white font-bold rounded-full hover:bg-emerald-600 transition-all shadow-lg hover:shadow-emerald-500/30 transform hover:-translate-y-1">
                Start Your Journey
             </a>
             <a href="#whitepaper" className="px-8 py-4 border border-white/30 text-white font-bold rounded-full hover:bg-white/10 transition-all backdrop-blur-sm">
                Read Whitepaper
             </a>
          </div>
        </div>
        
        <div className="absolute bottom-10 left-0 right-0 flex justify-center animate-bounce">
            <ArrowDown className="text-white/50" />
        </div>
      </header>

      <main>
        {/* Vision / Problem Section */}
        <section id="vision" className="py-24 bg-white">
          <div className="container mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block mb-3 text-xs font-bold tracking-widest text-wealth-emerald uppercase">The Challenge</div>
              <h2 className="font-serif text-4xl mb-6 leading-tight text-slate-900">You Create Value.<br/>Who Keeps It?</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                In the traditional financial system, inflation eats your savings (avg. 5-10%), while banks keep the real profits. You face high fees, opaque processes, and barriers to high-yield investments.
              </p>
              <div className="space-y-4">
                  <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <p className="text-slate-700"><strong>Assets Locked:</strong> Real estate, vehicles, and savings are illiquid.</p>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <p className="text-slate-700"><strong>High Friction:</strong> 5-10% fees for cross-border transfers.</p>
                  </div>
                  <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <p className="text-slate-700"><strong>No Guidance:</strong> Professional advice requires $100k+ capital.</p>
                  </div>
              </div>
            </div>
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <PerformanceMetricDiagram />
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section id="architecture" className="py-24 bg-slate-50 border-t border-slate-200">
            <div className="container mx-auto px-6 text-center mb-16">
                <h2 className="font-serif text-4xl md:text-5xl mb-4 text-slate-900">The "Quad-Core" Engine</h2>
                <p className="text-slate-600 max-w-2xl mx-auto">
                    VIDDHANA isn't just an app. It's a vertically integrated ecosystem combining four revolutionary technologies.
                </p>
            </div>
            
            <div className="container mx-auto px-6">
                <SurfaceCodeDiagram />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
                    <FeatureCard 
                        title="AI Prometheus" 
                        desc="Your 24/7 financial co-pilot. Analyzes risk profiles, predicts market trends, and auto-balances your portfolio."
                        icon={<Brain />}
                        delay="0s"
                    />
                    <FeatureCard 
                        title="Atlas Chain L3" 
                        desc="A custom blockchain layer built for speed (100k TPS) and near-zero fees (<$0.001), enabling micro-transactions."
                        icon={<TrendingUp />}
                        delay="0.1s"
                    />
                    <FeatureCard 
                        title="DeFi + RWA" 
                        desc="Tokenize real-world assets like real estate and solar farms. Unlock liquidity and earn passive income."
                        icon={<Building2 />}
                        delay="0.2s"
                    />
                    <FeatureCard 
                        title="DePIN & SocialFi" 
                        desc="Verify physical assets via IoT sensors and earn rewards. Learn and grow with the community."
                        icon={<Users />}
                        delay="0.3s"
                    />
                </div>
            </div>
        </section>

        {/* Workflow Section */}
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                     <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold tracking-widest uppercase rounded-full mb-6">
                            SYSTEM WORKFLOW
                        </div>
                        <h2 className="font-serif text-4xl md:text-5xl mb-6 text-slate-900">From Cash to Wealth</h2>
                        <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                            Connect your bank account, wallet, or physical assets. Our AI analyzes your financial DNA and builds a personalized strategy executed automatically on-chain.
                        </p>
                        <TransformerDecoderDiagram />
                     </div>
                     <div className="relative">
                        <div className="aspect-[4/3] bg-slate-900 rounded-xl overflow-hidden relative shadow-2xl border border-slate-700">
                            <QuantumComputerScene />
                            <div className="absolute top-6 left-6 text-white/90 font-serif text-lg z-10">RWA Tokenization Engine</div>
                            <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-400 font-mono">Visualizing Real-Time Asset Fractionalization</div>
                        </div>
                     </div>
                </div>
            </div>
        </section>

        {/* Use Cases / Ecosystem */}
        <section id="ecosystem" className="py-24 bg-slate-900 text-white">
             <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="font-serif text-4xl mb-6">Empowering Everyone</h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Whether you are a teacher, a freelancer, or a farmer, VIDDHANA adapts to your needs.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <PersonaCard 
                        name="Minh" 
                        role="Software Engineer, Hanoi" 
                        goal="Buy a house ($200k) in 3 years." 
                        result="AI optimized portfolio with 12% APY. Automated savings."
                    />
                    <PersonaCard 
                        name="Maria" 
                        role="Freelancer, Manila" 
                        goal="Receive USD payments without high fees." 
                        result="Instant cross-border settlement via Atlas Chain. 0.1% fee."
                    />
                    <PersonaCard 
                        name="Tung" 
                        role="Farmer, Mekong Delta" 
                        goal="Protect income against weather risks." 
                        result="DePIN sensors triggered insurance smart contract. Instant payout."
                    />
                </div>
             </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="py-24 bg-slate-50 border-t border-slate-200">
           <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <div className="inline-block mb-3 text-xs font-bold tracking-widest text-slate-500 uppercase">THE FUTURE</div>
                    <h2 className="font-serif text-3xl md:text-5xl mb-4 text-slate-900">Road to 2028</h2>
                </div>
                
                <div className="max-w-4xl mx-auto space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {/* Item 1 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-wealth-emerald shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                            <span className="w-3 h-3 bg-white rounded-full"></span>
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-bold text-slate-900">Phase 1: Foundation</div>
                                <time className="font-mono text-xs font-medium text-slate-500">2025</time>
                            </div>
                            <div className="text-slate-500 text-sm">Launch MVP in Vietnam & Singapore. Atlas Chain Testnet. AI Alpha. 50k Users.</div>
                        </div>
                    </div>

                    {/* Item 2 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                            <span className="w-3 h-3 bg-white rounded-full"></span>
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-bold text-slate-900">Phase 2: Expansion</div>
                                <time className="font-mono text-xs font-medium text-slate-500">2026</time>
                            </div>
                            <div className="text-slate-500 text-sm">Indonesia & Thailand expansion. RWA Tokenization (Solar, 5G). Mainnet Launch. 500k Users.</div>
                        </div>
                    </div>

                    {/* Item 3 */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                            <span className="w-3 h-3 bg-white rounded-full"></span>
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-bold text-slate-900">Phase 3: Global Scale</div>
                                <time className="font-mono text-xs font-medium text-slate-500">2027-2028</time>
                            </div>
                            <div className="text-slate-500 text-sm">India & Korea markets. Full DAO Governance. Government e-ID integration. 10M Users.</div>
                        </div>
                    </div>
                </div>
           </div>
        </section>

      </main>

      <footer className="bg-slate-900 text-slate-400 py-16 border-t border-slate-800">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
                <div className="text-white font-serif font-bold text-3xl mb-2 tracking-tight">VIDDHANA</div>
                <p className="text-sm max-w-md">The Personal Wealth Operating System. Democratizing wealth through AI, Blockchain, and Community.</p>
            </div>
            <div className="flex gap-6">
                <a href="#" className="hover:text-wealth-gold transition-colors">Whitepaper</a>
                <a href="#" className="hover:text-wealth-gold transition-colors">Documentation</a>
                <a href="#" className="hover:text-wealth-gold transition-colors">Community</a>
                <a href="#" className="hover:text-wealth-gold transition-colors">Contact</a>
            </div>
        </div>
        <div className="text-center mt-12 text-xs text-slate-600">
            © 2025 VIDDHANA Foundation. Built for the future of finance.
        </div>
      </footer>
    </div>
  );
};

export default App;