/**
 * Hash canvas visual data (pixels) for consistent verification
 * This method hashes the raw pixel data, not PNG bytes
 */
export async function hashCanvasImageData(canvas: HTMLCanvasElement): Promise<string> {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Cannot get 2D context from canvas");
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const uint8Array = imageData.data;
  const wordArray = CryptoJS.lib.WordArray.create(uint8Array);
  const hash = CryptoJS.SHA256(wordArray).toString();
  return `0x${hash}`;
}

/**
 * Hash image from File/Blob by loading as canvas
 * This extracts pixel data and hashes it, independent of PNG encoding
 */
export async function hashImageAsPixels(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Cannot get 2D context from canvas");
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const uint8Array = imageData.data;
        const wordArray = CryptoJS.lib.WordArray.create(uint8Array);
        const hash = CryptoJS.SHA256(wordArray).toString();
        
        URL.revokeObjectURL(url);
        resolve(`0x${hash}`);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
import CryptoJS from "crypto-js";

/**
 * Hash image blob bytes (not dataUrl) to ensure same image always produces same hash
 * This is critical for certificate verification to work correctly
 */
export async function hashImageBlob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const wordArray = CryptoJS.lib.WordArray.create(uint8Array);
  const hash = CryptoJS.SHA256(wordArray).toString();
  return `0x${hash}`;
}

/**
 * Convert dataUrl to blob and hash it
 */
export async function hashImageFromDataUrl(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return hashImageBlob(blob);
}

/**
 * Convert dataUrl to Blob (helper function)
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(",");
  const mimeType = header?.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binaryString = atob(base64Data || "");
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}
