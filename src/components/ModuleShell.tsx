import React, { ReactNode } from 'react';
import { X, Search, Trash2 } from 'lucide-react';

interface ModuleShellProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ModuleShell({ icon, title, subtitle, onClose, actions, children, className = '' }: ModuleShellProps) {
  return (
    <div className="fixed top-11 left-0 right-0 bottom-0 z-50 flex flex-col bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="bg-[#1a6fa6] px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{title}</h2>
              {subtitle && <p className="text-sm text-white/70">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-white/70 hover:text-white" />
            </button>
          </div>
        </div>
        <div className={`flex-1 overflow-hidden flex flex-col ${className}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface ModalShellProps {
  icon?: ReactNode;
  title: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
}

export function ModalShell({ icon, title, onClose, actions, children, maxWidth = 'max-w-2xl', maxHeight = 'max-h-[90vh]' }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} ${maxHeight} flex flex-col`}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          {icon && <div className="w-9 h-9 rounded-xl bg-[#e8f3fc] flex items-center justify-center shrink-0">{icon}</div>}
          <h3 className="text-base font-bold text-gray-900 flex-1 min-w-0">{title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

interface TabBarProps {
  tabs: { key: string; label: string; icon?: ReactNode; badge?: ReactNode }[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeTab, onTabChange, className = '' }: TabBarProps) {
  return (
    <div className={`px-6 pt-3 pb-0 flex gap-1 shrink-0 border-b border-gray-200 bg-white items-center ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === tab.key
              ? 'border-[#1a6fa6] text-[#1a6fa6]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.badge}
        </button>
      ))}
    </div>
  );
}

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}

export function FilterBar({ searchValue, onSearchChange, searchPlaceholder = 'Rechercher…', children }: FilterBarProps) {
  return (
    <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0 flex-wrap">
      {onSearchChange && (
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder={searchPlaceholder} value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-sm w-full focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
        </div>
      )}
      {children}
    </div>
  );
}
