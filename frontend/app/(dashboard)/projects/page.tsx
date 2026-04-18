"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  FolderKanban,
  Users,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { formatDate, PROJECT_STATUS_COLORS, cn } from "@/lib/utils";
import {
  DEFAULT_PROJECT_ROLES,
  normalizeProjectRoles,
} from "@/lib/project-roles";

export default function ProjectsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [projectRoleDraft, setProjectRoleDraft] = useState<string[]>(
    DEFAULT_PROJECT_ROLES,
  );
  const [newProjectRole, setNewProjectRole] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => projectsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const { register, handleSubmit, reset } = useForm<any>();

  const openCreate = () => {
    reset();
    setProjectRoleDraft(DEFAULT_PROJECT_ROLES);
    setNewProjectRole("");
    setShowModal(true);
  };

  const onSubmit = (data: any) =>
    createMutation.mutate({
      ...data,
      projectRoles: normalizeProjectRoles(projectRoleDraft),
    });

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Projects</h1>
          <p className='text-gray-500 text-sm mt-1'>{projects.length} projects</p>
        </div>
        {hasPermission("project:create") && (
          <button
            onClick={openCreate}
            className='flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium'
          >
            <Plus size={16} /> Create Project
          </button>
        )}
      </div>

      {isLoading ? (
        <div className='py-12 flex justify-center'>
          <Loader2 className='animate-spin text-blue-500' />
        </div>
      ) : projects.length === 0 ? (
        <div className='text-center py-16 text-gray-400'>
          <FolderKanban size={40} className='mx-auto mb-3 opacity-40' />
          <p>No projects yet. Create your first project.</p>
        </div>
      ) : (
        <div className='grid gap-4 lg:grid-cols-2 xl:grid-cols-3'>
          {projects.map((p: any) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className='bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all hover:border-blue-100 group'
            >
              <div className='flex items-start justify-between mb-3'>
                <h3 className='font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-1'>
                  {p.name}
                </h3>
                <span
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ml-2",
                    PROJECT_STATUS_COLORS[
                      p.status as keyof typeof PROJECT_STATUS_COLORS
                    ],
                  )}
                >
                  {p.status}
                </span>
              </div>
              {p.description && (
                <p className='text-sm text-gray-500 mb-3 line-clamp-2'>
                  {p.description}
                </p>
              )}
              <div className='flex items-center gap-4 text-xs text-gray-400'>
                <span className='flex items-center gap-1'>
                  <Users size={12} /> {p.members?.length} members
                </span>
                <span className='flex items-center gap-1'>
                  <FileText size={12} /> {p._count?.tasks} tasks
                </span>
                <span className='ml-auto'>{formatDate(p.startDate)}</span>
              </div>
              <div className='flex justify-end mt-3'>
                <ArrowRight
                  size={16}
                  className='text-gray-300 group-hover:text-blue-500 transition-colors'
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md'>
            <h3 className='font-bold text-lg text-gray-900 mb-4'>
              Create New Project
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-3'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Project Name *
                </label>
                <input
                  {...register("name", { required: true })}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-sm font-medium text-gray-700'>
                    Start Date
                  </label>
                  <input
                    {...register("startDate")}
                    type='date'
                    className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='text-sm font-medium text-gray-700'>
                    End Date
                  </label>
                  <input
                    {...register("endDate")}
                    type='date'
                    className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Budget (VND)
                </label>
                <input
                  {...register("budget", { valueAsNumber: true })}
                  type='number'
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div className='space-y-2'>
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <label className='text-sm font-medium text-gray-700'>
                      Project Roles
                    </label>
                    <p className='text-xs text-gray-400 mt-0.5'>
                      Define custom role names for this project at creation time.
                    </p>
                  </div>
                  <span className='text-xs text-gray-400'>
                    {projectRoleDraft.length} roles
                  </span>
                </div>
                <div className='space-y-2'>
                  {projectRoleDraft.map((role, index) => (
                    <div
                      key={`${role}-${index}`}
                      className='flex items-center gap-2'
                    >
                      <input
                        value={role}
                        onChange={(e) =>
                          setProjectRoleDraft((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? e.target.value : item,
                            ),
                          )
                        }
                        className='flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                        placeholder='Role name'
                      />
                      <button
                        type='button'
                        disabled={projectRoleDraft.length === 1}
                        onClick={() =>
                          setProjectRoleDraft((prev) =>
                            prev.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className='px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg disabled:opacity-40'
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className='flex items-center gap-2'>
                    <input
                      value={newProjectRole}
                      onChange={(e) => setNewProjectRole(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const role = newProjectRole.trim();
                        if (!role) return;
                        setProjectRoleDraft((prev) => [...prev, role]);
                        setNewProjectRole("");
                      }}
                      className='flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                      placeholder='Add a new role...'
                    />
                    <button
                      type='button'
                      onClick={() => {
                        const role = newProjectRole.trim();
                        if (!role) return;
                        setProjectRoleDraft((prev) => [...prev, role]);
                        setNewProjectRole("");
                      }}
                      className='px-3 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800'
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
              <div className='flex gap-2 justify-end mt-4'>
                <button
                  type='button'
                  onClick={() => setShowModal(false)}
                  className='px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={createMutation.isPending}
                  className='px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50'
                >
                  {createMutation.isPending && (
                    <Loader2 className='animate-spin' size={14} />
                  )}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
