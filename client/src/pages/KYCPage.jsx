import React, { useState } from 'react';
import { Upload, CheckCircle, Smartphone, Camera, Loader2, ArrowRight } from 'lucide-react';

const steps = [
  { id: 1, title: 'Personal Info', desc: 'Enter your basic details' },
  { id: 2, title: 'Document Upload', desc: 'Upload PDF or Image of ID' },
  { id: 3, title: 'Biometric Scan', desc: 'Face verification' },
  { id: 4, title: 'AI Analysis', desc: 'Waiting for validation' }
];

const KYCPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    setLoading(true);
    // Simulate AI processing time
    setTimeout(() => {
      setLoading(false);
      if (currentStep < 4) setCurrentStep(c => c + 1);
    }, 1500);
  };

  return (
    <div className="pt-20 min-h-screen flex flex-col">

      <div className="container-custom flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-16 pb-16">

        {/* Left Side - Inputs */}
        <div className="glass-panel p-10 h-fit">
          <h2 className="text-3xl font-bold mb-4">
            {steps[currentStep - 1].title}
          </h2>
          <p className="text-text-muted mb-8 text-lg">
            Please complete the information below to proceed with verification.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            {/* Step 1 Content */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium">First Name</label>
                    <input className="input-field" placeholder="John" />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium">Last Name</label>
                    <input className="input-field" placeholder="Doe" />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Date of Birth</label>
                  <input className="input-field" type="date" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">National ID Number</label>
                  <input className="input-field" placeholder="XXXX-XXXX-XXXX" />
                </div>
              </div>
            )}

            {/* Step 2 Content */}
            {currentStep === 2 && (
              <div className="p-10 border-2 border-dashed border-border rounded-xl text-center hover:border-primary/50 transition-colors">
                <Upload size={48} className="mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Upload ID Document</h3>
                <p className="text-text-muted text-sm mb-6">
                  PNG, JPG or PDF up to 10MB
                </p>
                <button type="button" className="btn-outline">Select File</button>
              </div>
            )}

            {/* Step 3 Content */}
            {currentStep === 3 && (
              <div className="text-center">
                <div className="w-[240px] h-[240px] bg-black mx-auto mb-8 rounded-2xl flex items-center justify-center border-2 border-primary shadow-[0_0_40px_rgba(0,242,254,0.15)]">
                  <Camera size={48} className="text-text-muted" />
                </div>
                <button type="button" className="btn-primary">Start Camera</button>
              </div>
            )}

            {/* Step 4 Content */}
            {currentStep === 4 && (
              <div className="text-center py-8">
                <CheckCircle size={64} className="mx-auto mb-6 text-secondary" />
                <h3 className="text-2xl font-bold mb-3">Verification Complete</h3>
                <p className="text-text-muted text-lg">
                  Your identity has been successfully verified by our AI systems.
                </p>
              </div>
            )}

            <div className="mt-12 flex justify-end">
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
                {loading ? (
                  <>Processing <Loader2 className="animate-spin" size={18} /></>
                ) : (
                  <>Continue <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side - Progress Bar / AI Steps */}
        <div className="pl-4 lg:pl-0">
          <h3 className="text-xl font-semibold mb-8">Verification Status</h3>

          <div className="flex flex-col">
            {steps.map((step, index) => {
              const isActive = index + 1 === currentStep;
              const isCompleted = index + 1 < currentStep;

              return (
                <div key={step.id} className="flex gap-4 min-h-[100px] relative">
                  {/* Timeline Line */}
                  {index !== steps.length - 1 && (
                    <div className={`absolute left-[15px] top-[34px] bottom-[-20px] w-[2px] ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
                  )}

                  {/* Icon/Circle */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 border 
                    ${isActive ? 'bg-primary/10 border-primary text-primary' : isCompleted ? 'bg-primary-dark/10 border-primary-dark text-primary-dark' : 'bg-white/5 border-border text-text-muted'}`}>
                    {isCompleted ? <CheckCircle size={16} /> : index + 1}
                  </div>

                  {/* Text */}
                  <div className={`pt-1 transition-opacity duration-300 ${isActive || isCompleted ? 'opacity-100' : 'opacity-40'}`}>
                    <h4 className="text-base font-bold">{step.title}</h4>
                    <p className="text-sm text-text-muted mt-1">
                      {isActive && loading ? 'AI analyzing...' : step.desc}
                    </p>
                    {isActive && loading && (
                      <div className="h-1 w-[120px] bg-white/10 mt-3 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[60%] animate-[progress_1s_infinite_linear]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-panel mt-8 p-6">
            <h4 className="text-sm font-semibold text-text-muted mb-4 uppercase tracking-wider">System Status</h4>
            <div className="flex justify-between text-sm mb-3">
              <span>Face Engine</span>
              <span className="text-[#00ffaa] flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-pulse" /> Online</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Liveness Check</span>
              <span className="text-[#00ffaa] flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-pulse" /> Active</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default KYCPage;
