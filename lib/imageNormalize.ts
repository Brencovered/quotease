// Shared canvas draw step - re-rasterizes whatever the browser can decode
// into a format pdf-lib and Claude's vision API can both actually use.
async function rasterize(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("Could not process this image in your browser."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "Your browser couldn't open this image format (likely HEIC from an iPhone). Try saving it as JPEG/PNG first, or take a screenshot of it."
        )
      );
    };
    img.src = url;
  });
}

// Claude's vision API only accepts JPEG/PNG/GIF/WebP - phone photos are
// very often HEIC (the iPhone default), which gets rejected outright.
// Re-drawing onto a canvas and exporting as JPEG sidesteps this for any
// format the browser itself can decode. PDFs pass through untouched, since
// they go through Claude's separate "document" content type, not "image".
export async function normalizeForAnalysis(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  const canvas = await rasterize(file);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not convert this image."));
          return;
        }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

// pdf-lib (used to generate quote PDFs) only supports embedding PNG and
// JPEG - notably not WebP, which is what a lot of phones/screenshot tools
// save as by default now. Converting logo uploads to PNG here means the
// PDF generator never has to silently drop a logo it can't embed.
export async function normalizeToPng(file: File): Promise<File> {
  const canvas = await rasterize(file);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not convert this image."));
          return;
        }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" }));
      },
      "image/png"
    );
  });
}
