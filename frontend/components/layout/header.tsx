"use client";

import { useAuth } from "@/lib/auth";
import { LogOut, User } from "lucide-react";
import { getInitials } from "@/lib/utils";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className='bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between'>
      <div />
      <div className='flex items-center gap-3'>
        <div className='text-right'>
          <p className='text-sm font-medium text-gray-900'>{user?.name}</p>
          <p className='text-xs text-gray-400'>
            {user?.role?.name || "No role"}
          </p>
        </div>
        <div className='bg-blue-100 text-blue-700 font-semibold rounded-full w-9 h-9 flex items-center justify-center text-sm'>
          {user?.name ? getInitials(user.name) : <User size={16} />}
        </div>
        <button
          onClick={logout}
          className='p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors'
          title='Sign out'
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
