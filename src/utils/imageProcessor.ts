/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper to calculate color distance
function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(c1[0] - c2[0], 2) +
    Math.pow(c1[1] - c2[1], 2) +
    Math.pow(c1[2] - c2[2], 2)
  );
}

// Convert rgb array to hex string
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

// Convert hex string to rgb array
export function hexToRgb(hex: string): [number, number, number] {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [0, 0, 0];
}

// Game Boy classic palette shades (R, G, B)
const GAMEBOY_PALETTE: [number, number, number][] = [
  [15, 56, 15],     // Darkest green
  [48, 98, 48],     // Dark green
  [139, 172, 15],   // Light green
  [155, 188, 15]    // Lightest green
];

// NES classic palette sample
const NES_PALETTE: [number, number, number][] = [
  [248, 56, 0],     // Red
  [252, 160, 68],   // Orange
  [248, 184, 0],    // Yellow
  [0, 168, 0],      // Green
  [0, 120, 248],    // Blue
  [248, 120, 248],  // Pink
  [252, 252, 252],  // White
  [0, 0, 0]         // Black
];

/**
 * Perform K-Means clustering on pixel colors to extract a dominant palette.
 */
function quantizeColors(pixels: [number, number, number][], k: number): [number, number, number][] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels;

  // Initialize centroids with a spread
  let centroids: [number, number, number][] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[i * step]]);
  }

  const maxIterations = 10;
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to closest centroid
    const clusters: [number, number, number][][] = Array.from({ length: k }, () => []);
    for (const pixel of pixels) {
      let minDist = Infinity;
      let closestIdx = 0;
      for (let c = 0; c < k; c++) {
        const dist = colorDistance(pixel, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = c;
        }
      }
      clusters[closestIdx].push(pixel);
    }

    // Calculate new centroids
    let changed = false;
    for (let c = 0; c < k; c++) {
      const cluster = clusters[c];
      if (cluster.length === 0) continue;

      const sum = cluster.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
      const newCentroid: [number, number, number] = [
        Math.round(sum[0] / cluster.length),
        Math.round(sum[1] / cluster.length),
        Math.round(sum[2] / cluster.length)
      ];

      if (colorDistance(centroids[c], newCentroid) > 1) {
        centroids[c] = newCentroid;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return centroids;
}

/**
 * Process a source image:
 * 1. Remove background based on chroma key (or hex value) and tolerance.
 * 2. Pixelate to a lower resolution grid (e.g. 32x32, 64x64, 128x128).
 * 3. Quantize non-transparent colors to simulate SNES/Sega palette restrictions.
 */
export function processSpriteImage(
  imgSrc: string,
  bgColorKey: string, // 'magenta' | 'green' | 'blue' | 'black' | 'white'
  pixelSize: number,  // Grid size: 32, 64, 128, or 0 (original)
  colorLimit: number, // Max colors: 4, 8, 15, 16, 32 or 0 (unlimited)
  tolerance: number   // 0 - 100
): Promise<{ processedUrl: string; palette: string[] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Create offscreen canvas for rendering
      const size = 512; // Standard work resolution
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create 2D canvas context"));
        return;
      }

      // 1. Draw original image to fit canvas
      ctx.drawImage(img, 0, 0, size, size);
      let imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      // Define chroma key RGB based on selection
      let keyColor: [number, number, number] = [255, 0, 255]; // Magenta default
      if (bgColorKey === "green") keyColor = [0, 255, 0];
      else if (bgColorKey === "blue") keyColor = [0, 0, 255];
      else if (bgColorKey === "black") keyColor = [0, 0, 0];
      else if (bgColorKey === "white") keyColor = [255, 255, 255];

      // Convert slider tolerance to a distance threshold (max Euclidean distance in RGB is ~441.67)
      // We scale tolerance (0-100) to map to RGB distance threshold (0-250)
      const threshold = (tolerance / 100) * 250;

      // 2. Perform Chroma Key background removal
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dist = colorDistance([r, g, b], keyColor);
        if (dist <= threshold) {
          data[i + 3] = 0; // Make pixel completely transparent
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // 3. Downsample if pixelSize is enabled (e.g., 32, 64, 128)
      if (pixelSize > 0) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = pixelSize;
        tempCanvas.height = pixelSize;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          // Draw transparent/chromakey image onto low-res canvas
          tempCtx.drawImage(canvas, 0, 0, pixelSize, pixelSize);
          
          // Clear main canvas, turn off image smoothing, and scale it back up
          ctx.clearRect(0, 0, size, size);
          ctx.imageSmoothingEnabled = false;
          // In some modern browsers:
          (ctx as any).mozImageSmoothingEnabled = false;
          (ctx as any).webkitImageSmoothingEnabled = false;
          (ctx as any).msImageSmoothingEnabled = false;

          ctx.drawImage(tempCanvas, 0, 0, pixelSize, pixelSize, 0, 0, size, size);
          imgData = ctx.getImageData(0, 0, size, size);
        }
      }

      // 4. Color Quantization / Palette Limiting
      const finalData = imgData.data;
      const nonTransPixels: [number, number, number][] = [];

      // Collect colors from all visible pixels
      for (let i = 0; i < finalData.length; i += 4) {
        if (finalData[i + 3] > 128) { // Only count highly opaque pixels
          nonTransPixels.push([finalData[i], finalData[i + 1], finalData[i + 2]]);
        }
      }

      let paletteHex: string[] = [];

      if (colorLimit > 0 && nonTransPixels.length > 0) {
        let quantizedPalette: [number, number, number][] = [];

        if (colorLimit === 4) {
          // Game Boy Classic green shades
          quantizedPalette = GAMEBOY_PALETTE;
        } else if (colorLimit === 8) {
          // NES classic sample palette
          quantizedPalette = NES_PALETTE;
        } else {
          // Dynamic K-Means quantization based on character colors (perfect for SNES 16-color or Mega Drive 15-color)
          quantizedPalette = quantizeColors(nonTransPixels, colorLimit);
        }

        // Map every pixel to closest color in palette
        for (let i = 0; i < finalData.length; i += 4) {
          if (finalData[i + 3] > 128) {
            const r = finalData[i];
            const g = finalData[i + 1];
            const b = finalData[i + 2];

            let minDist = Infinity;
            let closestColor = quantizedPalette[0] || [0,0,0];

            for (const color of quantizedPalette) {
              const dist = colorDistance([r, g, b], color);
              if (dist < minDist) {
                minDist = dist;
                closestColor = color;
              }
            }

            finalData[i] = closestColor[0];
            finalData[i + 1] = closestColor[1];
            finalData[i + 2] = closestColor[2];
            finalData[i + 3] = 255; // Ensure pixel is fully solid if not transparent
          } else {
            finalData[i + 3] = 0; // Ensure fully transparent
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Populate hex palette for output
        paletteHex = quantizedPalette.map(([r, g, b]) => rgbToHex(r, g, b));
      } else {
        // Extract top unique colors for display
        const uniqueColorsMap = new Map<string, number>();
        for (const [r, g, b] of nonTransPixels) {
          const hex = rgbToHex(r, g, b);
          uniqueColorsMap.set(hex, (uniqueColorsMap.get(hex) || 0) + 1);
        }
        
        // Sort unique colors by frequency and slice to top 32
        paletteHex = Array.from(uniqueColorsMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 32)
          .map(([hex]) => hex);
      }

      // Resolve processed data URL and extracted palette
      resolve({
        processedUrl: canvas.toDataURL("image/png"),
        palette: paletteHex
      });
    };

    img.onerror = (err) => {
      reject(err);
    };

    img.src = imgSrc;
  });
}

/**
 * Stitch frames side-by-side into a beautiful PNG spritesheet.
 */
export function stitchSpritesheet(
  frames: string[], // List of processed frame data URLs (base64)
  columns: number,
  frameSize: number = 64 // Each frame's size in pixels
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (frames.length === 0) {
      resolve("");
      return;
    }

    const rows = Math.ceil(frames.length / columns);
    const canvas = document.createElement("canvas");
    canvas.width = columns * frameSize;
    canvas.height = rows * frameSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not create 2D canvas context for spritesheet"));
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let loadedCount = 0;
    const loadedImages: HTMLImageElement[] = Array.from({ length: frames.length });

    frames.forEach((frameSrc, index) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        loadedImages[index] = img;
        loadedCount++;

        if (loadedCount === frames.length) {
          // Draw all frames onto the spritesheet grid
          ctx.imageSmoothingEnabled = false;
          loadedImages.forEach((frameImg, fIdx) => {
            const col = fIdx % columns;
            const row = Math.floor(fIdx / columns);
            
            ctx.drawImage(
              frameImg,
              0, 0, frameImg.width, frameImg.height, // Source
              col * frameSize, row * frameSize, frameSize, frameSize // Destination
            );
          });

          resolve(canvas.toDataURL("image/png"));
        }
      };
      img.onerror = () => {
        reject(new Error(`Failed to load frame at index ${index}`));
      };
      img.src = frameSrc;
    });
  });
}
