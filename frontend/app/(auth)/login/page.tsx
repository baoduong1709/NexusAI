"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Loader2, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/brand-logo";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      await login(data.email, data.password);
      toast.success("Welcome back to NexusAI");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="w-full max-w-[400px] relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-[2rem] blur-2xl opacity-50 dark:opacity-100" />
        
        {/* Card */}
        <div className="relative bg-white dark:bg-zinc-950/50 backdrop-blur-3xl rounded-[2rem] shadow-2xl border border-black/5 dark:border-white/10 p-10">
          
          <div className="flex justify-between items-start mb-10">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-6"
              >
                <BrandLogo size={48} />
              </motion.div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Log in
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                Enter your credentials to continue.
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 transition-colors"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all text-sm placeholder:text-zinc-400"
                placeholder="admin@nexusai.com"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                Password
              </label>
              <input
                {...register("password")}
                type="password"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/50 focus:border-indigo-500 dark:text-white transition-all text-sm placeholder:text-zinc-400"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black font-medium py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-sm mt-8"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              Continue
            </motion.button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-500 font-mono">
              demo: admin@nexusai.com / Admin@123
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
