import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  Settings,
  Zap,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', end: true },
  { to: '/dossiers', icon: FolderOpen, label: 'Dossiers' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
];

export function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Fyles</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Settings + User */}
      <div className="px-3 pb-4 space-y-1 border-t border-slate-700 pt-4">
        <NavLink
          to="/parametres"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <Settings size={18} />
          Paramètres
        </NavLink>
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2">
          <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            MD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">Marc Dupont</p>
            <p className="text-slate-500 text-xs truncate">Instructeur</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
