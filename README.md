# BlinkControl Local AI (Chrome Extension)

Control Chrome with local hand and eye gestures using your laptop/PC camera.

## Gesture Mapping

- Hand Scroll Up -> Scroll Up
- Hand Scroll Down -> Scroll Down
- Hand Swipe L -> Navigate Back
- Hand Swipe R -> Navigate Forward
- Hand Pinch -> Click
- Single Blink -> Click
- Double Blink -> New Tab
- Triple Blink -> Close Tab
- Long Blink -> Reload
- Left Wink -> Prev Tab
- Right Wink -> Next Tab

## Privacy and Security

- Inference runs locally in browser JavaScript with MediaPipe Tasks.
- No camera frames are uploaded by this extension.
- Camera permission is requested by browser prompt when user clicks start.
- Manifest V3 is used, with minimal permissions for tab and scripting actions.
- Models and wasm runtime are packaged into the extension at build time.

## Run

1. Install dependencies:
   - `npm install`
2. Build extension:
   - `npm run build`
   - This downloads model files once and bundles them locally in `dist`.
3. Open `chrome://extensions`
4. Enable **Developer mode**
5. Click **Load unpacked**
6. Select the generated `dist` folder
7. Click the extension icon -> **Open Controller** -> **Start Camera + AI**

## Cross-Platform Notes

- Works on Windows/macOS/Linux wherever Chrome supports MV3.
- Camera behavior depends on OS camera privacy settings and browser permissions.

## Research Add-ons for IEEE Paper

Add these measurable components to strengthen publication quality:

1. Latency profiling:
   - Report end-to-end latency (capture -> inference -> action) with p50/p95.
2. Fairness and demographic robustness:
   - Balanced test cohorts and report per-group accuracy/F1/EER.
3. Illumination robustness:
   - Evaluate low light, back light, strong white light, and mixed indoor light.
4. Background robustness:
   - Test cluttered vs plain backgrounds and moving objects in background.
5. Skin tone and eye-shape inclusivity:
   - Track subgroup performance and threshold calibration drift.
6. Pose and occlusion:
   - Evaluate with glasses, masks, head rotation, and partial face visibility.
7. User adaptation:
   - Add optional per-user calibration and compare with global thresholds.
8. False trigger safety:
   - Report false positives/hour and recovery strategy.
9. Power and CPU cost:
   - Measure CPU/GPU usage, thermal impact, and battery drain.
10. Dataset protocol:
   - Publish collection protocol, splits, label quality checks, and ethics process.

## Current Implementation Limitations

- Thresholds are heuristic and may require per-user tuning.
- Click action targets current viewport center for safety and consistency.
