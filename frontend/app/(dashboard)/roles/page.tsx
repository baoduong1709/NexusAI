"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<any>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.getAll().then((r) => r.data),
  });
  const { data: allPermissions = [] } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => rolesApi.getPermissions().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => rolesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role created");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => rolesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role updated");
      setShowModal(false);
      setEditRole(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rolesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<any>();
  const selectedPermissions: string[] = watch("permissions") || [];

  const openCreate = () => {
    reset({ name: "", permissions: [] });
    setEditRole(null);
    setShowModal(true);
  };

  const openEdit = (r: any) => {
    reset({ name: r.name, permissions: r.permissions || [] });
    setEditRole(r);
    setShowModal(true);
  };

  const togglePermission = (perm: string) => {
    const curr = watch("permissions") || [];
    if (curr.includes(perm)) {
      setValue(
        "permissions",
        curr.filter((p: string) => p !== perm),
      );
    } else {
      setValue("permissions", [...curr, perm]);
    }
  };

  const onSubmit = (data: any) => {
    if (editRole) updateMutation.mutate({ id: editRole.id, data });
    else createMutation.mutate(data);
  };

  const permGroups = [
    { label: "User", prefix: "user:" },
    { label: "Role", prefix: "role:" },
    { label: "Project", prefix: "project:" },
    { label: "Task", prefix: "task:" },
    { label: "Document", prefix: "document:" },
    { label: "AI", prefix: "ai:" },
  ];

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            Role & Permission Management
          </h1>
          <p className='text-gray-500 text-sm mt-1'>{roles.length} roles</p>
        </div>
        {hasPermission("role:create") && (
          <button
            onClick={openCreate}
            className='flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium'
          >
            <Plus size={16} /> Create Role
          </button>
        )}
      </div>

      {isLoading ? (
        <div className='py-12 flex justify-center'>
          <Loader2 className='animate-spin text-blue-500' />
        </div>
      ) : (
        <div className='grid gap-4'>
          {roles.map((r: any) => (
            <div
              key={r.id}
              className='bg-white rounded-xl border border-gray-100 p-5'
            >
              <div className='flex items-center justify-between mb-3'>
                <h3 className='font-semibold text-gray-900'>{r.name}</h3>
                <div className='flex gap-1'>
                  {hasPermission("role:update") && (
                    <button
                      onClick={() => openEdit(r)}
                      className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded'
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {hasPermission("role:delete") && (
                    <button
                      onClick={() =>
                        confirm(`Delete role "${r.name}"?`) &&
                        deleteMutation.mutate(r.id)
                      }
                      className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded'
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {(r.permissions || []).map((p: string) => (
                  <span
                    key={p}
                    className='bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full'
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto'>
            <h3 className='font-bold text-lg text-gray-900 mb-4'>
              {editRole ? `Edit: ${editRole.name}` : "Create New Role"}
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Role Name *
                </label>
                <input
                  {...register("name", { required: true })}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700 block mb-2'>
                  Permissions
                </label>
                <div className='space-y-3'>
                  {permGroups.map((group) => {
                    const perms = allPermissions.filter((p: string) =>
                      p.startsWith(group.prefix),
                    );
                    if (!perms.length) return null;

                    return (
                      <div key={group.label}>
                        <p className='text-xs font-semibold text-gray-400 uppercase mb-1'>
                          {group.label}
                        </p>
                        <div className='flex flex-wrap gap-2'>
                          {perms.map((perm: string) => (
                            <button
                              key={perm}
                              type='button'
                              onClick={() => togglePermission(perm)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                selectedPermissions.includes(perm)
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                              }`}
                            >
                              {perm}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className='px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50'
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className='animate-spin' size={14} />
                  )}
                  {editRole ? "Save Changes" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
