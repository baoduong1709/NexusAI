import { HeroSection } from "@/components/landing/hero-section";
import { FeatureCard } from "@/components/landing/feature-card";
import { Brain, Zap, Shield, Workflow, BarChart3, Clock } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  const features = [
    {
      title: "Smart Task Generation",
      description: "Simply describe your project goal, and our AI automatically breaks it down into actionable tasks and milestones.",
      icon: Brain,
    },
    {
      title: "Predictive Scheduling",
      description: "NexusAI learns from your team's velocity to accurately predict deadlines and identify potential bottlenecks before they happen.",
      icon: Clock,
    },
    {
      title: "Automated Workflows",
      description: "Set up triggers and let the AI handle routine assignments, status updates, and stakeholder notifications.",
      icon: Workflow,
    },
    {
      title: "Risk Analysis",
      description: "Real-time scanning of project health. The AI flags scope creep and resource exhaustion instantly.",
      icon: Shield,
    },
    {
      title: "Instant Insights",
      description: "Stop building reports manually. Ask the AI queries like 'How are we doing on Q3 goals?' for instant visual data.",
      icon: BarChart3,
    },
    {
      title: "Lightning Fast UI",
      description: "Built for speed. Keyboard shortcuts and AI-assisted commands mean you spend less time managing and more time doing.",
      icon: Zap,
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
      <HeroSection />

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Intelligence built into <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              every workflow
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            NexusAI doesn't just store your tasks; it actively helps you complete them. Experience the first truly autonomous project management platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              delay={index * 0.1}
            />
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-900/20"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10 p-8 sm:p-12 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to upgrade your team?</h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of forward-thinking teams who have replaced manual management with AI precision.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-600 px-8 py-4 text-base font-bold text-white transition-all hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)]"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-500 text-sm border-t border-white/10">
        <p>© {new Date().getFullYear()} NexusAI. Built for the future of work.</p>
      </footer>
    </main>
  );
}
