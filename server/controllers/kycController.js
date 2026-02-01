import User from '../models/User.js';
import Kyc from '../models/Kyc.js';
import BiometricSession from '../models/BiometricSession.js';
import { cloudinary } from '../config/cloudinary.js';
import fs from 'fs';
import axios from 'axios';
import { extractAadhaar, extractPan, extractFace, detectFraud, verifyFace } from '../services/fastapiService.js';

// @desc    Update personal info (Step 1)
// @route   POST /api/kyc/info
// @access  Private
const updatePersonalInfo = async (req, res) => {
  const { firstName, lastName, dateOfBirth, nationalIdNumber, botResult } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (user) {
      console.log(`[KYC] Updating personal info for: ${user.email}`);
      user.name = `${firstName} ${lastName}`;
      user.dateOfBirth = dateOfBirth;
      user.nationalIdNumber = nationalIdNumber;
      user.verificationStep = 2; // Move to next step

      if (botResult) {
        console.log(`[KYC] Bot Detection result received: ${botResult.prediction} (Conf: ${botResult.confidence})`);
        user.botDetectionResult = {
          prediction: botResult.prediction,
          confidence: botResult.confidence,
          analyzedAt: new Date()
        };
      }

      const updatedUser = await user.save();
      console.log(`[KYC] Personal info updated successfully.`);

      res.json({
         _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        kycStatus: updatedUser.kycStatus,
        verificationStep: updatedUser.verificationStep
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Upload KYC Documents (Step 2)
// @route   POST /api/kyc/upload
// @access  Private
const uploadDocuments = async (req, res) => {
  console.log("Files Upload Request Received");
  let aadhaarLocalPath = null;
  let panLocalPath = null;
  
  // Set headers for streaming response
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
        res.write(JSON.stringify({ type: 'error', message: 'User not found' }) + '\n');
        return res.end();
    }

    const files = req.files;
    if (!files.aadhaar || !files.aadhaar[0] || !files.pan || !files.pan[0]) {
         res.write(JSON.stringify({ type: 'error', message: 'Both Aadhaar and PAN documents are required' }) + '\n');
         return res.end();
    }

    aadhaarLocalPath = files.aadhaar[0].path;
    panLocalPath = files.pan[0].path;
    
    console.log(`[KYC] Starting processing for user: ${user.email}`);
    console.log(`[KYC] Aadhaar Path: ${aadhaarLocalPath}`);
    console.log(`[KYC] PAN Path: ${panLocalPath}`);
    
    // Notify start
    res.write(JSON.stringify({ type: 'start', message: 'Processing started' }) + '\n');

    // 1. Upload to Cloudinary (Parallel)
    const uploadPromise = Promise.all([
      cloudinary.uploader.upload(aadhaarLocalPath),
      cloudinary.uploader.upload(panLocalPath)
    ]).then(([aadhaarUpload, panUpload]) => {
        console.log(`[KYC] Uploads complete. Aadhaar: ${aadhaarUpload.secure_url}, PAN: ${panUpload.secure_url}`);
        user.aadhaarUrl = aadhaarUpload.secure_url;
        user.panUrl = panUpload.secure_url;
        res.write(JSON.stringify({ 
            type: 'upload_complete', 
            aadhaarUrl: user.aadhaarUrl,
            panUrl: user.panUrl 
        }) + '\n');
        return { aadhaarUpload, panUpload };
    });

    // 2. OCR Extraction
    const aadhaarOcrPromise = extractAadhaar(aadhaarLocalPath).then(data => {
        console.log(`[KYC] Aadhaar OCR Complete:`, JSON.stringify(data.data));
        res.write(JSON.stringify({ type: 'ocr_aadhaar', data: data.data }) + '\n');
        return data;
    });
    
    const panOcrPromise = extractPan(panLocalPath).then(data => {
        console.log(`[KYC] PAN OCR Complete:`, JSON.stringify(data.data));
        res.write(JSON.stringify({ type: 'ocr_pan', data: data.data }) + '\n');
        return data;
    });

    // 3. Fraud Detection
    const fraudPromise = detectFraud(aadhaarLocalPath).then(data => {
        console.log(`[KYC] Fraud Detection Result:`, JSON.stringify(data));
        res.write(JSON.stringify({ type: 'fraud_check', data }) + '\n');
        return data;
    });

    // 4. Face Extraction & Matching
    // We need extracted faces to match
    const aadhaarFacePromise = extractFace(aadhaarLocalPath);
    const panFacePromise = extractFace(panLocalPath);
    
    const faceMatchPromise = Promise.all([aadhaarFacePromise, panFacePromise])
        .then(async ([aadhaarFace, panFace]) => {
             console.log(`[KYC] Face extraction complete. AadhaarFace: ${!!aadhaarFace}, PANFace: ${!!panFace}`);
             // We can signal extraction complete if we want, but user cares about match
             if (aadhaarFace && panFace) {
                 const matchResult = await verifyFace(aadhaarFace, panFace);
                 console.log(`[KYC] Face Match Result:`, JSON.stringify(matchResult));
                 res.write(JSON.stringify({ type: 'face_match', data: matchResult }) + '\n');
                 return { matchResult, aadhaarFace, panFace }; // Return faces for later if needed?
             }
             return { matchResult: { verified: false, distance: 1.0 }, aadhaarFace, panFace };
        });

    // Wait for all critical parts to finish to save DB
    const startStep2 = Date.now();
    const [uploads, aadhaarOcr, panOcr, fraudData, faceData] = await Promise.all([
        uploadPromise, 
        aadhaarOcrPromise, 
        panOcrPromise, 
        fraudPromise, 
        faceMatchPromise
    ]);
    const durationStep2 = Date.now() - startStep2;
    console.log(`⏱️ [Step2Processing] Total microservice parallel processing took ${durationStep2}ms`);
    
    // Cross-Validate Information
    const normalizeText = (text) => {
        if (!text) return '';
        return String(text).toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Helper to get value from data ignoring case of keys or trying variations
    const getValue = (data, keys) => {
        if (!data) return '';
        for (const key of keys) {
            if (data[key]) return data[key];
        }
        return '';
    };

    const aadharData = aadhaarOcr.data || {};
    const panData = panOcr.data || {};

    const aadharName = getValue(aadharData, ['Name', 'name', 'NAME', 'Aadhaar_Name']);
    const panName = getValue(panData, ['Name', 'name', 'NAME', 'PAN_Name', 'Father Name']); // Father Name sometimes confuses, but keeping Name priority
    
    const aadharDob = getValue(aadharData, ['DOB', 'dob', 'Date of Birth', 'Date_of_Birth', 'Aadhaar_DOB']);
    const panDob = getValue(panData, ['Date_of_Birth', 'DOB', 'dob', 'Date of Birth', 'PAN_DOB']);

    const aadharGender = getValue(aadharData, ['Gender', 'gender', 'Aadhaar_Gender']);
    const panGender = getValue(panData, ['Gender', 'gender', 'PAN_Gender']);

    console.log("--- Cross Check Debug ---");
    console.log(`Aadhaar Name: '${aadharName}' -> '${normalizeText(aadharName)}'`);
    console.log(`PAN Name:     '${panName}' -> '${normalizeText(panName)}'`);
    console.log(`Aadhaar DOB:  '${aadharDob}' -> '${normalizeText(aadharDob)}'`);
    console.log(`PAN DOB:      '${panDob}' -> '${normalizeText(panDob)}'`);
    
    const crossMatch = {
        nameMatch: normalizeText(aadharName) === normalizeText(panName),
        dobMatch: normalizeText(aadharDob) === normalizeText(panDob),
        genderMatch: normalizeText(aadharGender) === normalizeText(panGender)
    };

    const profileMatch = {
        nameMatch: normalizeText(user.name) === normalizeText(aadharName) || normalizeText(user.name) === normalizeText(panName),
        dobMatch: normalizeText(user.dateOfBirth?.toISOString().split('T')[0]) === normalizeText(aadharDob) || normalizeText(user.dateOfBirth?.toISOString().split('T')[0]) === normalizeText(panDob)
    };
    
    console.log("[KYC] Cross Match Results:");
    console.log(` - Name Match (Aadhaar/PAN): ${crossMatch.nameMatch} ('${aadharName}' vs '${panName}')`);
    console.log(` - Profile Name Match: ${profileMatch.nameMatch} ('${user.name}' vs IDs)`);
    console.log(` - DOB Match: ${crossMatch.dobMatch}`);
    
    // Notify Frontend of Cross Match
    res.write(JSON.stringify({ type: 'cross_match', data: crossMatch }) + '\n');

    // 5. Save to Kyc Model
    const kycEntry = await Kyc.create({
        user: user._id,
        aadhaar: {
            number: aadhaarOcr.data?.Aadhaar_Number || aadhaarOcr.data?.UID,
            name: aadhaarOcr.data?.Name,
            dob: aadhaarOcr.data?.DOB,
            gender: aadhaarOcr.data?.Gender,
            details: aadhaarOcr.data
        },
        aadhaarForgeryDetection: {
            verdict: fraudData.verdict,
            confidence: fraudData.confidence,
            raw_score: fraudData.raw_score,
            filename: fraudData.filename
        },
        pan: {
            number: panOcr.data?.PAN_Number,
            name: panOcr.data?.Name,
            fatherName: panOcr.data?.Father_Name,
            dob: panOcr.data?.Date_of_Birth,
            details: panOcr.data
        },
        faceMatch: {
            isMatch: faceData.matchResult.verified,
            distance: faceData.matchResult.distance,
            threshold: faceData.matchResult.threshold,
            model: faceData.matchResult.model,
            verified: faceData.matchResult.verified
        },
        AadharPanMatch: crossMatch,
        profileMatch: profileMatch,
        status: (fraudData.verdict === 'Real' && faceData.matchResult.verified && profileMatch.nameMatch) ? 'verified' : 'pending' 
    });

    // 6. Update User Status
    user.kycStatus = kycEntry.status; 
    if (kycEntry.status === 'verified') {
        user.verificationStep = 3; // Move to Biometric (Step 3)
    } else {
        user.verificationStep = 2; // Retry or manual
    }
    await user.save();

    // 7. Final Consensus Analysis
    const consensus = {
        identity: {
            aadhaarMatch: crossMatch.nameMatch && crossMatch.dobMatch,
            panMatch: crossMatch.nameMatch && crossMatch.dobMatch,
            overallCrossMatch: crossMatch.nameMatch && crossMatch.dobMatch,
            profileConsistency: profileMatch.nameMatch && profileMatch.dobMatch
        },
        integrity: {
            aadhaarForgery: fraudData.verdict,
            faceMatch: faceData.matchResult.verified,
            faceDistance: faceData.matchResult.distance,
            botDetection: user.botDetectionResult?.prediction || "N/A"
        },
        verdict: (fraudData.verdict === 'Real' && faceData.matchResult.verified && profileMatch.nameMatch) ? 'TRUSTED' : 'SUSPICIOUS'
    };

    console.log("\n" + "="*50);
    console.log("       🏁 FINAL KYC CONSENSUS ANALYSIS 🏁       ");
    console.log("="*50);
    console.log(`👤 User: ${user.name} (${user.email})`);
    console.log(`🤖 Bot Detection: ${consensus.integrity.botDetection.toUpperCase()}`);
    console.log("--------------------------------------------------");
    console.log(`📄 Aadhaar Forgery: ${consensus.integrity.aadhaarForgery.toUpperCase()}`);
    console.log(`👥 Face Similarity: ${consensus.integrity.faceMatch ? 'MATCHED' : 'FAILED'} (Dist: ${consensus.integrity.faceDistance?.toFixed(4)})`);
    console.log(`🔗 Data Cross-Match: ${consensus.identity.overallCrossMatch ? 'CONSISTENT' : 'DISCREPANCY DETECTED'}`);
    console.log(`🧩 Profile Sync: ${consensus.identity.profileConsistency ? 'VERIFIED' : 'FAILED'}`);
    console.log("--------------------------------------------------");
    console.log(`🏆 FINAL VERDICT: ${consensus.verdict}`);
    console.log("="*50 + "\n");

    res.write(JSON.stringify({ 
        type: 'complete', 
        kycStatus: user.kycStatus, 
        verificationStep: user.verificationStep,
        consensus
    }) + '\n');
    
    res.end();

  } catch (error) {
    console.error("KYC Upload Error:", error);
    // If headers already sent, we write error chunk
    res.write(JSON.stringify({ type: 'error', message: 'KYC Processing Failed: ' + error.message }) + '\n');
    res.end();
  } finally {
    // Cleanup local files
    try {
        if (aadhaarLocalPath && fs.existsSync(aadhaarLocalPath)) fs.unlinkSync(aadhaarLocalPath);
        if (panLocalPath && fs.existsSync(panLocalPath)) fs.unlinkSync(panLocalPath);
    } catch (e) {
        console.error("File cleanup error:", e);
    }
  }
};


// @desc    Verify Selfie (Step 3)
// @route   POST /api/kyc/biometric
// @access  Private
const verifyBiometric = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user || null == user.aadhaarUrl) {
            return res.status(400).json({ message: 'User or Aadhaar document not found' });
        }
        
        if (!req.file) {
             return res.status(400).json({ message: 'Selfie image is required' });
        }
        
        const selfiePath = req.file.path;
        
        // 1. Get Access to Aadhaar Image (buffer)
        // Since we don't have local file, fetch from Cloudinary
        console.log("Fetching Aadhaar for comparison...", user.aadhaarUrl);
        const aadhaarRes = await axios.get(user.aadhaarUrl, { responseType: 'arraybuffer' });
        const aadhaarBuffer = Buffer.from(aadhaarRes.data);
        
        // 2. Extract Face from Aadhaar Buffer? 
        // Our service `extractFace` expects a FILE PATH.
        // We need to write the temp file or update `extractFace` to handle buffers.
        // For consistency/simplicity, let's write aadhaarBuffer to a temp file.
        const tempAadhaarPath = `./temp_aadhaar_${user._id}.jpg`;
        fs.writeFileSync(tempAadhaarPath, aadhaarBuffer);
        
        // 3. Extract & Verify
        // Extract faces from both
        const [aadhaarFace, selfieFace] = await Promise.all([
            extractFace(tempAadhaarPath),
            extractFace(selfiePath)
        ]);
        
        const verifyStart = Date.now();
        let matchResult = { verified: false };
        if (aadhaarFace && selfieFace) {
             matchResult = await verifyFace(aadhaarFace, selfieFace);
        }
        const verifyDuration = Date.now() - verifyStart;
        console.log(`⏱️ [FaceMatch] Aadhaar-Selfie comparison took ${verifyDuration}ms`);
        
        // Cleanup temp
        if (fs.existsSync(tempAadhaarPath)) fs.unlinkSync(tempAadhaarPath);
        if (fs.existsSync(selfiePath)) fs.unlinkSync(selfiePath);
        
        // Update User if verified
        if (matchResult.verified) {
            user.verificationStep = 4; // Move to Voice/Complete
            // We'll set kycStatus to verified ONLY after consensus in some flows, 
            // but here we follow the current logic.
            user.kycStatus = 'verified'; 
            await user.save();

            // Store in Kyc model too
            await Kyc.findOneAndUpdate(
                { user: user._id },
                { 
                    $set: { 
                        faceMatch: {
                            isMatch: matchResult.verified,
                            distance: matchResult.distance,
                            threshold: matchResult.threshold,
                            model: matchResult.model || 'DeepFace',
                            verified: matchResult.verified
                        }
                    } 
                },
                { upsert: true }
            );
        }
        
        res.json(matchResult);

    } catch (error) {
        console.error("Biometric Error:", error);
        res.status(500).json({ message: error.message });
    }
};

const getKycAnalysis = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        console.log(`USER for analysis : ${user}`)
        if (!user) return res.status(404).json({ message: 'User not found' });

        // User specifically asked to use Kyc model data
        const kyc = await Kyc.findOne({ user: user._id }).lean();
        if (!kyc) return res.status(404).json({ message: 'KYC data not found for this user' });

        console.log(`USER KYC for analysis : ${kyc}`)

        // Map Kyc model data to the structure the frontend expects
        const analysis = {
            user: {
                name: user.name,
                email: user.email,
                botDetection: user.botDetectionResult
            },
            documents: {
                aadhaar: kyc.aadhaar,
                pan: kyc.pan,
                forgery: kyc.aadhaarForgeryDetection,
                crossMatch: kyc.AadharPanMatch,
                profileMatch: kyc.profileMatch,
                faceMatch: kyc.faceMatch
            },
            biometric: {
                face: kyc.livenessCheck,
                voice: kyc.voiceCheck,
                status: kyc.status === 'verified' ? 'COMPLETED' : 'PENDING'
            },
            finalVerdict: {
                status: user.kycStatus,
                isTrusted: (
                    user.kycStatus === 'verified' && 
                    user.botDetectionResult?.prediction === 'human' &&
                    kyc.aadhaarForgeryDetection?.verdict === 'Real' &&
                    kyc.faceMatch?.isMatch === true
                ) ? 'TRUSTED' : 'SUSPICIOUS'
            }
        };

        console.log(`USER KYC for analysis : ${analysis}`)

        res.json(analysis);
    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export { updatePersonalInfo, uploadDocuments, verifyBiometric, getKycAnalysis };
