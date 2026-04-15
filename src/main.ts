import { generateMSDF } from "three-msdf-text-utils";
import type { Font } from "three/examples/jsm/Addons.js";
import * as THREE from "three/webgpu";

// --- UI refs ---
const dropzone = document.getElementById("dropzone") as HTMLDivElement;
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;
const progressBar = document.getElementById("progressBar") as HTMLDivElement;
const progressText = document.getElementById("progressText") as HTMLSpanElement;
const status = document.getElementById("status") as HTMLParagraphElement;
const downloadSection = document.getElementById("downloads") as HTMLDivElement;
const previewContainer = document.getElementById(
  "previewContainer",
) as HTMLDivElement;
const charsetInput = document.getElementById(
  "charsetInput",
) as HTMLTextAreaElement;

// --- State ---
let currentFile: File | null = null;
let isProcessing = false;

// --- Helpers: read config ---
function getCharset(): string {
  return charsetInput.value;
}

function getFontSize(): number {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="fontSize"]:checked',
  );
  return checked ? parseInt(checked.value, 10) : 64;
}

function getTextureSize(): number {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="textureSize"]:checked',
  );
  return checked ? parseInt(checked.value, 10) : 512;
}

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
  if (file) selectFile(file);
});

dropzone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) selectFile(file);
});

// --- File selection (no generation yet) ---
function selectFile(file: File) {
  if (!file.name.endsWith(".ttf")) {
    setStatus("❌ Only .ttf files are supported", "error");
    return;
  }

  currentFile = file;
  dropzone.classList.add("has-file");

  // Update dropzone label to show filename
  const label = dropzone.querySelector(".dropzone__label")!;
  label.innerHTML = `<span class="dropzone__filename">📁 ${file.name}</span>`;

  generateBtn.disabled = false;
  setStatus("", "info");
  showProgress(0);
  downloadSection.innerHTML = "";
}

// --- Generate button ---
generateBtn.addEventListener("click", () => {
  if (currentFile) handleGenerate(currentFile);
});

// --- Core generation logic ---
async function handleGenerate(file: File) {
  if (isProcessing) return;
  isProcessing = true;

  const fontUrl = URL.createObjectURL(file);
  const baseName = file.name.replace(/\.ttf$/i, "");

  setStatus(`⚙️ Generating atlas for "${file.name}"…`, "info");
  showProgress(0);
  downloadSection.innerHTML = "";
  generateBtn.disabled = true;
  generateBtn.classList.add("loading");
  (
    generateBtn.querySelector(".generate-btn__label") as HTMLElement
  ).textContent = "Generating…";

  const charset = getCharset();
  const fontSize = getFontSize();
  const texSize = getTextureSize();

  console.log(file);

  try {
    const base = import.meta.env.BASE_URL;

    const { font, atlas } = await generateMSDF(fontUrl as unknown as File, {
      workerUrl: `${base}msdfgen/worker.bundled.js`,
      wasmUrl: `${base}msdfgen/msdfgen.wasm`,
      charset,
      fontSize,
      textureSize: [texSize, texSize],
      fieldRange: 4,
      fixOverlaps: true,
      onProgress: (progress: number) => {
        showProgress(progress);
      },
    });

    showProgress(100);
    setStatus("✅ Generation complete!", "success");

    downloadAtlasTexture(
      atlas as unknown as THREE.Texture,
      baseName,
      (pngFilename) => {
        // Only create the JSON download once we have the png filename
        downloadFontData(font, baseName, pngFilename);
      },
    );
  } catch (err) {
    console.error(err);
    setStatus(`❌ Error: ${(err as Error).message}`, "error");
  } finally {
    URL.revokeObjectURL(fontUrl);
    isProcessing = false;
    generateBtn.disabled = false;
    generateBtn.classList.remove("loading");
    (
      generateBtn.querySelector(".generate-btn__label") as HTMLElement
    ).textContent = "Generate Atlas";
  }
}

// --- Downloads ---
function downloadFontData(font: Font, baseName: string, pngFilename: string) {
  // Deep-clone font.data and replace the pages array (which contains data URIs)
  // with just the png filename so the JSON references the texture by name.
  const data = JSON.parse(JSON.stringify(font.data));
  if (Array.isArray(data.pages)) {
    data.pages = [pngFilename];
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  createDownloadButton(blob, `${baseName}.fnt.json`, "📄 Download .fnt (JSON)");
}

function downloadAtlasTexture(
  atlas: THREE.Texture,
  baseName: string,
  onReady: (pngFilename: string) => void,
) {
  const pngFilename = `${baseName}.png`;
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

    createDownloadButton(blob, pngFilename, "🖼️ Download atlas (.png)");

    // Atlas preview in the right panel
    const objectUrl = URL.createObjectURL(blob);
    previewContainer.innerHTML = "";
    previewContainer.classList.remove("preview-placeholder");

    const img = document.createElement("img");
    img.src = objectUrl;
    img.className = "atlas-preview";
    img.title = "MSDF atlas preview";
    previewContainer.appendChild(img);

    // Notify caller so it can build the JSON with the correct filename
    onReady(pngFilename);
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

// --- UI helpers ---
function showProgress(value: number) {
  progressBar.style.width = `${value}%`;
  progressText.textContent = `${Math.round(value)}%`;
}

function setStatus(msg: string, type: "info" | "success" | "error") {
  status.textContent = msg;
  status.className = `status status--${type}`;
}
