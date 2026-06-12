"use client";

import { Plus, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project, User } from "@/lib/types";

export interface ProjectMembersProps {
  project: Project;
  users: User[];
  projectRoles: string[];
  memberIds: Set<number>;
  addMemberDialog: { userId: number; name: string } | null;
  setAddMemberDialog: (v: { userId: number; name: string } | null) => void;
  addMemberRole: string;
  setAddMemberRole: (v: string) => void;
  editingRole: { userId: number; value: string } | null;
  setEditingRole: (v: { userId: number; value: string } | null) => void;
  canProject: (permission: string) => boolean;
  openRolesEditor: () => void;
  addMemberMutation: any;
  updateMemberRoleMutation: any;
  removeMemberMutation: any;
}

export function ProjectMembers({
  project,
  users,
  projectRoles,
  memberIds,
  addMemberDialog,
  setAddMemberDialog,
  addMemberRole,
  setAddMemberRole,
  editingRole,
  setEditingRole,
  canProject,
  openRolesEditor,
  addMemberMutation,
  updateMemberRoleMutation,
  removeMemberMutation,
}: ProjectMembersProps) {
  return (
    <div className='space-y-3'>
      <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400'>
            Project roles
          </p>
          <div className='flex flex-wrap gap-2'>
            {projectRoles.map((role: string) => (
              <span
                key={role}
                className='text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium'
              >
                {role}
              </span>
            ))}
          </div>
          <p className='text-xs text-zinc-400 dark:text-zinc-500'>
            Project managers can create and name custom roles for each project.
          </p>
        </div>
        {canProject("project:update") && (
          <button
            onClick={openRolesEditor}
            className='self-start px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5'
          >
            Manage roles
          </button>
        )}
      </div>

      {canProject("project:update") && (
        <div>
          <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2'>
            Add member
          </p>
          <div className='flex flex-wrap gap-2'>
            {users
              .filter((u: any) => !memberIds.has(u.id))
              .map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setAddMemberDialog({ userId: u.id, name: u.name });
                    setAddMemberRole(projectRoles[0] || "");
                  }}
                  className='flex items-center gap-2 px-3 py-1.5 border border-dashed border-gray-300 rounded-full text-sm text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 transition-colors'
                >
                  <Plus size={12} /> {u.name}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200 dark:border-white/5 divide-y divide-gray-50'>
        {!project.members || project.members.length === 0 ? (
          <p className='text-center text-zinc-400 dark:text-zinc-500 py-8'>No members yet</p>
        ) : (
          project.members.map((m) => (
            <div
              key={m.userId}
              className='px-4 py-3 flex items-center gap-3'
            >
              <div className='bg-blue-100 text-blue-700 font-semibold rounded-full w-8 h-8 flex items-center justify-center text-xs flex-shrink-0'>
                {m.user.name.charAt(0).toUpperCase()}
              </div>
              <div className='flex-1'>
                <p className='font-medium text-zinc-900 dark:text-zinc-100 text-sm'>
                  {m.user.name}
                </p>
                {editingRole?.userId === m.userId ? (
                  <div className='flex items-center gap-1.5 mt-0.5'>
                    <select
                      value={editingRole!.value}
                      onChange={(e) =>
                        setEditingRole({
                          userId: m.userId,
                          value: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          updateMemberRoleMutation.mutate({
                            userId: m.userId,
                            projectRole: editingRole!.value,
                          });
                        if (e.key === "Escape") setEditingRole(null);
                      }}
                      className='text-xs bg-transparent dark:text-zinc-100 border border-blue-300 dark:border-blue-500/50 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-36'
                    >
                      {projectRoles.map((role: string) => (
                        <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        updateMemberRoleMutation.mutate({
                          userId: m.userId,
                          projectRole: editingRole!.value,
                        })
                      }
                      className='text-xs text-blue-600 hover:text-blue-800 font-medium'
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRole(null)}
                      className='text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:text-zinc-400'
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className='flex items-center gap-1 mt-0.5'>
                    <span className='text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full'>
                      {m.projectRole ||
                        m.user.role?.name ||
                        "No role assigned"}
                    </span>
                    {canProject("project:update") && (
                      <button
                        onClick={() =>
                          setEditingRole({
                            userId: m.userId,
                            value:
                              (m.projectRole && projectRoles.includes(m.projectRole)
                                ? m.projectRole
                                : projectRoles[0]) || "",
                          })
                        }
                        className='p-0.5 text-gray-300 hover:text-blue-500'
                      >
                        <Pencil size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {canProject("project:update") && (
                <button
                  onClick={() => removeMemberMutation.mutate(m.userId)}
                  className='p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded'
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Member Dialog */}
      {addMemberDialog && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm p-6'>
            <h3 className='font-semibold text-zinc-900 dark:text-zinc-100 mb-1'>Add member</h3>
            <p className='text-sm text-zinc-500 dark:text-zinc-400 mb-4'>
              Set the role for{" "}
              <span className='font-medium text-gray-800 dark:text-zinc-200'>
                {addMemberDialog.name}
              </span>{" "}
              in this project.
            </p>
            <div className='space-y-3'>
              <div>
                <label className='text-xs font-medium text-zinc-600 dark:text-zinc-400 block mb-1'>
                  Project role
                </label>
                {canProject("project:update") && (
                  <div className='flex justify-end mb-1'>
                    <button
                      type='button'
                      onClick={() => {
                        setAddMemberDialog(null);
                        openRolesEditor();
                      }}
                      className='text-xs text-blue-600 hover:text-blue-700'
                    >
                      Manage roles
                    </button>
                  </div>
                )}
                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value)}
                  className='w-full bg-transparent text-sm border border-zinc-200 dark:border-white/10 dark:text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400'
                >
                  {projectRoles.map((role: string) => (
                    <option className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200" key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className='flex gap-2 mt-5'>
              <button
                onClick={() => setAddMemberDialog(null)}
                className='flex-1 px-4 py-2 border border-zinc-200 dark:border-white/10 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:bg-white/5'
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  addMemberMutation.mutate({
                    userId: addMemberDialog.userId,
                    projectRole: addMemberRole,
                  })
                }
                disabled={addMemberMutation.isPending}
                className='flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2'
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
