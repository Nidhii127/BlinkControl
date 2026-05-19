# BlinkControl: Research Paper Notes & Content

This document outlines key points, supported features, future scope, and references based on the BlinkControl codebase. You can directly incorporate these sections into your research paper chapters.

## 1. Supported Features & Current Capabilities

*   **Multimodal Local AI Tracking:** Utilizes Google's MediaPipe framework (FaceLandmarker and GestureRecognizer) running entirely local (WASM) inside the browser, eliminating network latency and preserving user privacy.
*   **Adaptive Eye Tracking & Blink Sequences:** 
    *   Calculates Eye Aspect Ratio (EAR) dynamically using 3D facial landmarks.
    *   Implements an **Adaptive Baseline Calibration** phase (first ~2.5 seconds) to learn the user's specific "open eye" and "rest hand scale" metrics.
    *   Supports complex temporal sequences: Double Blinks (New Tab), Long Blinks (Reload), and Asymmetric Winks (Switch Tabs).
*   **Dynamic Hand Gesture Recognition:** 
    *   Recognizes varied kinematics: Swipe Left/Right (Navigation), Pinch-to-Click (Selection), and Scroll Up/Down controlled by finger counts (2 vs 3 fingers).
*   **Noise Reduction & Signal Processing:** 
    *   To counteract webcam jitter, the system uses an Exponential Moving Average (EMA) mathematical smoothing on coordinate tracking (`smoothValue` parameters).
    *   Employs adaptive hysteresis in state classification—the threshold to register an eye as "closed" dynamically sits at 62% of the user's open baseline, naturally dampening false-positive flutters.

## 2. Future Scope & System Tuning

You can expand upon these points in your "Future Work" or "Discussion" sections, specifically addressing inclusivity and robustness.

### Platform Portability
*   **Expansion Beyond Web:** Currently packaged as a browser-based Javascript system (Chrome API), the core logic can be refactored into Electron.js or Tauri to act as a system-wide OS accessibility daemon replacing the physical mouse entirely.
*   **Mobile Intégration:** Adopting the logic for iOS/Android native services to allow touchless navigation for physically impaired mobile users.

### Demographic & Morphological Robustness (Inclusivity)
*   **Addressing Morphological Variance (e.g., Asian/Chinese vs. Caucasian eye structures):** The current Adaptive Baseline somewhat mitigates the effect of epicanthic folds or natively flatter eye geometries because it calculates a *relative percentage* drop (62% of nominal baseline) rather than a rigid absolute number. However, future improvements should dynamically weight the vertical and horizontal scalar vectors depending on initial face mesh ratios to completely negate morphological bias.
*   **Melanin & Skin Tone Variance (e.g., African demographics):** RGB camera–based hand tracking algorithms conventionally struggle with darker skin tones in low contrast situations. Future scope involves:
    *   Implementing **adaptive contrast enhancement** as a preprocessing step.
    *   Fusing data with **Infrared (IR) / Depth mapping cameras** (such as FaceID sensors) to track geometry strictly by depth mapping, entirely bypassing skin reflection or melanin differences, ensuring 100% equity across all human demographics.

### Illumination & Lighting Robustness
*   **Current Limitations:** Heavy backlighting or extreme low-light environments (nighttime use) degrades MediaPipe's confidence score, heavily shifting coordinates.
*   **Future Mitigation:** Applying real-time Histogram Equalization or Gamma Correction to the video stream locally *before* feeding frames to the machine learning model.

## 3. Academic References for Your Paper

Here are standard references in the field of computer vision and human-computer interaction that align with the mechanisms used in your project:

1.  **Eye Aspect Ratio (EAR) Foundation:** 
    *   Soukupová, T., & Čech, J. (2016). *Real-Time Eye Blink Detection using Facial Landmarks.* 21st Computer Vision Winter Workshop (CVWW2016). 
    *   *(Context: Cite this when explaining how your code mathematically detects blinks using `euclidean` distances across vertical and horizontal landmark pairs).*
2.  **Core Framework used (MediaPipe):**
    *   Lugaresi, C., et al. (2019). *MediaPipe: A Framework for Building Perception Pipelines.* arXiv preprint arXiv:1906.08172. 
    *   *(Context: Cite this when detailing your system's inference engine and WASM implementation).*
3.  **Algorithmic Bias and Inclusivity:** 
    *   Buolamwini, J., & Gebru, T. (2018). *Gender Shades: Intersectional Accuracy Disparities in Commercial Gender Classification.* Proceedings of the 1st Conference on Fairness, Accountability and Transparency. 
    *   *(Context: Cite this when discussing the "Future Scope" on tuning algorithms to be robust across different skin tones and eye morphologies).*
4.  **Robust Lighting in Gesture Recognition:** 
    *   Zhang, X., et al. (2017). *Robust Hand Gesture Recognition in Varying Illumination Conditions using Adaptive Skin Models.* 
    *   *(Context: Use this as reference for your Future Scope regarding real-time gamma correction and illumination invariant tracking).*
