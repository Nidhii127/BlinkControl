import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "models");
const wasmOutDir = path.join(root, "public", "wasm");
const wasmSourceDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");

const files = [
  {
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    name: "face_landmarker.task"
  },
  {
    url: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
    name: "gesture_recognizer.task"
  }
];

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(wasmOutDir, { recursive: true });

for (const file of files) {
  const dest = path.join(outDir, file.name);
  try {
    await fs.access(dest);
    continue;
  } catch {
    // File does not exist yet.
  }

  const res = await fetch(file.url);
  if (!res.ok) {
    throw new Error(`Failed download ${file.url}: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  process.stdout.write(`Saved ${file.name}\n`);
}

const wasmFiles = await fs.readdir(wasmSourceDir);
for (const wasmFile of wasmFiles) {
  const src = path.join(wasmSourceDir, wasmFile);
  const dest = path.join(wasmOutDir, wasmFile);
  const buf = await fs.readFile(src);
  await fs.writeFile(dest, buf);
}
process.stdout.write("Copied MediaPipe wasm runtime files\n");
