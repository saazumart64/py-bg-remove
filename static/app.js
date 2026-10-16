const fileInput = document.querySelector("#image-input");
const dropZone = document.querySelector("#drop-zone");
const uploadContent = document.querySelector("#upload-content");
const previewContent = document.querySelector("#preview-content");
const previewImage = document.querySelector("#preview-image");
const fileName = document.querySelector("#file-name");
const removeButton = document.querySelector("#remove-button");
const buttonLabel = document.querySelector("#button-label");
const errorMessage = document.querySelector("#error-message");
const processingNote = document.querySelector("#processing-note");
const resultPanel = document.querySelector("#result-panel");
const resultImage = document.querySelector("#result-image");
const originalResultImage = document.querySelector("#original-result-image");
const resultPreview = document.querySelector("#result-preview");
const downloadButton = document.querySelector("#download-button");
const downloadLabel = document.querySelector("#download-label");
const backgroundColorInput = document.querySelector("#background-color");
const backgroundImageInput = document.querySelector("#background-image-input");
const clearBackgroundImageButton = document.querySelector("#clear-background-image");
let selectedFile = null;
let previewUrl = null;
let resultUrl = null;
let backgroundImageUrl = null;
let backgroundMode = "checker";

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = "";
}

function clearProcessingNote() {
  processingNote.hidden = true;
  processingNote.textContent = "";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function openFilePicker() {
  fileInput.value = "";
  fileInput.click();
}

function setBackgroundMode(mode) {
  backgroundMode = mode;
  resultPreview.classList.remove("background-white", "background-dark", "background-custom");
  resultPreview.style.backgroundImage = "";
  if (mode === "white") resultPreview.classList.add("background-white");
  if (mode === "dark") resultPreview.classList.add("background-dark");
  if (mode === "color") {
    resultPreview.classList.add("background-custom");
    resultPreview.style.backgroundColor = backgroundColorInput.value;
  } else {
    resultPreview.style.backgroundColor = "";
  }
  if (mode === "photo" && backgroundImageUrl) {
    resultPreview.style.backgroundImage = `url("${backgroundImageUrl}")`;
  }
  document.querySelectorAll(".swatch").forEach((item) => {
    const active = item.dataset.background === mode;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  downloadLabel.textContent = mode === "checker" ? "Download transparent PNG" : "Download image with background";
}

function setFile(file) {
  clearError();
  clearProcessingNote();
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showError("Please choose a JPG, PNG, or WebP image.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError("Images must be 10 MB or smaller.");
    return;
  }

  if (previewUrl) URL.revokeObjectURL(previewUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  downloadButton.removeAttribute("href");
  if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
  backgroundImageUrl = null;
  backgroundImageInput.value = "";
  clearBackgroundImageButton.hidden = true;
  setBackgroundMode("checker");
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  originalResultImage.src = previewUrl;
  fileName.textContent = file.name;
  uploadContent.hidden = true;
  previewContent.hidden = false;
  removeButton.disabled = false;
  resultPanel.hidden = true;
}

function reset() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  previewUrl = null;
  resultUrl = null;
  selectedFile = null;
  fileInput.value = "";
  previewImage.removeAttribute("src");
  resultImage.removeAttribute("src");
  originalResultImage.removeAttribute("src");
  resultPreview.classList.remove("background-white", "background-dark");
  resultPreview.style.backgroundImage = "";
  resultPreview.style.backgroundColor = "";
  if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
  backgroundImageUrl = null;
  backgroundImageInput.value = "";
  clearBackgroundImageButton.hidden = true;
  setBackgroundMode("checker");
  uploadContent.hidden = false;
  previewContent.hidden = true;
  resultPanel.hidden = true;
  removeButton.disabled = true;
  clearError();
  clearProcessingNote();
}

document.querySelector("#change-button").addEventListener("click", openFilePicker);
document.querySelector("#start-over-button").addEventListener("click", reset);
document.querySelectorAll(".swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => setBackgroundMode(swatch.dataset.background));
});
fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
backgroundColorInput.addEventListener("input", () => setBackgroundMode("color"));
backgroundImageInput.addEventListener("change", () => {
  const file = backgroundImageInput.files[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    showError("Choose a JPG, PNG, or WebP background image up to 10 MB.");
    backgroundImageInput.value = "";
    return;
  }
  clearError();
  if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
  backgroundImageUrl = URL.createObjectURL(file);
  clearBackgroundImageButton.hidden = false;
  setBackgroundMode("photo");
});
clearBackgroundImageButton.addEventListener("click", () => {
  if (backgroundImageUrl) URL.revokeObjectURL(backgroundImageUrl);
  backgroundImageUrl = null;
  backgroundImageInput.value = "";
  clearBackgroundImageButton.hidden = true;
  setBackgroundMode("checker");
});

uploadContent.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openFilePicker();
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  setFile(event.dataTransfer.files[0]);
});

removeButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  clearError();
  clearProcessingNote();
  removeButton.disabled = true;
  removeButton.classList.add("loading");
  buttonLabel.textContent = "Starting…";
  processingNote.textContent = "Starting the AI model. The first run may take a little longer while model files are downloaded.";
  processingNote.hidden = false;
  const progressTimer = window.setTimeout(() => {
    buttonLabel.textContent = "Removing background…";
    processingNote.textContent = "The AI is working on your image. Keep this page open; processing time depends on image size and computer speed.";
  }, 8000);
  const formData = new FormData();
  formData.append("image", selectedFile);
  const controller = new AbortController();
  const timeoutTimer = window.setTimeout(() => controller.abort(), 180000);

  try {
    const response = await fetch("/api/remove", { method: "POST", body: formData, signal: controller.signal });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || "The image could not be processed. Please try again.");
    }

    const resultBlob = await response.blob();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(resultBlob);
    resultImage.src = resultUrl;
    downloadButton.href = resultUrl;
    resultPanel.hidden = false;
    setBackgroundMode(backgroundMode);
    clearProcessingNote();
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      showError("No response arrived within 3 minutes. The server may still be working. Restart the app before trying again, and use a smaller image if needed.");
    } else {
      showError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  } finally {
    window.clearTimeout(progressTimer);
    window.clearTimeout(timeoutTimer);
    clearProcessingNote();
    removeButton.disabled = !selectedFile;
    removeButton.classList.remove("loading");
    buttonLabel.textContent = "Remove background";
  }
});

downloadButton.addEventListener("click", async () => {
  if (!resultImage.complete || !resultImage.naturalWidth) {
    showError("Your result is still loading. Please try again in a moment.");
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = resultImage.naturalWidth;
  canvas.height = resultImage.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    showError("Your browser could not prepare the download.");
    return;
  }

  if (backgroundMode === "white") context.fillStyle = "#ffffff";
  if (backgroundMode === "dark") context.fillStyle = "#293247";
  if (backgroundMode === "color") context.fillStyle = backgroundColorInput.value;
  if (["white", "dark", "color"].includes(backgroundMode)) {
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else if (backgroundMode === "photo" && backgroundImageUrl) {
    const background = new Image();
    background.src = backgroundImageUrl;
    try {
      await background.decode();
    } catch {
      showError("The selected background photo could not be loaded.");
      return;
    }
    const scale = Math.max(canvas.width / background.naturalWidth, canvas.height / background.naturalHeight);
    const width = background.naturalWidth * scale;
    const height = background.naturalHeight * scale;
    context.drawImage(background, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  }
  context.drawImage(resultImage, 0, 0);

  const hasBackground = backgroundMode !== "checker";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, hasBackground ? "image/jpeg" : "image/png", 0.94));
  if (!blob) {
    showError("Your browser could not create the download. Please try again.");
    return;
  }
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = hasBackground ? "cleancut-image.jpg" : "cleancut-cutout.png";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
});
