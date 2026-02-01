import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Smartphone, Camera, Loader2, ArrowRight, ShieldCheck, ScanFace, FileText, Server } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FaceLiveness from '../components/biometric/FaceLiveness';
import VoiceVerification from '../components/biometric/VoiceVerification';

const steps = [
  { id: 1, title: 'Personal Info', desc: 'Enter your basic details' },
  { id: 2, title: 'Document Verification', desc: 'Upload & Validate IDs' },
  { id: 3, title: 'Face Scan', desc: 'Liveness check' },
  { id: 4, title: 'Voice Verify', desc: 'Audio identity check' },
  { id: 5, title: 'AI Analysis', desc: 'Final Validation' }
];

const KYCPage = () => {
  const { user, updatePersonalInfo, uploadDocuments, isLoading: authLoading } = useAuthStore();
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

  // Detailed Processing States
  const [processingStage, setProcessingStage] = useState('idle'); // idle, uploading, ocr, authenticating, matching, complete
  const [apiResponses, setApiResponses] = useState({
    ocr: null,
    authenticity: null,
    faceMatch: null,
    crossMatch: null
  });
  const [canContinue, setCanContinue] = useState(false);

  // Sync step with user status from backend
  useEffect(() => {
    if (user?.verificationStep) {
      if (user.verificationStep > currentStep) {
        setCurrentStep(user.verificationStep);
      }
    }
    // Pre-fill info
    if (user?.name) {
      const parts = user.name.split(' ');
      setPersonalInfo(prev => ({
        ...prev,
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
      }));
    }
  }, [user]);

  const handleInfoChange = (e) => {
    setPersonalInfo({ ...personalInfo, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles({ ...files, [e.target.name]: e.target.files[0] });
  };

  const handlePersonalInfoSubmit = async () => {
    try {
      await updatePersonalInfo(personalInfo);
      setCurrentStep(2);
    } catch (error) {
      console.error(error);
    }
  };

  /* Stream Reader Utility */
  const readStream = async (reader) => {
    const decoder = new TextDecoder();
    let partial = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = (partial + chunk).split('\n');
      partial = lines.pop(); // Keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          handleStreamMessage(msg);
        } catch (e) {
          console.error("Stream parse error:", e);
        }
      }
    }
  };

  const handleStreamMessage = (msg) => {
    console.log("Stream Msg:", msg);

    switch (msg.type) {
      case 'start':
        setProcessingStage('uploading');
        break;
      case 'upload_complete':
        setProcessingStage('ocr');
        break;
      case 'ocr_aadhaar':
        setApiResponses(prev => ({
          ...prev,
          ocr: { ...prev.ocr, aadhaar: msg.data }
        }));
        break;
      case 'ocr_pan':
        setApiResponses(prev => ({
          ...prev,
          ocr: { ...prev.ocr, pan: msg.data }
        }));
        break;
      case 'fraud_check':
        setProcessingStage('authenticating');
        setApiResponses(prev => ({ ...prev, authenticity: msg.data }));
        break;
      case 'cross_match':
        setApiResponses(prev => ({ ...prev, crossMatch: msg.data }));
        break;
      case 'face_match':
        setProcessingStage('matching');
        setApiResponses(prev => ({ ...prev, faceMatch: msg.data }));
        break;
      case 'complete':
        setProcessingStage('complete');
        setCanContinue(true);
        break;
      case 'error':
        alert(msg.message);
        setProcessingStage('idle');
        setCanContinue(false);
        break;
    }
  };

  const handleDocumentSubmit = async () => {
    if (!files.aadhaar || !files.pan) {
      alert("Please upload both documents");
      return;
    }

    setProcessingStage('uploading');
    setCanContinue(false);

    // Reset responses
    setApiResponses({ ocr: {}, authenticity: null, faceMatch: null, crossMatch: null });

    try {
      const formData = new FormData();
      formData.append('aadhaar', files.aadhaar);
      formData.append('pan', files.pan);

      // Use fetch for streaming
      const response = await fetch('http://localhost:5000/api/kyc/upload', {
        method: 'POST',
        headers: {}, // No manual auth header, usage of cookies
        credentials: 'include', // Important for sending cookies
        body: formData
      });

      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      await readStream(reader);

    } catch (error) {
      console.error("Document Processing Error:", error);
      setProcessingStage('idle');
      alert("Processing failed. Please try again.");
    }
  };

  // Biometric Logic
  const videoRef = React.useRef(null);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [capturedImage, setCapturedImage] = React.useState(null);
  const [biometricResult, setBiometricResult] = React.useState({});

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Camera Error:", err);
      alert("Cannot access camera");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      setCapturedImage(blob);
      setCameraActive(false);
      // Stop stream
      const stream = videoRef.current.srcObject;
      stream?.getTracks().forEach(track => track.stop());
    }, 'image/jpeg');
  };

  const handleBiometricSubmit = async () => {
    if (!capturedImage) return;

    const formData = new FormData();
    formData.append('selfie', capturedImage, "selfie.jpg");

    try {
      const res = await axios.post('http://localhost:5000/api/kyc/biometric', formData, {
        withCredentials: true // Ensure cookies are sent
      });
      setBiometricResult(res.data);

      if (res.data.verified) {
        setTimeout(() => setCurrentStep(4), 1500);
      } else {
        alert("Face verification failed. Please try again.");
        setCapturedImage(null);
        startCamera();
      }
    } catch (e) {
      console.error(e);
      alert("Verification error");
    }
  };

  const moveToBiometric = () => {
    setCurrentStep(3);
    setTimeout(startCamera, 500); // Auto start camera
  };

  return (
    <div className="pt-20 min-h-screen flex flex-col">

      <div className="container-custom flex-1 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-16 pb-16">

        {/* Left Side - Inputs & Results */}
        <div className="glass-panel p-10 h-fit">
          <h2 className="text-3xl font-bold mb-4">
            {steps[currentStep - 1]?.title}
          </h2>
          <p className="text-text-muted mb-8 text-lg">
            {currentStep === 2 ? "Upload your documents for AI verification." :
              currentStep === 3 ? "Take a selfie to verify against your documents." :
                "Please complete the information below."}
          </p>

          <form onSubmit={(e) => { e.preventDefault(); }}>
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium">First Name</label>
                    <input name="firstName" className="input-field" value={personalInfo.firstName} onChange={handleInfoChange} required />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium">Last Name</label>
                    <input name="lastName" className="input-field" value={personalInfo.lastName} onChange={handleInfoChange} required />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">Date of Birth</label>
                  <input name="dateOfBirth" className="input-field" type="date" value={personalInfo.dateOfBirth} onChange={handleInfoChange} required />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium">National ID Number</label>
                  <input name="nationalIdNumber" className="input-field" placeholder="XXXX-XXXX-XXXX" value={personalInfo.nationalIdNumber} onChange={handleInfoChange} required />
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={handlePersonalInfoSubmit} className="btn-primary flex items-center gap-2" disabled={authLoading}>
                    {authLoading ? <Loader2 className="animate-spin" /> : <>Continue <ArrowRight size={18} /></>}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Document Verification */}
            {currentStep === 2 && (
              <div className="flex flex-col gap-8">
                {/* Upload Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium">Aadhaar Card</label>
                    <div className="p-6 border-2 border-dashed border-border rounded-xl text-center hover:border-primary/50 transition-colors relative">
                      <input type="file" name="aadhaar" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*,application/pdf" disabled={processingStage !== 'idle'} />
                      <Upload size={32} className="mx-auto mb-2 text-primary" />
                      <p className="text-sm text-text-muted">{files.aadhaar ? files.aadhaar.name : "Click to Upload Aadhaar"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">PAN Card</label>
                    <div className="p-6 border-2 border-dashed border-border rounded-xl text-center hover:border-primary/50 transition-colors relative">
                      <input type="file" name="pan" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*,application/pdf" disabled={processingStage !== 'idle'} />
                      <Upload size={32} className="mx-auto mb-2 text-primary" />
                      <p className="text-sm text-text-muted">{files.pan ? files.pan.name : "Click to Upload PAN"}</p>
                    </div>
                  </div>
                </div>

                {/* API Responses Visualization */}
                {(processingStage !== 'idle') && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-lg font-semibold border-b border-border pb-2">Analysis Results</h3>

                    {/* OCR Data */}
                    <div className={`p-4 rounded-lg border ${apiResponses.ocr && (apiResponses.ocr.aadhaar || apiResponses.ocr.pan) ? 'border-primary/30 bg-primary/5' : 'border-border bg-black/20'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={18} className="text-primary" />
                        <span className="font-medium">OCR Extraction Data</span>
                        {(!apiResponses.ocr.aadhaar && !apiResponses.ocr.pan) && <Loader2 size={14} className="animate-spin text-text-muted" />}
                      </div>
                      {(apiResponses.ocr.aadhaar || apiResponses.ocr.pan) && (
                        <div className="grid grid-cols-2 gap-4 text-xs text-text-muted">
                          {apiResponses.ocr.aadhaar && (
                            <pre className="overflow-auto bg-black/40 p-2 rounded max-h-40">{JSON.stringify(apiResponses.ocr.aadhaar, null, 2)}</pre>
                          )}
                          {apiResponses.ocr.pan && (
                            <pre className="overflow-auto bg-black/40 p-2 rounded max-h-40">{JSON.stringify(apiResponses.ocr.pan, null, 2)}</pre>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Authenticity Result */}
                    {(processingStage === 'authenticating' || processingStage === 'matching' || processingStage === 'complete') && (
                      <div className={`p-4 rounded-lg border ${apiResponses.authenticity ? 'border-secondary/30 bg-secondary/5' : 'border-border bg-black/20'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck size={18} className="text-secondary" />
                          <span className="font-medium">Forgery Detection Report</span>
                          {!apiResponses.authenticity && <Loader2 size={14} className="animate-spin text-text-muted" />}
                        </div>
                        {apiResponses.authenticity && (
                          <pre className="text-xs text-text-muted overflow-auto max-h-40 bg-black/40 p-2 rounded">
                            {JSON.stringify(apiResponses.authenticity, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Face Match Result */}
                    {(processingStage === 'matching' || processingStage === 'complete') && (
                      <div className={`p-4 rounded-lg border ${apiResponses.faceMatch ? 'border-accent/30 bg-accent/5' : 'border-border bg-black/20'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <ScanFace size={18} className="text-accent" />
                          <span className="font-medium">Face Match Analysis (Aadhaar vs PAN)</span>
                          {!apiResponses.faceMatch && <Loader2 size={14} className="animate-spin text-text-muted" />}
                        </div>
                        {apiResponses.faceMatch && (
                          <pre className="text-xs text-text-muted overflow-auto max-h-40 bg-black/40 p-2 rounded">
                            {JSON.stringify(apiResponses.faceMatch, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Cross Match Result */}
                    {(apiResponses.crossMatch) && (
                      <div className={`p-4 rounded-lg border ${apiResponses.crossMatch.nameMatch && apiResponses.crossMatch.dobMatch ? 'border-green-500/30 bg-green-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={18} className={apiResponses.crossMatch.nameMatch ? "text-green-500" : "text-orange-500"} />
                          <span className="font-medium">Document Cross-Check</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between p-2 bg-black/20 rounded">
                            <span className="text-text-muted">Name Match</span>
                            <span className={apiResponses.crossMatch.nameMatch ? "text-green-400" : "text-red-400"}>
                              {apiResponses.crossMatch.nameMatch ? "Pass" : "Fail"}
                            </span>
                          </div>
                          <div className="flex justify-between p-2 bg-black/20 rounded">
                            <span className="text-text-muted">DOB Match</span>
                            <span className={apiResponses.crossMatch.dobMatch ? "text-green-400" : "text-red-400"}>
                              {apiResponses.crossMatch.dobMatch ? "Pass" : "Fail"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex justify-end gap-4">
                  {processingStage === 'idle' && (
                    <button
                      onClick={handleDocumentSubmit}
                      className="btn-primary w-full"
                    >
                      Analyze Documents
                    </button>
                  )}

                  {processingStage !== 'idle' && !canContinue && (
                    <div className="flex items-center gap-3 text-text-muted bg-white/5 px-4 py-2 rounded-lg">
                      <Loader2 className="animate-spin" size={18} />
                      <span className="text-sm">Processing... Please wait</span>
                    </div>
                  )}

                  {canContinue && (
                    <button
                      onClick={moveToBiometric}
                      className="btn-primary animate-pulse"
                    >
                      Continue to Biometric
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Biometric */}
            {currentStep === 3 && (
              <div className="text-center w-full">
                <div className="mb-6">
                  <p className="text-text-muted mb-4 uppercase tracking-widest text-sm font-semibold">Stage 1: Liveness Check</p>

                  <FaceLiveness
                    sessionId={user?._id || 'temp-session'}
                    onComplete={(result) => {
                      console.log("Face Scan Complete:", result);
                      setBiometricResult(prev => ({ ...prev, face: result }));
                      setTimeout(() => {
                        setCurrentStep(4);
                      }, 1500);
                    }}
                  />

                  {biometricResult?.face && (
                    <div className="mt-4 p-3 bg-green-500/20 text-green-400 rounded-lg animate-in slide-in-from-bottom-2 fade-in">
                      Face Verification Passed: {biometricResult.face.liveness_percentage}% Confidence
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Voice Verify */}
            {currentStep === 4 && (
              <div className="text-center w-full">
                <div className="mb-6">
                  <p className="text-text-muted mb-4 uppercase tracking-widest text-sm font-semibold">Stage 2: Voice Verification</p>

                  <VoiceVerification
                    sessionId={user?._id || 'temp-session'}
                    onComplete={(result) => {
                      console.log("Voice Verify Complete:", result);
                      setBiometricResult(prev => ({ ...prev, voice: result }));
                      setTimeout(() => {
                        setCurrentStep(5);
                        setProcessingStage('complete');
                      }, 1500);
                    }}
                  />

                  {biometricResult?.voice && (
                    <div className="mt-4 p-3 bg-green-500/20 text-green-400 rounded-lg animate-in slide-in-from-bottom-2 fade-in">
                      Voice Signature Confirmed
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Final */}
            {currentStep === 5 && (
              <div className="text-center py-8">
                <CheckCircle size={64} className="mx-auto mb-6 text-secondary" />
                <h3 className="text-2xl font-bold mb-3">Verification Complete</h3>
                <p className="text-text-muted text-lg">
                  All documents and biometrics have been verified successfully.
                </p>
              </div>
            )}

          </form>
        </div>

        {/* Right Side - Process Sidebar */}
        <div className="pl-4 lg:pl-0">
          {/* Real-time Analysis Widget */}
          <div className="glass-panel p-6 mb-8">
            <h4 className="text-sm font-semibold text-text-muted mb-4 uppercase tracking-wider flex items-center gap-2">
              <Server size={14} /> Real-time Analysis
            </h4>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className={processingStage === 'uploading' || processingStage === 'ocr' || processingStage === 'authenticating' || processingStage === 'matching' || processingStage === 'complete' ? 'text-white' : 'text-text-muted'}>
                  Document Upload
                </span>
                {processingStage === 'uploading' ? <Loader2 size={14} className="animate-spin text-primary" /> :
                  (processingStage !== 'idle' ? <CheckCircle size={14} className="text-[#00ffaa]" /> : <div className="w-3 h-3 rounded-full bg-border" />)}
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className={processingStage === 'ocr' || processingStage === 'authenticating' || processingStage === 'matching' || processingStage === 'complete' ? 'text-white' : 'text-text-muted'}>
                  Text Extraction (OCR)
                </span>
                {processingStage === 'ocr' ? <Loader2 size={14} className="animate-spin text-primary" /> :
                  ((processingStage === 'authenticating' || processingStage === 'matching' || processingStage === 'complete') ? <CheckCircle size={14} className="text-[#00ffaa]" /> : <div className="w-3 h-3 rounded-full bg-border" />)}
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className={processingStage === 'authenticating' || processingStage === 'matching' || processingStage === 'complete' ? 'text-white' : 'text-text-muted'}>
                  Forgery Detection (8002)
                </span>
                {processingStage === 'authenticating' ? <Loader2 size={14} className="animate-spin text-secondary" /> :
                  ((processingStage === 'matching' || processingStage === 'complete') ? <CheckCircle size={14} className="text-[#00ffaa]" /> : <div className="w-3 h-3 rounded-full bg-border" />)}
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className={processingStage === 'matching' || processingStage === 'complete' ? 'text-white' : 'text-text-muted'}>
                  Face Matching (8003)
                </span>
                {processingStage === 'matching' ? <Loader2 size={14} className="animate-spin text-accent" /> :
                  (processingStage === 'complete' ? <CheckCircle size={14} className="text-[#00ffaa]" /> : <div className="w-3 h-3 rounded-full bg-border" />)}
              </div>
            </div>
          </div>

          <h3 className="text-xl font-semibold mb-6">Verification Steps</h3>
          <div className="flex flex-col">
            {steps.map((step, index) => {
              const isActive = index + 1 === currentStep;
              const isCompleted = index + 1 < currentStep;

              return (
                <div key={step.id} className="flex gap-4 min-h-[80px] relative">
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
                    <p className="text-sm text-text-muted mt-1">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default KYCPage;
