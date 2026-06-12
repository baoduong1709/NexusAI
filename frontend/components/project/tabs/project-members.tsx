"use client";

import { Plus, Pencil, X, Users, UserPlus, Shield, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project, User } from "@/lib/types";
import { CustomSelect } from "@/components/ui/custom-select";

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

// Role badge color palette
function getRoleBadgeStyle(role: string) {
  const lower = role.toLowerCase();
  if (lower === "owner")
    return "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200/60 dark:ring-indigo-500/20";
  if (lower === "admin" || lower === "administrator")
    return "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-200/60 dark:ring-violet-500/20";
  if (lower === "member")
    return "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200/60 dark:ring-blue-500/20";
  if (lower === "viewer" || lower === "guest")
    return "bg-zinc-100 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-200/60 dark:ring-zinc-600/30";
  // Default fallback for custom roles
  return "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-200/60 dark:ring-sky-500/20";
}

// Avatar color palette – cycles through safe colors
const avatarColors = [
  "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300",
  "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300",
  "bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300",
  "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
  "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300",
  "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300",
];

function getAvatarColor(userId: number) {
  return avatarColors[userId % avatarColors.length];
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
  const nonMembers = users.filter((u: any) => !memberIds.has(u.id));

  return (
    <div className='space-y-4'>
      {/* ── Roles Overview Card ── */}
      <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200/80 dark:border-white/5 p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-2'>
          <div className='flex items-center gap-2'>
            <Shield size={14} className='text-zinc-400 dark:text-zinc-500' />
            <p className='text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400'>
              Project roles
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            {projectRoles.map((role: string) => (
              <span
                key={role}
                className={cn("text-xs px-2.5 py-1 rounded-full font-medium", getRoleBadgeStyle(role))}
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
            className='self-start bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg px-3 py-1.5 text-xs font-medium transition-all'
          >
            Manage roles
          </button>
        )}
      </div>

      {/* ── Add Member Section ── */}
      {canProject("project:update") && nonMembers.length > 0 && (
        <div>
          <div className='flex items-center gap-2 mb-2'>
            <UserPlus size={14} className='text-zinc-400 dark:text-zinc-500' />
            <p className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
              Add member
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            {nonMembers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => {
                  setAddMemberDialog({ userId: u.id, name: u.name });
                  setAddMemberRole(projectRoles[0] || "");
                }}
                className='flex items-center gap-2 px-3 py-1.5 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-full text-sm text-zinc-600 dark:text-zinc-400 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all'
              >
                <Plus size={12} /> {u.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Members Table ── */}
      <div className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-200/80 dark:border-white/5 overflow-hidden'>
        {/* Table header */}
        <div className='hidden sm:grid sm:grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-white/5'>
          <span className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-8' />
          <span className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>
            Member
          </span>
          <span className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider'>
            Role
          </span>
          <span className='text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-10' />
        </div>

        {!project.members || project.members.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500'>
            <div className='p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 mb-3'>
              <Users size={28} className='opacity-50' />
            </div>
            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>No members yet</p>
            <p className='text-xs mt-0.5 text-zinc-400 dark:text-zinc-500'>Add team members to collaborate on this project</p>
          </div>
        ) : (
          <div className='divide-y divide-zinc-100 dark:divide-white/5'>
            {project.members.map((m) => {
              const displayRole =
                m.projectRole || m.user.role?.name || "No role assigned";
              return (
                <div
                  key={m.userId}
                  className='group px-4 py-3 flex items-center gap-3 hover:bg-zinc-50/70 dark:hover:bg-white/[0.02] transition-colors duration-150'
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold",
                      getAvatarColor(m.userId)
                    )}
                  >
                    {m.user.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name & email */}
                  <div className='flex-1 min-w-0'>
                    <p className='font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate'>
                      {m.user.name}
                    </p>
                    {(m.user as any).email && (
                      <p className='text-xs text-zinc-400 dark:text-zinc-500 truncate flex items-center gap-1'>
                        <Mail size={10} />
                        {(m.user as any).email}
                      </p>
                    )}
                  </div>

                  {/* Role badge / editor */}
                  <div className='flex-shrink-0'>
                    {editingRole?.userId === m.userId ? (
                      <div className='flex items-center gap-1.5'>
                        <CustomSelect
                          value={editingRole!.value}
                          onChange={(val) =>
                            setEditingRole({
                              userId: m.userId,
                              value: val,
                            })
                          }
                          options={projectRoles.map((role: string) => ({ value: role, label: role }))}
                          placeholder="Role"
                          size="sm"
                          className="w-32"
                          buttonClassName="w-full text-xs border border-indigo-300 dark:border-indigo-500/50 rounded-lg"
                        />
                        <button
                          onClick={() =>
                            updateMemberRoleMutation.mutate({
                              userId: m.userId,
                              projectRole: editingRole!.value,
                            })
                          }
                          className='text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium px-1.5'
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingRole(null)}
                          className='text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 px-1'
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className='flex items-center gap-1.5'>
                        <span
                          className={cn(
                            "text-xs px-2.5 py-0.5 rounded-full font-medium",
                            getRoleBadgeStyle(displayRole)
                          )}
                        >
                          {displayRole}
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
                            className='p-1 text-zinc-300 dark:text-zinc-600 hover:text-indigo-500 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  {canProject("project:update") && (
                    <button
                      onClick={() => removeMemberMutation.mutate(m.userId)}
                      className='flex-shrink-0 p-1.5 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all'
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Member Dialog (Modal) ── */}
      {addMemberDialog && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
          <div
            className='bg-white dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-zinc-200/80 dark:ring-white/10 w-full max-w-sm overflow-hidden'
          >
            {/* Dialog header */}
            <div className='px-6 pt-6 pb-2'>
              <div className='flex items-center gap-3 mb-1'>
                <div className='p-2 rounded-xl bg-indigo-100 dark:bg-indigo-500/15'>
                  <UserPlus size={18} className='text-indigo-600 dark:text-indigo-400' />
                </div>
                <h3 className='font-semibold text-zinc-900 dark:text-zinc-100 text-base'>
                  Add member
                </h3>
              </div>
              <p className='text-sm text-zinc-500 dark:text-zinc-400 mt-2'>
                Set the role for{" "}
                <span className='font-medium text-zinc-800 dark:text-zinc-200'>
                  {addMemberDialog.name}
                </span>{" "}
                in this project.
              </p>
            </div>

            {/* Dialog body */}
            <div className='px-6 py-4'>
              <div>
                <div className='flex items-center justify-between mb-1.5'>
                  <label className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>
                    Project role
                  </label>
                  {canProject("project:update") && (
                    <button
                      type='button'
                      onClick={() => {
                        setAddMemberDialog(null);
                        openRolesEditor();
                      }}
                      className='text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium'
                    >
                      Manage roles
                    </button>
                  )}
                </div>
                <CustomSelect
                  value={addMemberRole}
                  onChange={setAddMemberRole}
                  options={projectRoles.map((role: string) => ({ value: role, label: role }))}
                  placeholder="Role"
                  size="md"
                  className="w-full text-left"
                  buttonClassName="w-full bg-transparent text-sm border border-zinc-200 dark:border-zinc-700 dark:text-zinc-100 rounded-lg px-3 py-2.5 h-10 transition-colors"
                />
              </div>
            </div>

            {/* Dialog footer */}
            <div className='flex gap-2 px-6 pb-6'>
              <button
                onClick={() => setAddMemberDialog(null)}
                className='flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-all'
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
                className='flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all'
              >
                {addMemberMutation.isPending && (
                  <span className='w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                )}
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
