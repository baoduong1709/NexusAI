import { HeroSection } from "@/components/landing/hero-section";
import { FeatureCard } from "@/components/landing/feature-card";


export default function Home() {
  const features = [
    {
      title: "Smart Task Generation",
      description: "Simply describe your project goal, and our AI automatically breaks it down into actionable tasks and milestones.",
      icon: "brain",
    },
    {
      title: "Predictive Scheduling",
      description: "NexusAI learns from your team's velocity to accurately predict deadlines and identify potential bottlenecks before they happen.",
      icon: "clock",
    },
    {
      title: "Automated Workflows",
      description: "Set up triggers and let the AI handle routine assignments, status updates, and stakeholder notifications.",
      icon: "workflow",
    },
    {
      title: "Risk Analysis",
      description: "Real-time scanning of project health. The AI flags scope creep and resource exhaustion instantly.",
      icon: "shield",
    },
    {
      title: "Instant Insights",
      description: "Stop building reports manually. Ask the AI queries like 'How are we doing on Q3 goals?' for instant visual data.",
      icon: "bar-chart",
    },
    {
      title: "Lightning Fast UI",
      description: "Built for speed. Keyboard shortcuts and AI-assisted commands mean you spend less time managing and more time doing.",
      icon: "zap",
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



      {/* Footer */}
      <footer className="py-8 text-center text-gray-500 text-sm border-t border-white/10">
        <p>© {new Date().getFullYear()} NexusAI. Built for the future of work.</p>
      </footer>
    </main>
  );
}
