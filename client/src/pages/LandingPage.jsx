import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Zap, ArrowRight, Fingerprint } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="pt-20 min-h-screen relative overflow-hidden">

      {/* Background Glows */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary-dark blur-[150px] opacity-15 rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-secondary blur-[120px] opacity-10 rounded-full -z-10" />

      {/* Hero Section */}
      <div className="container-custom text-center py-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-6">
          <span className="w-2 h-2 bg-primary rounded-full animate-ping"></span>
          <span className="text-sm text-primary font-medium">Next Gen AI Security</span>
        </div>

        <h1 className="text-6xl font-extrabold leading-tight mb-6 tracking-tight">
          Identity Verification <br />
          <span className="gradient-text">Reimagined with AI</span>
        </h1>

        <p className="text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
          Prevent synthetic fraud and streamline onboarding with our advanced biometric computer vision system.
        </p>

        <div className="flex gap-4 justify-center">
          <Link to="/signup" className="btn-primary flex items-center gap-2 text-lg px-8 py-4">
            Get Started <ArrowRight size={20} />
          </Link>
          <Link to="/login" className="btn-outline text-lg px-8 py-4">
            Live Demo
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container-custom py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <Fingerprint size={32} color="var(--color-primary)" />,
              title: "Biometric Matching",
              desc: "Deep learning algorithms coupled with liveness detection to ensure physical presence."
            },
            {
              icon: <Zap size={32} color="var(--color-secondary)" />,
              title: "Real-time Processing",
              desc: "Core verification pipeline runs in under 2 seconds with 99.8% accuracy."
            },
            {
              icon: <Lock size={32} color="var(--color-accent)" />,
              title: "Fraud Prevention",
              desc: "Detects patterns of synthetic identity usage across multiple data points."
            }
          ].map((feature, i) => (
            <div key={i} className="glass-panel p-8 hover:-translate-y-1 transition-transform duration-300">
              <div className="mb-6">{feature.icon}</div>
              <h3 className="text-2xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-text-muted leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
