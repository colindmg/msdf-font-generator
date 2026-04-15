import { generateMSDF } from "three-msdf-text-utils";
import type { Font } from "three/examples/jsm/Addons.js";
import * as THREE from "three/webgpu";

// --- UI refs ---
const dropzone = document.getElementById("dropzone") as HTMLDivElement;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const progressBar = document.getElementById("progressBar") as HTMLDivElement;
const progressText = document.getElementById("progressText") as HTMLSpanElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const downloadSection = document.getElementById("downloads") as HTMLDivElement;
const previewContainer = document.getElementById(
  "previewContainer",
) as HTMLDivElement;

// --- State ---
let isProcessing = false;

// --- Drag & Drop ---
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("drag-over");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
});

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

// --- Core logic ---
async function handleFile(file: File) {
  if (!file.name.endsWith(".ttf")) {
    setStatus("❌ Seuls les fichiers .ttf sont supportés", "error");
    return;
  }
  if (isProcessing) return;
  isProcessing = true;

  const fontUrl = URL.createObjectURL(file);

  setStatus(`⚙️ Génération en cours pour "${file.name}"...`, "info");
  showProgress(0);
  downloadSection.innerHTML = "";

  try {
    const { font, atlas } = await generateMSDF(fontUrl, {
      workerUrl: "/msdfgen/worker.bundled.js",
      wasmUrl: "/msdfgen/msdfgen.wasm",
      charset:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzéàèêâù0123456789.,!?:;'\"-()[]{}@#$%&*+=/<>\\| ",
      fontSize: 64,
      textureSize: [512, 512],
      fieldRange: 4,
      fixOverlaps: true,
      onProgress: (progress: number) => {
        showProgress(progress);
      },
    });

    showProgress(100);
    setStatus("✅ Génération terminée !", "success");

    downloadFontData(font, file.name);
    downloadAtlasTexture(atlas as unknown as THREE.Texture, file.name);
  } catch (err) {
    console.error(err);
    setStatus(`❌ Erreur : ${(err as Error).message}`, "error");
  } finally {
    URL.revokeObjectURL(fontUrl);
    isProcessing = false;
  }
}

function downloadFontData(font: Font, originalName: string) {
  const baseName = originalName.replace(/\.ttf$/i, "");
  const json = JSON.stringify(font.data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  createDownloadButton(
    blob,
    `${baseName}.fnt.json`,
    "📄 Télécharger le .fnt (JSON)",
  );
}

function downloadAtlasTexture(atlas: THREE.Texture, originalName: string) {
  const baseName = originalName.replace(/\.ttf$/i, "");
  const image = atlas.image as HTMLImageElement | HTMLCanvasElement;

  let canvas: HTMLCanvasElement;
  if (image instanceof HTMLCanvasElement) {
    canvas = image;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = image.width || 512;
    canvas.height = image.height || 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    createDownloadButton(
      blob,
      `${baseName}.png`,
      "🖼️ Télécharger l'atlas (.png)",
    );

    // Inject atlas preview in the right panel
    const objectUrl = URL.createObjectURL(blob);
    previewContainer.innerHTML = "";
    previewContainer.classList.remove("preview-placeholder");

    const img = document.createElement("img");
    img.src = objectUrl;
    img.className = "atlas-preview";
    img.title = "Aperçu de l'atlas MSDF";
    previewContainer.appendChild(img);
  }, "image/png");
}

function createDownloadButton(blob: Blob, filename: string, label: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.className = "download-btn";
  a.textContent = label;
  a.addEventListener("click", () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  downloadSection.appendChild(a);
}

function showProgress(value: number) {
  progressBar.style.width = `${value}%`;
  progressText.textContent = `${Math.round(value)}%`;
}

function setStatus(msg: string, type: "info" | "success" | "error") {
  status.textContent = msg;
  status.className = `status status--${type}`;
}
