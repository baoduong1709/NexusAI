"use client";

import { useQuery } from "@tanstack/react-query";
import { projectsApi, usersApi } from "@/lib/api";
import {
  FolderKanban,
  Users,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { formatDate, PROJECT_STATUS_COLORS, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
  });
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll().then((r) => r.data),
  });

  const stats = [
    {
      label: "Total Projects",
      value: projects?.length ?? "-",
      icon: FolderKanban,
      color: "bg-blue-50 text-blue-600",
      href: "/projects",
    },
    {
      label: "Active Projects",
      value: projects?.filter((p: any) => p.status === "ACTIVE").length ?? "-",
      icon: Clock,
      color: "bg-yellow-50 text-yellow-600",
      href: "/projects",
    },
    {
      label: "Users",
      value: users?.length ?? "-",
      icon: Users,
      color: "bg-green-50 text-green-600",
      href: "/users",
    },
    {
      label: "Completed Projects",
      value:
        projects?.filter((p: any) => p.status === "COMPLETED").length ?? "-",
      icon: CheckCircle,
      color: "bg-purple-50 text-purple-600",
      href: "/projects",
    },
  ];

  const isLoading = projectsLoading || usersLoading;

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>
          Welcome back, {user?.name?.split(" ").pop()}
        </h1>
        <p className='text-gray-500 mt-1'>
          Here is a quick overview of your NexusAI workspace
        </p>
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className='bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow'
          >
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-gray-500'>{s.label}</p>
                <p className='text-3xl font-bold text-gray-900 mt-1'>
                  {isLoading ? (
                    <Loader2 className='animate-spin' size={24} />
                  ) : (
                    s.value
                  )}
                </p>
              </div>
              <div className={cn("p-3 rounded-xl", s.color)}>
                <s.icon size={22} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className='bg-white rounded-xl border border-gray-100'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100'>
          <h2 className='font-semibold text-gray-800'>Recent Projects</h2>
          <Link
            href='/projects'
            className='text-sm text-blue-600 hover:underline'
          >
            View all
          </Link>
        </div>
        <div className='divide-y divide-gray-50'>
          {isLoading ? (
            <div className='py-8 flex justify-center'>
              <Loader2 className='animate-spin text-blue-500' />
            </div>
          ) : projects?.length === 0 ? (
            <p className='text-center text-gray-400 py-8'>No projects yet</p>
          ) : (
            projects?.slice(0, 5).map((p: any) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className='flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors'
              >
                <div>
                  <p className='font-medium text-gray-900'>{p.name}</p>
                  <p className='text-sm text-gray-400 mt-0.5'>
                    {p._count?.tasks} tasks | {p.members?.length} members
                  </p>
                </div>
                <div className='flex items-center gap-3'>
                  <span
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium",
                      PROJECT_STATUS_COLORS[
                        p.status as keyof typeof PROJECT_STATUS_COLORS
                      ],
                    )}
                  >
                    {p.status}
                  </span>
                  <span className='text-xs text-gray-400'>
                    {formatDate(p.createdAt)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
