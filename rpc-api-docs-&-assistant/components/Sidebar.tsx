import React, { useMemo } from 'react';
import { Search, Box, Layers, Database, CreditCard } from 'lucide-react';
import { RpcMethod } from '../types';

interface SidebarProps {
  methods: RpcMethod[];
  selectedMethod: RpcMethod | null;
  onSelectMethod: (method: RpcMethod) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'users': return <Database size={16} />;
    case 'billing': return <CreditCard size={16} />;
    case 'compute': return <Layers size={16} />;
    default: return <Box size={16} />;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  methods,
  selectedMethod,
  onSelectMethod,
  searchTerm,
  onSearchChange,
}) => {
  
  const filteredMethods = useMemo(() => {
    return methods.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.summary.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [methods, searchTerm]);

  // Group by category
  const groupedMethods = useMemo(() => {
    const groups: Record<string, RpcMethod[]> = {};
    filteredMethods.forEach(m => {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    });
    return groups;
  }, [filteredMethods]);

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col border-r border-slate-800 text-slate-300 fixed left-0 top-0 overflow-hidden">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Box className="text-indigo-500" />
          Nova RPC
        </h1>
        <div className="mt-4 relative">
          <Search className="absolute left-2.5 top-2.5 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Search methods..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-800 text-sm text-white pl-8 pr-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {Object.entries(groupedMethods).map(([category, items]) => (
          <div key={category} className="mb-6">
            <h3 className="px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              {getCategoryIcon(category)}
              {category}
            </h3>
            <ul>
              {(items as RpcMethod[]).map((method) => (
                <li key={method.name}>
                  <button
                    onClick={() => onSelectMethod(method)}
                    className={`w-full text-left px-6 py-2 text-sm transition-colors border-l-2 ${
                      selectedMethod?.name === method.name
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500'
                        : 'border-transparent hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {method.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {filteredMethods.length === 0 && (
          <div className="px-6 text-sm text-slate-500">No methods found.</div>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        v2.5.0 &bull; 2024
      </div>
    </div>
  );
};