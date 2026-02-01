export const calculateEAR = (landmarks) => {
    // Eye Aspect Ratio calculation
    // Indices for MediaPipe Face Mesh:
    // Left eye: [33, 160, 158, 133, 153, 144]
    // Right eye: [362, 385, 387, 263, 373, 380]

    const getDistance = (p1, p2) => {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const ear = (eyePoints) => {
        const v1 = getDistance(landmarks[eyePoints[1]], landmarks[eyePoints[5]]);
        const v2 = getDistance(landmarks[eyePoints[2]], landmarks[eyePoints[4]]);
        const h = getDistance(landmarks[eyePoints[0]], landmarks[eyePoints[3]]);
        if (h === 0) return 0.5; // Default "open" state if distance is 0
        return (v1 + v2) / (2.0 * h);
    };

    const leftEAR = ear([33, 160, 158, 133, 153, 144]);
    const rightEAR = ear([362, 385, 387, 263, 373, 380]);

    return (leftEAR + rightEAR) / 2.0;
};

export const validateMovement = (landmarksSequence, target) => {
    // target: { x: float, y: float }
    if (landmarksSequence.length < 2) return { score: 0, passed: false, dx: 0, dy: 0 };

    // Track nose tip (index 1 in MediaPipe)
    const firstPos = landmarksSequence[0][1];
    const lastPos = landmarksSequence[landmarksSequence.length - 1][1];

    // Mirror Tolerance: Webcam is mirrored in UI, but raw in recording.
    // We check distance for both original target.x and mirrored target.x
    const getDist = (tx) => Math.sqrt(Math.pow(lastPos.x - tx, 2) + Math.pow(lastPos.y - target.y, 2));

    const distNormal = getDist(target.x);
    const distMirrored = getDist(1 - target.x);
    const distance = Math.min(distNormal, distMirrored);

    // Pass if any part of the face (30% radius) overlaps the target dot
    const passed = distance <= 0.30;
    const score = passed ? 1.0 : 0.0;

    return {
        score,
        passed,
        distance,
        target,
        is_mirrored: distMirrored < distNormal
    };
};

export const countBlinks = (ears) => {
    const THRESHOLD = 0.25;
    let blinks = 0;
    let closed = false;

    for (const ear of ears) {
        if (ear < THRESHOLD && !closed) {
            closed = true;
            blinks++;
        } else if (ear >= THRESHOLD) {
            closed = false;
        }
    }
    return blinks;
};
