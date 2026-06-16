'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Users,
  Package,
  Settings,
  LayoutDashboard,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/items', label: 'Items', icon: Package },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 min-h-screen bg-white text-slate-700 flex flex-col border-r border-slate-200">
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#3b5bdb]" />
          <span className="font-semibold text-[#1e3a5f] text-lg">InvoiceGen</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-50 text-[#0329c1]'
                : 'text-[#145d98] hover:bg-slate-50 hover:text-[#3b5bdb]'
            )}
          >
            <Icon
              className={cn(
                'w-4 h-4',
                pathname.startsWith(href) ? 'text-[#3b5bdb]' : 'text-[#4a7ab5]'
              )}
            />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-6 py-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">Invoice Generator v1.0</p>
      </div>
    </aside>
  );
}