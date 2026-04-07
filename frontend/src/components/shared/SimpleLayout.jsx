import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'v0.1.0';

export default function SimpleLayout({ children }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top header */}
      <header className="flex items-center justify-between px-4 py-3 bg-atd-dark border-b border-gray-600 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-white text-xl font-bold leading-tight">ATD QBO</div>
        </div>
        <span className="text-xs text-gray-500">{APP_VERSION}</span>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
