import Link from 'next/link';
import { auth0 } from '@/lib/auth0';
import { 
  LayoutDashboard, 
  CalendarDays, 
  PlusCircle, 
  CreditCard, 
  Settings, 
  LogOut,
  User
} from 'lucide-react';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession();
  const user = session?.user;

  const menuItems = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Events', href: '/dashboard/events', icon: CalendarDays },
    { name: 'Create Event', href: '/dashboard/events/create', icon: PlusCircle },
    { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="font-bold text-xl tracking-tight">Empiria <span className="text-orange-600">Org</span></div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Link 
              key={item.name} 
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-black transition-colors"
            >
              <item.icon size={18} />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
               {user?.picture ? <img src={user.picture} alt="User" /> : <User size={20} className="m-1.5"/>}
            </div>
            <div className="text-xs">
                <div className="font-semibold text-gray-900 truncate w-32">{user?.name}</div>
                <div className="text-gray-500 truncate w-32">{user?.email}</div>
            </div>
          </div>
          <a 
            href="/auth/logout" 
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
