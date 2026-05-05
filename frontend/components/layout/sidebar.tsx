"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "user:read",
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    permission: null,
  },
  { href: "/users", label: "Users", icon: Users, permission: "user:read" },
  {
    href: "/roles",
    label: "Roles",
    icon: ShieldCheck,
    permission: "role:read",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  return (
    <aside className='w-64 bg-white border-r border-gray-200 flex flex-col'>
      <div className='flex items-center gap-3 px-6 py-5 border-b border-gray-100'>
        <BrandLogo size={38} />
        <div>
          <span className='font-bold text-gray-900 text-lg'>NexusAI</span>
          <p className='text-xs text-gray-400 leading-none'>Project Manager</p>
        </div>
      </div>

      <nav className='flex-1 px-3 py-4 space-y-1'>
        {navItems.map((item) => {
          if (item.permission && !hasPermission(item.permission)) return null;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )}
            >
              <item.icon
                size={18}
                className={cn(
                  isActive
                    ? "text-blue-600"
                    : "text-gray-400 group-hover:text-gray-600",
                )}
              />
              <span className='flex-1'>{item.label}</span>
              {isActive && <ChevronRight size={14} className='text-blue-400' />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
