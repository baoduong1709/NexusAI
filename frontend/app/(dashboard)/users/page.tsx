"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, rolesApi } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { getInitials, cn } from "@/lib/utils";

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll().then((r) => r.data),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      setShowModal(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => usersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
      setShowModal(false);
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Error"),
  });

  const { register, handleSubmit, reset } = useForm<any>();

  const openCreate = () => {
    reset({ name: "", email: "", password: "", roleId: "", skills: "" });
    setEditUser(null);
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    reset({
      name: u.name,
      email: u.email,
      roleId: u.role?.id || "",
      skills: u.skills?.join(", ") || "",
      isActive: u.isActive,
    });
    setEditUser(u);
    setShowModal(true);
  };

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      roleId: data.roleId ? Number(data.roleId) : undefined,
      skills: data.skills
        ? data.skills
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
    };
    if (editUser) {
      if (!payload.password) delete payload.password;
      updateMutation.mutate({ id: editUser.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = users.filter(
    (u: any) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>User Management</h1>
          <p className='text-gray-500 text-sm mt-1'>{users.length} users</p>
        </div>
        {hasPermission("user:create") && (
          <button
            onClick={openCreate}
            className='flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium'
          >
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      <div className='relative'>
        <Search className='absolute left-3 top-2.5 text-gray-400' size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search by name or email...'
          className='w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </div>

      <div className='bg-white rounded-xl border border-gray-100 overflow-hidden'>
        {isLoading ? (
          <div className='py-12 flex justify-center'>
            <Loader2 className='animate-spin text-blue-500' />
          </div>
        ) : (
          <table className='w-full'>
            <thead className='bg-gray-50 border-b border-gray-100'>
              <tr>
                {["User", "Email", "Role", "Skills", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className='px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider'
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {filtered.map((u: any) => (
                <tr key={u.id} className='hover:bg-gray-50'>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-3'>
                      <div className='bg-blue-100 text-blue-700 font-semibold rounded-full w-8 h-8 flex items-center justify-center text-xs flex-shrink-0'>
                        {getInitials(u.name)}
                      </div>
                      <span className='font-medium text-gray-900 text-sm'>
                        {u.name}
                      </span>
                    </div>
                  </td>
                  <td className='px-4 py-3 text-sm text-gray-500'>{u.email}</td>
                  <td className='px-4 py-3'>
                    {u.role ? (
                      <span className='bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full font-medium'>
                        {u.role.name}
                      </span>
                    ) : (
                      <span className='text-gray-400 text-xs'>-</span>
                    )}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex flex-wrap gap-1'>
                      {u.skills?.slice(0, 3).map((s: string) => (
                        <span
                          key={s}
                          className='bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded'
                        >
                          {s}
                        </span>
                      ))}
                      {u.skills?.length > 3 && (
                        <span className='text-xs text-gray-400'>
                          +{u.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-4 py-3'>
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        u.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500",
                      )}
                    >
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex gap-1 justify-end'>
                      {hasPermission("user:update") && (
                        <button
                          onClick={() => openEdit(u)}
                          className='p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded'
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {hasPermission("user:delete") && (
                        <button
                          onClick={() =>
                            confirm(`Delete ${u.name}?`) &&
                            deleteMutation.mutate(u.id)
                          }
                          className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded'
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className='py-8 text-center text-gray-400'>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md'>
            <h3 className='font-bold text-lg text-gray-900 mb-4'>
              {editUser ? "Edit User" : "Add New User"}
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-3'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Full Name *
                </label>
                <input
                  {...register("name", { required: true })}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Email *
                </label>
                <input
                  {...register("email", { required: true })}
                  type='email'
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  {editUser
                    ? "New Password (leave empty to keep current password)"
                    : "Password *"}
                </label>
                <input
                  {...register("password", { required: !editUser })}
                  type='password'
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Role
                </label>
                <select
                  {...register("roleId")}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  <option value=''>-- None --</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  Skills (comma-separated)
                </label>
                <input
                  {...register("skills")}
                  className='w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='React, Node.js, SQL'
                />
              </div>
              {editUser && (
                <div className='flex items-center gap-2'>
                  <input
                    {...register("isActive")}
                    type='checkbox'
                    id='isActive'
                    className='rounded'
                  />
                  <label htmlFor='isActive' className='text-sm text-gray-700'>
                    Active
                  </label>
                </div>
              )}
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
                  {editUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
