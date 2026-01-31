import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Smartphone, Camera, Loader2, ArrowRight } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const steps = [
  { id: 1, title: 'Personal Info', desc: 'Enter your basic details' },
  { id: 2, title: 'Document Upload', desc: 'Upload PDF or Image of ID' },
  { id: 3, title: 'Biometric Scan', desc: 'Face verification' },
  { id: 4, title: 'AI Analysis', desc: 'Waiting for validation' }
];

const KYCPage = () => {
  const { user, updatePersonalInfo, uploadDocuments, isLoading } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationalIdNumber: ''
  });
  const [files, setFiles] = useState({
    aadhaar: null,
    pan: null
  });

  // Sync step with user status from backend
  useEffect(() => {
    if (user?.verificationStep) {
      setCurrentStep(user.verificationStep);
    }
    // Pre-fill info if available
    if (user?.name) {
      const [first, ...last] = user.name.split(' ');
      setPersonalInfo(prev => ({ ...prev, firstName: first, lastName: last.join(' ') }));
    }
  }, [user]);

  const handleInfoChange = (e) => {
    setPersonalInfo({ ...personalInfo, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handleNext = async () => {
    try {
      if (currentStep === 1) {
        await updatePersonalInfo(personalInfo);
        setCurrentStep(2);
      } else if (currentStep === 2) {
        if (!files.aadhaar || !files.pan) {
          alert("Please upload both documents");
          return;
        }
        const formData = new FormData();
        formData.append('aadhaar', files.aadhaar);
        formData.append('pan', files.pan);
        await uploadDocuments(formData);
        setCurrentStep(3);
      } else if (currentStep === 3) {
        // Biometric Placeholder
        // await biometricScan()
        setCurrentStep(4);
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="pt-20 min-h-screen flex flex-col">

      <div className="container-custom flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-16 pb-16">

        {/* Left Side - Inputs */}
        <div className="glass-panel p-10 h-fit">
          <h2 className="text-3xl font-bold mb-4">
            {steps[currentStep - 1]?.title}
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
                    <input
                      name="firstName"
                      className="input-field"
                      placeholder="John"
                      value={personalInfo.firstName}
                      onChange={handleInfoChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium">Last Name</label>
                    <input
                      name="lastName"
                      className="input-field"
                      placeholder="Doe"
                      value={personalInfo.lastName}
                      onChange={handleInfoChange}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Date of Birth</label>
                  <input
                    name="dateOfBirth"
                    className="input-field"
                    type="date"
                    value={personalInfo.dateOfBirth}
                    onChange={handleInfoChange}
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">National ID Number</label>
                  <input
                    name="nationalIdNumber"
                    className="input-field"
                    placeholder="XXXX-XXXX-XXXX"
                    value={personalInfo.nationalIdNumber}
                    onChange={handleInfoChange}
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 2 Content */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-6">
                <div>
                  <label className="block mb-2 text-sm font-medium">Aadhaar Card</label>
                  <div className="p-6 border-2 border-dashed border-border rounded-xl text-center hover:border-primary/50 transition-colors relative">
                    <input
                      type="file"
                      name="aadhaar"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept="image/*,application/pdf"
                    />
                    <Upload size={32} className="mx-auto mb-2 text-primary" />
                    <p className="text-sm text-text-muted">{files.aadhaar ? files.aadhaar.name : "Click to Upload Aadhaar"}</p>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium">PAN Card</label>
                  <div className="p-6 border-2 border-dashed border-border rounded-xl text-center hover:border-primary/50 transition-colors relative">
                    <input
                      type="file"
                      name="pan"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept="image/*,application/pdf"
                    />
                    <Upload size={32} className="mx-auto mb-2 text-primary" />
                    <p className="text-sm text-text-muted">{files.pan ? files.pan.name : "Click to Upload PAN"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 Content */}
            {currentStep === 3 && (
              <div className="text-center">
                <div className="w-[240px] h-[240px] bg-black mx-auto mb-8 rounded-2xl flex items-center justify-center border-2 border-primary shadow-[0_0_40px_rgba(0,242,254,0.15)]">
                  <Camera size={48} className="text-text-muted" />
                </div>
                <p className="mb-6 text-text-muted">Place your face inside the frame</p>
                <button type="button" className="btn-primary" onClick={handleNext}>Start Verification</button>
              </div>
            )}

            {/* Step 4 Content */}
            {currentStep === 4 && (
              <div className="text-center py-8">
                <CheckCircle size={64} className="mx-auto mb-6 text-secondary" />
                <h3 className="text-2xl font-bold mb-3">Analysis in Progress</h3>
                <p className="text-text-muted text-lg">
                  We are validating your documents and biometric data.
                </p>
              </div>
            )}

            {currentStep < 3 && (
              <div className="mt-12 flex justify-end">
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <>Processing <Loader2 className="animate-spin" size={18} /></>
                  ) : (
                    <>Continue <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            )}

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
                      {isActive && isLoading ? 'Processing...' : step.desc}
                    </p>
                    {isActive && isLoading && (
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
