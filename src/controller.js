
// import {
//   FaceLandmarker,
//   FilesetResolver,
//   GestureRecognizer
// } from "@mediapipe/tasks-vision";

// const videoEl = document.getElementById("video");
// const canvasEl = document.getElementById("overlay");
// const statusEl = document.getElementById("status");
// const lastGestureEl = document.getElementById("last-gesture");
// const startBtn = document.getElementById("start");
// const stopBtn = document.getElementById("stop");

// const ctx = canvasEl.getContext("2d");
// const drawOverlayEnabled = true;
// const calibrateMs = 2500;

// const actionCooldownMs = {
//   HAND_PINCH: 420,
//   DOUBLE_BLINK: 800,
//   LONG_BLINK: 900,
//   LEFT_WINK: 600,
//   RIGHT_WINK: 600,
//   HAND_SWIPE_L: 340,
//   HAND_SWIPE_R: 340,
//   HAND_SCROLL_UP: 200,
//   HAND_SCROLL_DOWN: 200,
//   CURSOR_MOVE: 20
// };

// // ─── Blink FSM phases ─────────────────────────────────────────────────────
// // IDLE        : no blink in progress — natural blinks produce no action
// // B1_CLOSED   : 1st blink, eyes currently closed — timing the hold
// // AWAIT_SECOND: 1st blink complete, watching for 2nd within window
// // B2_CLOSED   : 2nd blink, eyes currently closed — timing the hold
// const BLINK_IDLE = 0;
// const BLINK_B1_CLOSED = 1;
// const BLINK_AWAIT_2 = 2;
// const BLINK_B2_CLOSED = 3;

// // Blink timing parameters
// const BLINK_SHORT_MIN = 120;    // ms — minimum to count as an intentional blink
// const BLINK_SHORT_MAX = 550;   // ms — above this is not a short blink
// const LONG_BLINK_MIN = 1200;  // ms
// const LONG_BLINK_MAX = 5000;  // ms
// const DOUBLE_WINDOW = 450;   // ms — max gap between end of B1 and start of B2
// const REOPEN_FRACTION = 0.80;  // eyes must recover to this fraction of open baseline
// // before B2 is accepted (prevents squint false-fires)
// // ──────────────────────────────────────────────────────────────────────────

// let running = false;
// let stream = null;
// let faceLandmarker = null;
// let handRecognizer = null;
// let animationFrameId = null;
// let frameCount = 0;
// const lastActionTs = {};
// let calibrationStartedAt = 0;

// // Blink FSM
// let blinkPhase = BLINK_IDLE;
// let blinkCloseTs = 0;    // timestamp when current blink's eyes closed
// let blink1OpenTs = 0;    // timestamp when 1st blink's eyes reopened
// let eyesReopened = false; // did eyes fully reopen between B1 and B2?
// let blinkWindowTimer = null; // cancels AWAIT_2 if B2 never arrives
// let prevBothClosed = false; // previous-frame both-closed state (for edge detection)
// let lastBlinkActionAt = 0;   // timestamp of last fired blink-family action

// // Wink
// let leftClosedFrames = 0;
// let rightClosedFrames = 0;
// let winkReadyAt = 0;

// // Hand
// let handTrace = [];
// let handMotionReadyAt = 0;
// let pinchState = { frames: 0, active: false };
// let fingerCountState = { twoFrames: 0, threeFrames: 0 };
// let cursorMode = false;
// let lastCursorSendAt = 0;

// let lastFaceResult = null;
// let lastHandResult = null;

// const baseline = { leftOpenEar: null, rightOpenEar: null, handScale: null };
// const smooth = {
//   leftEar: null, rightEar: null, wristX: null, wristY: null,
//   pinchRatio: null, handConfidence: null
// };

// const modelUrls = {
//   face: chrome.runtime.getURL("models/face_landmarker.task"),
//   hand: chrome.runtime.getURL("models/gesture_recognizer.task")
// };

// const mapAction = {
//   HAND_SCROLL_UP: "SCROLL_UP",
//   HAND_SCROLL_DOWN: "SCROLL_DOWN",
//   HAND_SWIPE_L: "NAVIGATE_BACK",
//   HAND_SWIPE_R: "NAVIGATE_FORWARD",
//   CURSOR_MOVE: "MOVE_CURSOR",
//   HAND_PINCH: "CLICK",
//   DOUBLE_BLINK: "NEW_TAB",  // ← change to any action you want
//   LONG_BLINK: "RELOAD",
//   LEFT_WINK: "NEXT_TAB",
//   RIGHT_WINK: "CLOSE_TAB"
// };

// const now = () => performance.now();
// const setStatus = (t) => { statusEl.textContent = `Status: ${t}`; };
// const setLastGesture = (g) => { lastGestureEl.textContent = `Last gesture: ${g}`; };
// const smoothValue = (cur, next, alpha = 0.25) =>
//   cur === null ? next : cur * (1 - alpha) + next * alpha;

// const sendAction = (label, payload = undefined) => {
//   const action = mapAction[label];
//   if (!action) return false;
//   const ts = now();
//   if (ts - (lastActionTs[label] ?? 0) < (actionCooldownMs[label] ?? 550)) return false;
//   lastActionTs[label] = ts;
//   setLastGesture(label);
//   chrome.runtime
//     .sendMessage({ type: "GESTURE_ACTION", action, payload })
//     .then((r) => { if (r && !r.ok) setStatus(`action failed (${action})`); })
//     .catch(() => setStatus(`action failed (${action})`));
//   return true;
// };

// const euclidean = (a, b) => {
//   const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z ?? 0) - (b.z ?? 0);
//   return Math.sqrt(dx * dx + dy * dy + dz * dz);
// };

// const eyeAspectRatio = (landmarks, left) => {
//   const eye = left
//     ? { hA: 33, hB: 133, vPairs: [[159, 145], [158, 153], [160, 144]] }
//     : { hA: 263, hB: 362, vPairs: [[386, 374], [385, 380], [387, 373]] };
//   const h = euclidean(landmarks[eye.hA], landmarks[eye.hB]);
//   const v = eye.vPairs.reduce((s, [a, b]) => s + euclidean(landmarks[a], landmarks[b]), 0)
//     / eye.vPairs.length;
//   return v / Math.max(h, 1e-6);
// };

// const countExtendedFingers = (lm) =>
//   [[8, 6], [12, 10], [16, 14], [20, 18]].reduce(
//     (n, [tip, pip]) => n + (lm[tip].y < lm[pip].y ? 1 : 0), 0
//   );

// // ─── Blink FSM helpers ────────────────────────────────────────────────────

// const cancelBlinkWindow = () => {
//   if (blinkWindowTimer) { clearTimeout(blinkWindowTimer); blinkWindowTimer = null; }
// };

// const resetBlinkFSM = () => {
//   cancelBlinkWindow();
//   blinkPhase = BLINK_IDLE;
//   eyesReopened = false;
// };

// // ─── Face gesture detection ───────────────────────────────────────────────

// const detectFaceGestures = (faceResult, ts) => {
//   if (!faceResult?.faceLandmarks?.length) return;
//   const lm = faceResult.faceLandmarks[0];

//   const leftRaw = eyeAspectRatio(lm, true);
//   const rightRaw = eyeAspectRatio(lm, false);
//   smooth.leftEar = smoothValue(smooth.leftEar, leftRaw, 0.72);
//   smooth.rightEar = smoothValue(smooth.rightEar, rightRaw, 0.72);

//   // Calibration
//   if (ts - calibrationStartedAt < calibrateMs) {
//     baseline.leftOpenEar = smoothValue(baseline.leftOpenEar, smooth.leftEar, 0.08);
//     baseline.rightOpenEar = smoothValue(baseline.rightOpenEar, smooth.rightEar, 0.08);
//     const rem = Math.max(0, Math.ceil((calibrateMs - (ts - calibrationStartedAt)) / 1000));
//     setStatus(`calibrating (${rem}s)`);
//     return;
//   }

//   const bL = baseline.leftOpenEar ?? 0.26;
//   const bR = baseline.rightOpenEar ?? 0.26;

//   // Per-eye close threshold (60% of open baseline)
//   const closeL = Math.max(0.11, bL * 0.60);
//   const closeR = Math.max(0.11, bR * 0.60);

//   // Fully-open threshold for between-blink reopen check
//   const reopenL = bL * REOPEN_FRACTION;
//   const reopenR = bR * REOPEN_FRACTION;

//   leftClosedFrames = smooth.leftEar < closeL ? leftClosedFrames + 1 : 0;
//   rightClosedFrames = smooth.rightEar < closeR ? rightClosedFrames + 1 : 0;
//   const leftClosed = leftClosedFrames >= 1;
//   const rightClosed = rightClosedFrames >= 1;
//   const bothClosed = leftClosed && rightClosed;

//   // Edge detection — transitions, not continuous state
//   const closingEdge = bothClosed && !prevBothClosed;
//   const openingEdge = !bothClosed && prevBothClosed;
//   prevBothClosed = bothClosed;

//   // Track full reopen between B1 and B2
//   if (blinkPhase === BLINK_AWAIT_2 && !bothClosed) {
//     if (smooth.leftEar > reopenL && smooth.rightEar > reopenR) {
//       eyesReopened = true;
//     }
//   }

//   // ── Transitions on eye CLOSING ─────────────────────────────────────────
//   if (closingEdge) {
//     blinkCloseTs = ts;  // record when this blink started

//     if (blinkPhase === BLINK_IDLE) {
//       blinkPhase = BLINK_B1_CLOSED;

//     } else if (blinkPhase === BLINK_AWAIT_2) {
//       const gap = ts - blink1OpenTs;
//       if (eyesReopened && gap <= DOUBLE_WINDOW) {
//         // Eyes fully reopened and 2nd blink arrived in time → valid B2
//         cancelBlinkWindow();
//         blinkPhase = BLINK_B2_CLOSED;
//       } else {
//         // Eyes never fully reopened, or gap too long → treat as a new B1
//         cancelBlinkWindow();
//         blinkPhase = BLINK_B1_CLOSED;
//         eyesReopened = false;
//       }
//     }
//     // If phase is B1_CLOSED or B2_CLOSED: eyes were already closed so closingEdge
//     // shouldn't fire; if it does (corner case), blinkCloseTs update is harmless.
//   }

//   // ── Transitions on eye OPENING ─────────────────────────────────────────
//   if (openingEdge) {
//     const dur = ts - blinkCloseTs;

//     if (blinkPhase === BLINK_B1_CLOSED) {
//       if (dur >= LONG_BLINK_MIN && dur <= LONG_BLINK_MAX) {
//         // Intentional long hold
//         sendAction("LONG_BLINK");
//         lastBlinkActionAt = ts;
//         resetBlinkFSM();

//       } else if (dur >= BLINK_SHORT_MIN && dur <= BLINK_SHORT_MAX) {
//         // Valid short 1st blink — open the window for B2
//         blink1OpenTs = ts;
//         eyesReopened = false;
//         blinkPhase = BLINK_AWAIT_2;

//         // If B2 never comes, silently reset — no action for a single blink
//         blinkWindowTimer = setTimeout(() => {
//           blinkPhase = BLINK_IDLE;
//           blinkWindowTimer = null;
//         }, DOUBLE_WINDOW + 80);

//       } else {
//         // Too fast (twitch) or outside all ranges → discard
//         resetBlinkFSM();
//       }

//     } else if (blinkPhase === BLINK_B2_CLOSED) {
//       if (dur >= BLINK_SHORT_MIN && dur <= BLINK_SHORT_MAX) {
//         // ✅ Both blinks confirmed: valid duration, eyes reopened between them,
//         //    B2 arrived within the window — fire DOUBLE_BLINK.
//         if (ts - lastBlinkActionAt > 400) {
//           sendAction("DOUBLE_BLINK");
//           lastBlinkActionAt = ts;
//         }
//       }
//       // Whether we fired or not, the sequence is over
//       resetBlinkFSM();
//     }
//   }

//   // ── Wink — only when FSM is idle and far enough from any blink action ──
//   if (ts >= winkReadyAt && blinkPhase === BLINK_IDLE && ts - lastBlinkActionAt > 500) {
//     const leftRatio = smooth.leftEar / Math.max(smooth.rightEar, 1e-6);
//     const rightRatio = smooth.rightEar / Math.max(smooth.leftEar, 1e-6);

//     if (leftClosed && !rightClosed && leftRatio < 0.60) {
//       winkReadyAt = ts + 600;
//       sendAction("LEFT_WINK");
//     } else if (rightClosed && !leftClosed && rightRatio < 0.60) {
//       winkReadyAt = ts + 600;
//       sendAction("RIGHT_WINK");
//     }
//   }
// };

// // ─── Hand gesture detection ───────────────────────────────────────────────

// const detectHandGestures = (handResult, ts) => {
//   if (!handResult?.landmarks?.length) {
//     handTrace = [];
//     pinchState = { frames: 0, active: false };
//     fingerCountState = { twoFrames: 0, threeFrames: 0 };
//     cursorMode = false;
//     return;
//   }

//   const rawLm = handResult.landmarks[0];
//   // Correct coordinates: raw feed is rotated 180 (mirrored H and V).
//   // We map to mirrored-preview space: (1-x, 1-y)
//   const lm = rawLm.map(p => ({ x: 1 - p.x, y: 1 - p.y, z: p.z }));

//   const handConfidence = handResult?.handednesses?.[0]?.[0]?.score ?? 0.5;
//   smooth.handConfidence = smoothValue(smooth.handConfidence, handConfidence, 0.25);
//   if ((smooth.handConfidence ?? 0) < 0.22) return;

//   const thumbTip = lm[4];
//   const indexTip = lm[8];
//   const middleTip = lm[12];
//   const wrist = lm[0];
//   const indexMcp = lm[5];
//   const pinkyMcp = lm[17];

//   baseline.handScale = smoothValue(baseline.handScale, euclidean(indexMcp, wrist), 0.12);
//   smooth.wristX = smoothValue(smooth.wristX, wrist.x, 0.35);
//   smooth.wristY = smoothValue(smooth.wristY, wrist.y, 0.35);
//   if (smooth.wristX === null || smooth.wristY === null) return;

//   handTrace.push({ x: smooth.wristX, y: smooth.wristY, t: ts });
//   handTrace = handTrace.filter((p) => ts - p.t < 280);
//   if (handTrace.length < 3) return;

//   const first = handTrace[0];
//   const mid = handTrace[Math.floor(handTrace.length / 2)];
//   const last = handTrace[handTrace.length - 1];
//   const dx = last.x - first.x;
//   const dy = last.y - first.y;
//   const dx2 = last.x - mid.x;
//   const dy2 = last.y - mid.y;
//   const travel = Math.sqrt(dx * dx + dy * dy);

//   const extendedCount = countExtendedFingers(lm);
//   cursorMode = extendedCount === 1;

//   if (ts >= handMotionReadyAt) {
//     if (dx < -0.10 && dx2 < -0.055 && Math.abs(dy) < 0.08 && Math.abs(dy2) < 0.055) {
//       handMotionReadyAt = ts + 580;
//       handTrace = [];
//       sendAction("HAND_SWIPE_L");
//       return;
//     }
//     if (dx > 0.10 && dx2 > 0.055 && Math.abs(dy) < 0.08 && Math.abs(dy2) < 0.055) {
//       handMotionReadyAt = ts + 580;
//       handTrace = [];
//       sendAction("HAND_SWIPE_R");
//       return;
//     }
//   }

//   if (cursorMode) {
//     const cdx = dx * 800, cdy = dy * 800;
//     if (ts - lastCursorSendAt > 20 && (Math.abs(cdx) > 1.5 || Math.abs(cdy) > 1.5)) {
//       lastCursorSendAt = ts;
//       sendAction("CURSOR_MOVE", { dx: cdx, dy: cdy });
//     }
//   }

//   const stable = travel < 0.10 && Math.abs(dx) < 0.07;
//   fingerCountState.threeFrames = stable && extendedCount === 3 ? fingerCountState.threeFrames + 1 : 0;
//   fingerCountState.twoFrames = stable && extendedCount === 2 ? fingerCountState.twoFrames + 1 : 0;

//   if (ts >= handMotionReadyAt) {
//     if (fingerCountState.threeFrames >= 2) {
//       handMotionReadyAt = ts + 340;
//       fingerCountState.threeFrames = fingerCountState.twoFrames = 0;
//       sendAction("HAND_SCROLL_UP");
//       return;
//     }
//     if (fingerCountState.twoFrames >= 2) {
//       handMotionReadyAt = ts + 340;
//       fingerCountState.threeFrames = fingerCountState.twoFrames = 0;
//       sendAction("HAND_SCROLL_DOWN");
//       return;
//     }
//   }

//   const palmWidth = euclidean(indexMcp, pinkyMcp);
//   const pinchDist = euclidean(thumbTip, indexTip);
//   const midSpread = euclidean(thumbTip, middleTip);
//   const norm = Math.max(palmWidth, baseline.handScale ?? euclidean(indexMcp, wrist), 1e-6);
//   smooth.pinchRatio = smoothValue(smooth.pinchRatio, pinchDist / norm, 0.32);
//   const midRatio = midSpread / norm;
//   const stableHand = travel < 0.05;

//   const likelyPinch =
//     smooth.pinchRatio < 0.27 &&
//     midRatio > 0.36 &&
//     stableHand &&
//     Math.abs(dx) < 0.04 &&
//     Math.abs(dy) < 0.04;

//   if (likelyPinch) {
//     pinchState.frames++;
//     if (pinchState.frames >= 2 && !pinchState.active) {
//       pinchState.active = true;
//       sendAction("HAND_PINCH");
//     }
//   } else {
//     pinchState.frames = 0;
//     if (smooth.pinchRatio !== null && smooth.pinchRatio > 0.42) {
//       pinchState.active = false;
//     }
//   }
// };

// // ─── Overlay ──────────────────────────────────────────────────────────────

// const drawOverlay = (faceResult, handResult) => {
//   if (!drawOverlayEnabled || !ctx) return;
//   canvasEl.width = videoEl.videoWidth;
//   canvasEl.height = videoEl.videoHeight;
//   ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

//   const pts = (arr, color, r = 1.7) => {
//     ctx.fillStyle = color;
//     for (const p of arr) {
//       ctx.beginPath();
//       ctx.arc(p.x * canvasEl.width, p.y * canvasEl.height, r, 0, Math.PI * 2);
//       ctx.fill();
//     }
//   };

//   if (faceResult?.faceLandmarks?.length) {
//     const f = faceResult.faceLandmarks[0];
//     pts([33, 133, 159, 145, 158, 153, 160, 144, 263, 362, 386, 374, 385, 380, 387, 373].map(i => f[i]),
//       "#2f6fff", 2);
//   }
//   if (handResult?.landmarks?.length) {
//     const h = handResult.landmarks[0];
//     const c = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11],
//     [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20],
//     [5, 9], [9, 13], [13, 17]];
//     pts(h, "#0f172a", 2);
//     pts(c.map(([a, b]) => ({ x: (h[a].x + h[b].x) / 2, y: (h[a].y + h[b].y) / 2 })), "#475569", 1.4);
//   }
// };

// // ─── Main loop ────────────────────────────────────────────────────────────

// const step = () => {
//   if (!running || !faceLandmarker || !handRecognizer) return;
//   const ts = now();
//   frameCount++;
//   lastHandResult = handRecognizer.recognizeForVideo(videoEl, ts);
//   lastFaceResult = faceLandmarker.detectForVideo(videoEl, ts);
//   if (lastHandResult) detectHandGestures(lastHandResult, ts);
//   if (lastFaceResult) detectFaceGestures(lastFaceResult, ts);
//   drawOverlay(lastFaceResult, lastHandResult);
//   if (ts - calibrationStartedAt >= calibrateMs) setStatus("running");
//   animationFrameId = requestAnimationFrame(step);
// };

// // ─── Engine + lifecycle ───────────────────────────────────────────────────

// const createEngines = async () => {
//   setStatus("loading models");
//   const vision = await FilesetResolver.forVisionTasks(chrome.runtime.getURL("wasm"));
//   faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
//     baseOptions: { modelAssetPath: modelUrls.face },
//     runningMode: "VIDEO",
//     numFaces: 1
//   });
//   handRecognizer = await GestureRecognizer.createFromOptions(vision, {
//     baseOptions: { modelAssetPath: modelUrls.hand },
//     runningMode: "VIDEO",
//     numHands: 1
//   });
// };

// const resetState = () => {
//   resetBlinkFSM();
//   prevBothClosed = false;
//   lastBlinkActionAt = 0;
//   leftClosedFrames = rightClosedFrames = 0;
//   winkReadyAt = 0;
//   frameCount = 0;
//   lastFaceResult = lastHandResult = null;
//   handMotionReadyAt = 0;
//   pinchState = { frames: 0, active: false };
//   fingerCountState = { twoFrames: 0, threeFrames: 0 };
//   cursorMode = false;
//   lastCursorSendAt = 0;
//   handTrace = [];
//   baseline.leftOpenEar = baseline.rightOpenEar = baseline.handScale = null;
//   smooth.leftEar = smooth.rightEar = smooth.wristX = smooth.wristY =
//     smooth.pinchRatio = smooth.handConfidence = null;
// };

// const start = async () => {
//   if (running) return;
//   try {
//     await createEngines();
//     stream = await navigator.mediaDevices.getUserMedia({
//       video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
//       audio: false
//     });
//     videoEl.srcObject = stream;
//     await videoEl.play();
//     resetState();
//     calibrationStartedAt = now();
//     running = true;
//     setStatus("calibrating (3s)");
//     animationFrameId = requestAnimationFrame(step);
//   } catch (error) {
//     if (error.name === "NotAllowedError" || String(error).includes("Permission denied")) {
//       setStatus("Camera access denied. Check new tab to grant permission.");
//       chrome.tabs.create({ url: chrome.runtime.getURL("src/controller.html") });
//     } else {
//       setStatus(`error - ${String(error)}`);
//     }
//   }
// };

// const stop = () => {
//   running = false;
//   cancelBlinkWindow();
//   if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
//   if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
//   setStatus("stopped");
// };

// startBtn?.addEventListener("click", start);
// stopBtn?.addEventListener("click", stop);
//Here is the complete, fully updated code all in one piece. You can copy and paste this directly to replace your entire old script. 
import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer
} from "@mediapipe/tasks-vision";

const videoEl = document.getElementById("video");
const canvasEl = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const lastGestureEl = document.getElementById("last-gesture");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");

const ctx = canvasEl.getContext("2d");
const drawOverlayEnabled = true;
const calibrateMs = 2500;

const actionCooldownMs = {
  HAND_PINCH: 420,
  DOUBLE_BLINK: 800,
  LONG_BLINK: 900,
  LEFT_WINK: 600,
  RIGHT_WINK: 600,
  HAND_SWIPE_L: 340,
  HAND_SWIPE_R: 340,
  HAND_SCROLL_UP: 200,
  HAND_SCROLL_DOWN: 200,
  CURSOR_MOVE: 20
};

// ─── Blink FSM ────────────────────────────────────────────────────────────
const BLINK_IDLE = 0;
const BLINK_B1_CLOSED = 1;
const BLINK_AWAIT_2 = 2;
const BLINK_B2_CLOSED = 3;

// Timing constants
const BLINK_MIN = 40;
const BLINK_MAX = 600;
const LONG_MIN = 1300;
const LONG_MAX = 5500;
const DBL_WINDOW = 500;
// ──────────────────────────────────────────────────────────────────────────

let running = false;
let stream = null;
let faceLandmarker = null;
let handRecognizer = null;
let animationFrameId = null;
let frameCount = 0;
const lastActionTs = {};
let calibrationStartedAt = 0;

// Blink FSM state
let blinkPhase = BLINK_IDLE;
let blinkCloseTs = 0;
let blink1OpenTs = 0;
let eyesReopened = false;
let blinkWindowTimer = null;
let prevBothClosed = false;
let lastBlinkActionAt = 0;

// Wink
let leftClosedFrames = 0;
let rightClosedFrames = 0;
let winkReadyAt = 0;

// Hand
let handTrace = [];
let handMotionReadyAt = 0;
let pinchState = { frames: 0, active: false };
let fingerCountState = { twoFrames: 0, threeFrames: 0 };
let cursorMode = false;
let lastCursorSendAt = 0;

let lastFaceResult = null;
let lastHandResult = null;

const baseline = { leftOpenEar: null, rightOpenEar: null, handScale: null };
const smooth = {
  leftEar: null, rightEar: null,
  wristX: null, wristY: null,
  pinchRatio: null, handConfidence: null
};

const modelUrls = {
  face: chrome.runtime.getURL("models/face_landmarker.task"),
  hand: chrome.runtime.getURL("models/gesture_recognizer.task")
};

const mapAction = {
  HAND_SCROLL_UP: "SCROLL_UP",
  HAND_SCROLL_DOWN: "SCROLL_DOWN",
  HAND_SWIPE_L: "NAVIGATE_BACK",
  HAND_SWIPE_R: "NAVIGATE_FORWARD",
  CURSOR_MOVE: "MOVE_CURSOR",
  HAND_PINCH: "CLICK",
  DOUBLE_BLINK: "NEW_TAB",
  LONG_BLINK: "RELOAD",
  LEFT_WINK: "NEXT_TAB",
  RIGHT_WINK: "CLOSE_TAB"
};

const now = () => performance.now();
const setStatus = (t) => { statusEl.textContent = `Status: ${t}`; };
const setLastGesture = (g) => {
  lastGestureEl.textContent = `Last gesture: ${g}`;
  lastGestureEl.classList.remove("flash");
  void lastGestureEl.offsetWidth;
  lastGestureEl.classList.add("flash");
};

const smoothVal = (cur, next, alpha = 0.25) =>
  cur === null ? next : cur * (1 - alpha) + next * alpha;

const sendAction = (label, payload = undefined) => {
  const action = mapAction[label];
  if (!action) return false;
  const ts = now();
  if (ts - (lastActionTs[label] ?? 0) < (actionCooldownMs[label] ?? 550)) return false;
  lastActionTs[label] = ts;
  setLastGesture(label.replace(/_/g, " "));
  chrome.runtime
    .sendMessage({ type: "GESTURE_ACTION", action, payload })
    .then((r) => { if (r && !r.ok) setStatus(`action failed (${action})`); })
    .catch(() => setStatus(`action failed (${action})`));
  return true;
};

const euclidean = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

const eyeAspectRatio = (lm, left) => {
  const e = left
    ? { hA: 33, hB: 133, vP: [[159, 145], [158, 153], [160, 144]] }
    : { hA: 263, hB: 362, vP: [[386, 374], [385, 380], [387, 373]] };
  const h = euclidean(lm[e.hA], lm[e.hB]);
  const v = e.vP.reduce((s, [a, b]) => s + euclidean(lm[a], lm[b]), 0) / e.vP.length;
  return v / Math.max(h, 1e-6);
};

const countExtendedFingers = (lm) =>
  [[8, 6], [12, 10], [16, 14], [20, 18]].reduce(
    (n, [tip, pip]) => n + (lm[tip].y < lm[pip].y ? 1 : 0), 0
  );

// ─── Blink FSM helpers ────────────────────────────────────────────────────

const cancelBlinkWindow = () => {
  if (blinkWindowTimer) { clearTimeout(blinkWindowTimer); blinkWindowTimer = null; }
};

const resetBlinkFSM = () => {
  cancelBlinkWindow();
  blinkPhase = BLINK_IDLE;
  eyesReopened = false;
};

// ─── Face gestures ────────────────────────────────────────────────────────

const detectFaceGestures = (faceResult, ts) => {
  if (!faceResult?.faceLandmarks?.length) return;
  const lm = faceResult.faceLandmarks[0];

  smooth.leftEar = smoothVal(smooth.leftEar, eyeAspectRatio(lm, true), 0.82);
  smooth.rightEar = smoothVal(smooth.rightEar, eyeAspectRatio(lm, false), 0.82);

  // Calibration
  if (ts - calibrationStartedAt < calibrateMs) {
    baseline.leftOpenEar = smoothVal(baseline.leftOpenEar, smooth.leftEar, 0.08);
    baseline.rightOpenEar = smoothVal(baseline.rightOpenEar, smooth.rightEar, 0.08);
    const rem = Math.max(0, Math.ceil((calibrateMs - (ts - calibrationStartedAt)) / 1000));
    setStatus(`calibrating… ${rem}s`);
    return;
  }

  const bL = baseline.leftOpenEar ?? 0.26;
  const bR = baseline.rightOpenEar ?? 0.26;

  // Close threshold: 65% of open baseline
  const closeL = Math.max(0.10, bL * 0.65);
  const closeR = Math.max(0.10, bR * 0.65);

  leftClosedFrames = smooth.leftEar < closeL ? leftClosedFrames + 1 : 0;
  rightClosedFrames = smooth.rightEar < closeR ? rightClosedFrames + 1 : 0;

  const leftClosed = leftClosedFrames >= 1;
  const rightClosed = rightClosedFrames >= 1;
  const bothClosed = leftClosed && rightClosed;

  const closingEdge = bothClosed && !prevBothClosed;
  const openingEdge = !bothClosed && prevBothClosed;
  prevBothClosed = bothClosed;

  if (blinkPhase === BLINK_AWAIT_2 && !bothClosed) {
    eyesReopened = true;
  }

  // ── Closing edge ───────────────────────────────────────────────────────
  if (closingEdge) {
    blinkCloseTs = ts;

    if (blinkPhase === BLINK_IDLE) {
      blinkPhase = BLINK_B1_CLOSED;

    } else if (blinkPhase === BLINK_AWAIT_2) {
      const gap = ts - blink1OpenTs;
      if (eyesReopened && gap <= DBL_WINDOW) {

        // ⚡ INSTANT TRIGGER: Fires the exact moment eyes close a 2nd time ⚡
        if (ts - lastBlinkActionAt > 350) {
          sendAction("DOUBLE_BLINK");
          lastBlinkActionAt = ts;
        }
        resetBlinkFSM();
        return;

      } else {
        cancelBlinkWindow();
        blinkPhase = BLINK_B1_CLOSED;
        eyesReopened = false;
      }
    }
  }

  // ── Opening edge ───────────────────────────────────────────────────────
  if (openingEdge) {
    const dur = ts - blinkCloseTs;

    if (blinkPhase === BLINK_B1_CLOSED) {
      if (dur >= LONG_MIN && dur <= LONG_MAX) {
        sendAction("LONG_BLINK");
        lastBlinkActionAt = ts;
        resetBlinkFSM();

      } else if (dur >= BLINK_MIN && dur <= BLINK_MAX) {
        blink1OpenTs = ts;
        eyesReopened = false;
        blinkPhase = BLINK_AWAIT_2;
        blinkWindowTimer = setTimeout(() => {
          blinkPhase = BLINK_IDLE;
          blinkWindowTimer = null;
        }, DBL_WINDOW + 60);

      } else {
        resetBlinkFSM();
      }
    }
  }

  // ── Wink — only when FSM is idle ──────────────────────────────────────
  if (ts >= winkReadyAt && blinkPhase === BLINK_IDLE && ts - lastBlinkActionAt > 500) {
    const lR = smooth.leftEar / Math.max(smooth.rightEar, 1e-6);
    const rR = smooth.rightEar / Math.max(smooth.leftEar, 1e-6);

    const leftIsWinking = leftClosedFrames >= 3 && smooth.rightEar > (bR * 0.85) && lR < 0.60;
    const rightIsWinking = rightClosedFrames >= 3 && smooth.leftEar > (bL * 0.85) && rR < 0.60;

    if (leftIsWinking && rightClosedFrames === 0) {
      winkReadyAt = ts + 600; sendAction("LEFT_WINK");
    } else if (rightIsWinking && leftClosedFrames === 0) {
      winkReadyAt = ts + 600; sendAction("RIGHT_WINK");
    }
  }
};

// ─── Hand gestures ────────────────────────────────────────────────────────

const detectHandGestures = (handResult, ts) => {
  if (!handResult?.landmarks?.length) {
    handTrace = [];
    pinchState = { frames: 0, active: false };
    fingerCountState = { twoFrames: 0, threeFrames: 0 };
    cursorMode = false;
    return;
  }

  const rawLm = handResult.landmarks[0];
  // Correct coordinates: Only mirror the X-axis for the visual preview.
  const lm = rawLm.map(p => ({ x: 1 - p.x, y: p.y, z: p.z }));

  const hc = handResult?.handednesses?.[0]?.[0]?.score ?? 0.5;
  smooth.handConfidence = smoothVal(smooth.handConfidence, hc, 0.25);
  if ((smooth.handConfidence ?? 0) < 0.22) return;

  const thumbTip = lm[4], indexTip = lm[8], middleTip = lm[12];
  const wrist = lm[0], indexMcp = lm[5], pinkyMcp = lm[17];

  // Dynamically calculate hand scale to make gestures distance-invariant
  baseline.handScale = smoothVal(baseline.handScale, euclidean(indexMcp, wrist), 0.12);
  smooth.wristX = smoothVal(smooth.wristX, wrist.x, 0.35);
  smooth.wristY = smoothVal(smooth.wristY, wrist.y, 0.35);
  if (smooth.wristX === null || smooth.wristY === null) return;

  handTrace.push({ x: smooth.wristX, y: smooth.wristY, t: ts });
  handTrace = handTrace.filter(p => ts - p.t < 280);
  if (handTrace.length < 3) return;

  const first = handTrace[0];
  const mid = handTrace[Math.floor(handTrace.length / 2)];
  const last = handTrace[handTrace.length - 1];

  const dx = last.x - first.x, dy = last.y - first.y;
  const dx2 = last.x - mid.x, dy2 = last.y - mid.y;
  const travel = Math.hypot(dx, dy);

  // Normalize distances relative to the user's hand size on camera
  const scale = baseline.handScale || 0.1;
  const ndx = dx / scale;
  const ndy = dy / scale;
  const ndx2 = dx2 / scale;
  const ndy2 = dy2 / scale;
  const ntravel = travel / scale;

  const ext = countExtendedFingers(lm);
  cursorMode = ext === 1;

  if (ts >= handMotionReadyAt) {
    // Left swipe: movement towards screen-left (negative ndx in normalized space)
    if (ndx < -1.2 && ndx2 < -0.6 && Math.abs(ndy) < 1.0 && Math.abs(ndy2) < 0.6) {
      handMotionReadyAt = ts + 580; handTrace = []; sendAction("HAND_SWIPE_L"); return;
    }
    // Right swipe: movement towards screen-right (positive ndx in normalized space)
    if (ndx > 1.2 && ndx2 > 0.6 && Math.abs(ndy) < 1.0 && Math.abs(ndy2) < 0.6) {
      handMotionReadyAt = ts + 580; handTrace = []; sendAction("HAND_SWIPE_R"); return;
    }
  }

  if (cursorMode) {
    // Standard mapping: move in screen coordinates
    const cdx = ndx * 80, cdy = ndy * 80;
    if (ts - lastCursorSendAt > 20 && (Math.abs(cdx) > 1.5 || Math.abs(cdy) > 1.5)) {
      lastCursorSendAt = ts; sendAction("CURSOR_MOVE", { dx: cdx, dy: cdy });
    }
  }

  // Stability check normalized to distance
  const stable = ntravel < 1.2 && Math.abs(ndx) < 0.8;
  fingerCountState.threeFrames = stable && ext === 3 ? fingerCountState.threeFrames + 1 : 0;
  fingerCountState.twoFrames = stable && ext === 2 ? fingerCountState.twoFrames + 1 : 0;

  if (ts >= handMotionReadyAt) {
    if (fingerCountState.threeFrames >= 2) {
      handMotionReadyAt = ts + 340;
      fingerCountState.threeFrames = fingerCountState.twoFrames = 0;
      sendAction("HAND_SCROLL_UP"); return;
    }
    if (fingerCountState.twoFrames >= 2) {
      handMotionReadyAt = ts + 340;
      fingerCountState.threeFrames = fingerCountState.twoFrames = 0;
      sendAction("HAND_SCROLL_DOWN"); return;
    }
  }

  const norm = Math.max(euclidean(indexMcp, pinkyMcp), scale, 1e-6);
  smooth.pinchRatio = smoothVal(smooth.pinchRatio, euclidean(thumbTip, indexTip) / norm, 0.32);
  const midRatio = euclidean(thumbTip, middleTip) / norm;
  const stHand = ntravel < 0.6;

  const likelyPinch =
    smooth.pinchRatio < 0.27 && midRatio > 0.36 && stHand &&
    Math.abs(ndx) < 0.5 && Math.abs(ndy) < 0.5;

  if (likelyPinch) {
    if (++pinchState.frames >= 2 && !pinchState.active) {
      pinchState.active = true; sendAction("HAND_PINCH");
    }
  } else {
    pinchState.frames = 0;
    if (smooth.pinchRatio !== null && smooth.pinchRatio > 0.42) pinchState.active = false;
  }
};

// ─── Overlay ──────────────────────────────────────────────────────────────

const drawOverlay = (faceResult, handResult) => {
  if (!drawOverlayEnabled || !ctx) return;
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  const pts = (arr, color, r = 1.7) => {
    ctx.fillStyle = color;
    for (const p of arr) {
      ctx.beginPath();
      ctx.arc(p.x * canvasEl.width, p.y * canvasEl.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (faceResult?.faceLandmarks?.length) {
    const f = faceResult.faceLandmarks[0];
    pts([33, 133, 159, 145, 158, 153, 160, 144, 263, 362, 386, 374, 385, 380, 387, 373].map(i => f[i]),
      "#3b82f6", 2.5);
  }
  if (handResult?.landmarks?.length) {
    const h = handResult.landmarks[0];
    const c = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11],
    [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]];
    pts(h, "#0f172a", 2);
    pts(c.map(([a, b]) => ({ x: (h[a].x + h[b].x) / 2, y: (h[a].y + h[b].y) / 2 })), "#64748b", 1.4);
  }
};

// ─── Main loop ────────────────────────────────────────────────────────────

const step = () => {
  if (!running || !faceLandmarker || !handRecognizer) return;
  const ts = now();
  frameCount++;
  lastHandResult = handRecognizer.recognizeForVideo(videoEl, ts);
  lastFaceResult = faceLandmarker.detectForVideo(videoEl, ts);
  if (lastHandResult) detectHandGestures(lastHandResult, ts);
  if (lastFaceResult) detectFaceGestures(lastFaceResult, ts);
  drawOverlay(lastFaceResult, lastHandResult);
  if (ts - calibrationStartedAt >= calibrateMs) setStatus("running");
  animationFrameId = requestAnimationFrame(step);
};

// ─── Engine + lifecycle ───────────────────────────────────────────────────

const createEngines = async () => {
  setStatus("loading models…");
  const vision = await FilesetResolver.forVisionTasks(chrome.runtime.getURL("wasm"));
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelUrls.face },
    runningMode: "VIDEO", numFaces: 1
  });
  handRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelUrls.hand },
    runningMode: "VIDEO", numHands: 1
  });
};

const resetState = () => {
  resetBlinkFSM();
  prevBothClosed = false;
  lastBlinkActionAt = 0;
  leftClosedFrames = rightClosedFrames = 0;
  winkReadyAt = 0;
  frameCount = 0;
  lastFaceResult = lastHandResult = null;
  handMotionReadyAt = 0;
  pinchState = { frames: 0, active: false };
  fingerCountState = { twoFrames: 0, threeFrames: 0 };
  cursorMode = false;
  lastCursorSendAt = 0;
  handTrace = [];
  baseline.leftOpenEar = baseline.rightOpenEar = baseline.handScale = null;
  smooth.leftEar = smooth.rightEar = smooth.wristX = smooth.wristY =
    smooth.pinchRatio = smooth.handConfidence = null;
};

const start = async () => {
  if (running) return;
  try {
    await createEngines();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    resetState();
    calibrationStartedAt = now();
    running = true;
    setStatus("calibrating… 3s");
    animationFrameId = requestAnimationFrame(step);
  } catch (err) {
    if (err.name === "NotAllowedError" || String(err).includes("Permission denied")) {
      setStatus("camera denied — grant permission");
      chrome.tabs.create({ url: chrome.runtime.getURL("src/controller.html") });
    } else {
      setStatus(`error: ${String(err)}`);
    }
  }
};

const stop = () => {
  running = false;
  cancelBlinkWindow();
  if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  setStatus("stopped");
};

startBtn?.addEventListener("click", start);
stopBtn?.addEventListener("click", stop);