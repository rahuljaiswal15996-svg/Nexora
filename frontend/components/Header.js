import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ensureDevSession, getWorkspaceSession, updateWorkspaceRole } from '../services/api';

export default function Header() {
  const [session, setSession] = useState(getWorkspaceSession());
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/platform', label: 'Platform' },
    { href: '/upload', label: 'Upload' },
    { href: '/compare', label: 'Compare' },
    { href: '/history', label: 'History' },
    { href: '/pipelines', label: 'Pipelines' },
    { href: '/notebooks', label: 'Notebooks' },
    { href: '/connections', label: 'Connections' },
    { href: '/review', label: 'Review' },
  ];

  useEffect(() => {
    let mounted = true;

    ensureDevSession()
      .then((nextSession) => {
        if (mounted) {
          setSession(nextSession);
        }
      })
      .catch((error) => {
        console.error('Unable to initialize session', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleRoleChange = async (event) => {
    const nextRole = event.target.value;
    setIsUpdatingRole(true);
    try {
      const nextSession = await updateWorkspaceRole(nextRole);
      setSession(nextSession);
    } catch (error) {
      console.error('Unable to change workspace role', error);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
    <header className="bg-surface shadow-sm border-b border-surface-hover">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-xl font-bold text-primary">Nexora</span>
            </Link>
          </div>

          <nav className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors text-accent hover:text-primary hover:bg-surface-hover`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden lg:flex items-center gap-3 rounded-lg border border-surface-hover bg-background px-3 py-2">
              <div className="text-right leading-tight">
                <div className="text-[10px] uppercase tracking-[0.2em] text-accent/60">Workspace</div>
                <div className="text-sm font-semibold text-primary">{session.tenant_id}</div>
              </div>
              <div className="h-8 w-px bg-surface-hover" />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-[0.2em] text-accent/60">Role</div>
                <select
                  value={session.role}
                  onChange={handleRoleChange}
                  disabled={isUpdatingRole}
                  className="bg-transparent text-sm font-semibold text-primary outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="hidden xl:block text-sm text-accent">{session.user}</div>
          </div>
        </div>
      </div>
    </header>
  );
}