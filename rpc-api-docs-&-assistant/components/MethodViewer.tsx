import React, { useState } from 'react';
import { RpcMethod } from '../types';
import { CodeGenerator } from './CodeGenerator';
import { explainMethod } from '../services/geminiService';
import { MessageSquare, Send, X, Loader2, AlertCircle } from 'lucide-react';

interface MethodViewerProps {
  method: RpcMethod;
}

export const MethodViewer: React.FC<MethodViewerProps> = ({ method }) => {
  const [askQuery, setAskQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim()) return;
    setAsking(true);
    setAiAnswer(null);
    
    const answer = await explainMethod(method, askQuery);
    
    setAiAnswer(answer);
    setAsking(false);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-8 border-b border-slate-200 pb-8">
        <div className="flex items-center gap-3 mb-2 text-sm font-medium text-slate-500">
          <span className="uppercase tracking-wide">{method.category}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>RPC Method</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{method.name}</h1>
        <p className="text-lg text-slate-600 leading-relaxed">{method.description}</p>
      </div>

      {/* Request Parameters */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          Request Parameters
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Required</th>
                <th className="px-6 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {method.params.map((param) => (
                <tr key={param.name} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-mono text-indigo-600">{param.name}</td>
                  <td className="px-6 py-4 font-mono text-slate-500">{param.type}</td>
                  <td className="px-6 py-4">
                    {param.required ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Required
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        Optional
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{param.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Response */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Response</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Structure</h3>
            <p className="text-slate-600 mb-4 text-sm">{method.result.description}</p>
            <div className="bg-slate-50 rounded border border-slate-200 p-4">
              <pre className="text-xs text-slate-700 overflow-auto font-mono">
                {JSON.stringify(method.result.schema, null, 2)}
              </pre>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
             <h3 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Example Return</h3>
             {method.examples && method.examples[0] && (
               <div className="bg-slate-900 rounded border border-slate-800 p-4 h-full">
                  <pre className="text-xs text-emerald-400 overflow-auto font-mono">
                    {JSON.stringify(method.examples[0].result, null, 2)}
                  </pre>
               </div>
             )}
          </div>
        </div>
      </section>

      {/* AI Assistant Section */}
      <section className="mb-12">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center gap-2">
            <MessageSquare size={20} />
            Ask Gemini about {method.name}
          </h3>
          <p className="text-indigo-700/80 text-sm mb-4">
            Confused about a parameter? Need a specific use case? Ask below.
          </p>
          
          <form onSubmit={handleAsk} className="relative">
            <input 
              type="text" 
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder={`e.g., "What happens if I pass an invalid ID?"`}
              className="w-full pl-4 pr-12 py-3 rounded-lg border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-slate-700 placeholder-slate-400 shadow-sm"
            />
            <button 
              type="submit"
              disabled={asking || !askQuery.trim()}
              className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {asking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>

          {aiAnswer && (
            <div className="mt-4 bg-white rounded-lg p-4 border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-indigo-500 uppercase">Gemini Answer</span>
                <button onClick={() => setAiAnswer(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
            </div>
          )}
        </div>
      </section>

      {/* Code Generation Section */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Integration</h2>
        <CodeGenerator method={method} />
      </section>
      
      {/* Errors Section */}
      {method.errors && method.errors.length > 0 && (
        <section className="mt-12 pt-8 border-t border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 text-red-600 flex items-center gap-2">
            <AlertCircle size={20} />
            Possible Errors
          </h2>
           <div className="grid gap-4 md:grid-cols-2">
             {method.errors.map(err => (
               <div key={err.code} className="bg-red-50 border border-red-100 p-4 rounded-lg">
                 <div className="flex items-center justify-between mb-2">
                   <span className="font-mono font-bold text-red-700 text-lg">{err.code}</span>
                   <span className="text-xs font-bold text-red-500 uppercase tracking-wider">{err.message}</span>
                 </div>
                 <p className="text-sm text-red-800/80">{err.description}</p>
               </div>
             ))}
           </div>
        </section>
      )}
    </div>
  );
};
