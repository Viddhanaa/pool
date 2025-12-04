import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MethodViewer } from './components/MethodViewer';
import { RPC_METHODS } from './constants';
import { RpcMethod } from './types';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [selectedMethod, setSelectedMethod] = useState<RpcMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize with first method
  useEffect(() => {
    if (RPC_METHODS.length > 0) {
      setSelectedMethod(RPC_METHODS[0]);
    }
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-20 transition-opacity lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar Container */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar 
          methods={RPC_METHODS}
          selectedMethod={selectedMethod}
          onSelectMethod={(method) => {
            setSelectedMethod(method);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        <header className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center gap-4 lg:hidden">
           <button onClick={toggleSidebar} className="p-2 -ml-2 text-slate-600 hover:bg-slate-200 rounded-md">
             <Menu size={24} />
           </button>
           <span className="font-semibold text-slate-900">Nova RPC Docs</span>
        </header>
        
        <div className="p-6 lg:p-12 max-w-7xl mx-auto">
          {selectedMethod ? (
            <MethodViewer method={selectedMethod} />
          ) : (
            <div className="flex flex-col items-center justify-center h-[80vh] text-slate-400">
              <p className="text-lg">Select a method to view documentation.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
