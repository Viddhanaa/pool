import React, { useState } from 'react';
import { RpcMethod, ProgrammingLanguage } from '../types';
import { generateClientCode } from '../services/geminiService';
import { Code, Terminal, Check, Copy, Loader2, Sparkles } from 'lucide-react';

interface CodeGeneratorProps {
  method: RpcMethod;
}

export const CodeGenerator: React.FC<CodeGeneratorProps> = ({ method }) => {
  const [selectedLang, setSelectedLang] = useState<ProgrammingLanguage>(ProgrammingLanguage.JavaScript);
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setHasGenerated(false);
    setCode(''); // Clear previous
    const result = await generateClientCode(method, selectedLang);
    setCode(result);
    setLoading(false);
    setHasGenerated(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700/50 mt-8">
      <div className="bg-slate-800/50 px-4 py-3 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2 text-indigo-400 font-medium">
          <Sparkles size={18} />
          <span>AI Client Generator</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedLang}
            onChange={(e) => {
              setSelectedLang(e.target.value as ProgrammingLanguage);
              setHasGenerated(false); // Reset so user has to click generate again for new lang
            }}
            className="bg-slate-900 text-slate-300 text-sm border border-slate-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
          >
            {Object.values(ProgrammingLanguage).map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
              loading 
                ? 'bg-indigo-500/20 text-indigo-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Generating...
              </>
            ) : (
              <>Generate Code</>
            )}
          </button>
        </div>
      </div>

      <div className="p-0 bg-slate-950 min-h-[150px] relative group">
        {!hasGenerated && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
            <div className="text-center">
              <Terminal size={32} className="mx-auto mb-2 opacity-50" />
              <p>Select a language and click Generate</p>
            </div>
          </div>
        )}
        
        {loading && !hasGenerated && (
           <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
             <div className="flex flex-col items-center animate-pulse">
               <Code size={32} className="mb-3" />
               <p className="text-sm">Gemini is writing code for {method.name}...</p>
             </div>
           </div>
        )}

        {hasGenerated && (
          <>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-md border border-slate-700 shadow-sm"
                title="Copy Code"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>
            <pre className="p-4 text-sm font-mono text-slate-300 overflow-x-auto">
              <code>{code}</code>
            </pre>
          </>
        )}
      </div>
      
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
        <span>Powered by Gemini 2.5 Flash</span>
        <span>Generated code may require adjustment.</span>
      </div>
    </div>
  );
};
