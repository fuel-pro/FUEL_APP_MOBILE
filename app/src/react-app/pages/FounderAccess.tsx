import React, { useState, useEffect } from "react";
import { Crown } from "lucide-react";

export default function FounderAccess() {
  const [showContent, setShowContent] = useState(false);
  
  useEffect(() => {
    console.log("FounderAccess mounted");
    setShowContent(true);
  }, []);

  if (!showContent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Founder Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      <header className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Crown className="text-amber-400" size={24} />
          <h1 className="text-xl font-bold">Founder Dashboard</h1>
        </div>
      </header>
      <main className="p-6">
        <div className="bg-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Welcome to Founder Dashboard</h2>
          <p className="text-gray-300">This is a simplified version of the founder dashboard.</p>
        </div>
      </main>
    </div>
  );
}
