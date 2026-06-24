export interface SpriteFrame {
  id: string;
  name: string;
  originalUrl: string; // Original generated URL (base64)
  processedUrl: string; // Transparent, pixelated URL (base64)
  prompt: string;
  style: 'snes' | 'genesis' | 'arcade';
  pose: string;
  bgColor: string; // 'magenta' | 'green' | 'blue' | 'black' | 'white'
  pixelSize: number; // Downsampling level (1 = none, 2 = 32x32, 4 = 64x64, etc.)
  colorLimit: number; // Restrict color count (0 = unlimited, 4 = GameBoy, 8 = NES, 15 = Genesis, 16 = SNES, 32 = Arcade)
  tolerance: number; // Transparency color similarity key tolerance (0 - 100)
}

export interface Spritesheet {
  name: string;
  frames: SpriteFrame[];
  columns: number; // Number of columns in the final spritesheet grid
}

export type PresetPalette = 'original' | 'snes' | 'genesis' | 'nes' | 'gameboy';
