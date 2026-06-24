/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Download, 
  Trash2, 
  Plus, 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  Palette, 
  FileImage, 
  Info, 
  ArrowLeft, 
  ArrowRight, 
  Copy, 
  Eraser, 
  Paintbrush, 
  Layers, 
  Cpu, 
  Flame 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpriteFrame, Spritesheet, PresetPalette } from './types';
import { processSpriteImage, stitchSpritesheet, hexToRgb, rgbToHex } from './utils/imageProcessor';
import { CHARACTER_PRESETS, POSE_PRESETS, BG_COLORS } from './utils/presets';

export default function App() {
  // Generator State
  const [prompt, setPrompt] = useState(CHARACTER_PRESETS[0].prompt);
  const [style, setStyle] = useState<'snes' | 'genesis' | 'arcade'>('snes');
  const [pose, setPose] = useState('idle');
  const [bgColor, setBgColor] = useState<'magenta' | 'green' | 'blue' | 'black' | 'white'>('magenta');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Workspace Sprite
  const [activeOriginalUrl, setActiveOriginalUrl] = useState<string>('');
  const [activeProcessedUrl, setActiveProcessedUrl] = useState<string>('');
  const [extractedPalette, setExtractedPalette] = useState<string[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);

  // Processing Parameters
  const [pixelSize, setPixelSize] = useState<number>(64); // 32, 64, 128, or 0 (original)
  const [colorLimit, setColorLimit] = useState<number>(16); // 4, 8, 15, 16, 32 or 0 (original)
  const [tolerance, setTolerance] = useState<number>(30); // 0 - 100 chroma tolerance

  // Manual Paint/Eraser Editor State
  const [editorTool, setEditorTool] = useState<'brush' | 'eraser'>('brush');
  const [selectedPaintColor, setSelectedPaintColor] = useState<string>('#FFFFFF');
  const [isDrawing, setIsDrawing] = useState(false);

  // Spritesheet Frame Builder State
  const [spritesheet, setSpritesheet] = useState<Spritesheet>({
    name: 'retro_character',
    frames: [],
    columns: 4
  });
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  // Animation Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationFps, setAnimationFps] = useState(6);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackScale, setPlaybackScale] = useState<number>(4); // Scaling in viewport (e.g., 4x)

  // Canvas Refs
  const workspaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simulated retro booting loading messages
  const loadingMessages = [
    "BOOTING REVO CART...",
    "POWERING ON 16-BIT PROCESSOR...",
    "CHROMA KEY MATRIX DETECTED...",
    "IMAGEN IMAGING ENGINE ENGAGED...",
    "DECOMPRESSING CHIP-ROM SPRITE...",
    "DECORATING SPRITE PALETTE...",
    "READY TO INTEGRATE!"
  ];

  // Load a character preset
  const handleLoadPreset = (preset: typeof CHARACTER_PRESETS[0]) => {
    setPrompt(preset.prompt);
    setStyle(preset.style);
    setPose(preset.pose);
    setBgColor(preset.bgColor);
  };

  // Trigger Sprite Generation via Server-Side API
  const handleGenerateSprite = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setLoadingStep(0);

    // Simulated step ticks for loading bar immersion
    const loadingInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingMessages.length - 2) {
          return prev + 1;
        }
        return prev;
      });
    }, 1000);

    try {
      const response = await fetch("/api/generate-sprite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, pose, bgColor }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "An error occurred while generating your sprite.");
      }

      setLoadingStep(loadingMessages.length - 1); // Done!
      setTimeout(() => {
        setActiveOriginalUrl(data.imageUrl);
        // Process default view with current parameters
        runImageProcessing(data.imageUrl);
        setIsGenerating(false);
        clearInterval(loadingInterval);
      }, 500);

    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "Failed to communicate with the model. Please check your network connection and verify GEMINI_API_KEY.";
      if (errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("429") || errMsg.toLowerCase().includes("exhausted") || errMsg.toLowerCase().includes("limit: 0")) {
        errMsg = "API Quota Exceeded (429). The free tier API key does not support image generation model requests or has run out of quota. To resolve this, please upgrade to a paid tier in the Settings > Secrets panel by selecting a billing-enabled Gemini API key.";
      }
      setGenerationError(errMsg);
      setIsGenerating(false);
      clearInterval(loadingInterval);
    }
  };

  // Run Canvas Processing Pipeline
  const runImageProcessing = async (sourceUrl: string) => {
    if (!sourceUrl) return;
    try {
      const { processedUrl, palette } = await processSpriteImage(
        sourceUrl,
        bgColor,
        pixelSize,
        colorLimit,
        tolerance
      );
      setActiveProcessedUrl(processedUrl);
      setExtractedPalette(palette);
      if (palette.length > 0 && !palette.includes(selectedPaintColor)) {
        setSelectedPaintColor(palette[0]);
      }
    } catch (err) {
      console.error("Error processing sprite image:", err);
    }
  };

  // Trigger re-processing when parameters change
  useEffect(() => {
    if (activeOriginalUrl) {
      runImageProcessing(activeOriginalUrl);
    }
  }, [pixelSize, colorLimit, tolerance, bgColor, activeOriginalUrl]);

  // Handle Manual Drawing on Canvas
  const initWorkspaceCanvas = () => {
    const canvas = workspaceCanvasRef.current;
    if (!canvas || !activeProcessedUrl) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = activeProcessedUrl;
  };

  // Sync canvas with processedUrl
  useEffect(() => {
    initWorkspaceCanvas();
  }, [activeProcessedUrl]);

  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = workspaceCanvasRef.current;
    if (!canvas || showOriginal) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Translate coordinates to the active pixel size (e.g. 32x32, 64x64)
    const activeRes = pixelSize > 0 ? pixelSize : 512;
    const scaleFactor = 512 / activeRes;

    const pixelX = Math.floor(clientX * (activeRes / rect.width));
    const pixelY = Math.floor(clientY * (activeRes / rect.height));

    // Update canvas
    ctx.imageSmoothingEnabled = false;
    if (editorTool === 'brush') {
      ctx.fillStyle = selectedPaintColor;
      ctx.fillRect(
        pixelX * scaleFactor, 
        pixelY * scaleFactor, 
        scaleFactor, 
        scaleFactor
      );
    } else {
      ctx.clearRect(
        pixelX * scaleFactor, 
        pixelY * scaleFactor, 
        scaleFactor, 
        scaleFactor
      );
    }

    // Capture edited image
    setActiveProcessedUrl(canvas.toDataURL("image/png"));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleCanvasInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      handleCanvasInteraction(e);
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDrawing(false);
  };

  // Spritesheet Frame Operations
  const handleAddFrame = () => {
    if (!activeProcessedUrl) return;

    const poseName = POSE_PRESETS.find(p => p.id === pose)?.name || "Pose";
    const styleName = style === "snes" ? "SNES" : style === "genesis" ? "Genesis" : "Arcade";
    
    const newFrame: SpriteFrame = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${spritesheet.frames.length + 1}: ${poseName} (${styleName})`,
      originalUrl: activeOriginalUrl,
      processedUrl: activeProcessedUrl,
      prompt: prompt,
      style: style,
      pose: pose,
      bgColor: bgColor,
      pixelSize: pixelSize,
      colorLimit: colorLimit,
      tolerance: tolerance
    };

    setSpritesheet(prev => ({
      ...prev,
      frames: [...prev.frames, newFrame]
    }));

    // Start playing animation if it was empty
    if (spritesheet.frames.length === 0) {
      setIsPlaying(true);
    }
  };

  const handleRemoveFrame = (id: string) => {
    setSpritesheet(prev => ({
      ...prev,
      frames: prev.frames.filter(f => f.id !== id)
    }));
  };

  const handleDuplicateFrame = (frame: SpriteFrame) => {
    const duplicatedFrame: SpriteFrame = {
      ...frame,
      id: Math.random().toString(36).substr(2, 9),
      name: `${frame.name} (Copy)`
    };

    setSpritesheet(prev => {
      const idx = prev.frames.findIndex(f => f.id === frame.id);
      const newFrames = [...prev.frames];
      newFrames.splice(idx + 1, 0, duplicatedFrame);
      return {
        ...prev,
        frames: newFrames
      };
    });
  };

  const handleMoveFrame = (id: string, direction: 'left' | 'right') => {
    const idx = spritesheet.frames.findIndex(f => f.id === id);
    if (idx === -1) return;

    if (direction === 'left' && idx > 0) {
      setSpritesheet(prev => {
        const frames = [...prev.frames];
        const temp = frames[idx];
        frames[idx] = frames[idx - 1];
        frames[idx - 1] = temp;
        return { ...prev, frames };
      });
    } else if (direction === 'right' && idx < spritesheet.frames.length - 1) {
      setSpritesheet(prev => {
        const frames = [...prev.frames];
        const temp = frames[idx];
        frames[idx] = frames[idx + 1];
        frames[idx + 1] = temp;
        return { ...prev, frames };
      });
    }
  };

  const handleLoadFrameToWorkspace = (frame: SpriteFrame) => {
    setActiveOriginalUrl(frame.originalUrl);
    setActiveProcessedUrl(frame.processedUrl);
    setPrompt(frame.prompt);
    setStyle(frame.style);
    setPose(frame.pose);
    setBgColor(frame.bgColor as any);
    setPixelSize(frame.pixelSize);
    setColorLimit(frame.colorLimit);
    setTolerance(frame.tolerance);
  };

  // Looping Animation Ticker
  useEffect(() => {
    let ticker: any;
    if (isPlaying && spritesheet.frames.length > 0) {
      ticker = setInterval(() => {
        setCurrentFrameIndex(prev => (prev + 1) % spritesheet.frames.length);
      }, 1000 / animationFps);
    } else {
      clearInterval(ticker);
    }
    return () => clearInterval(ticker);
  }, [isPlaying, animationFps, spritesheet.frames.length]);

  // Keep frame index inside bounds
  useEffect(() => {
    if (currentFrameIndex >= spritesheet.frames.length) {
      setCurrentFrameIndex(0);
    }
  }, [spritesheet.frames.length]);

  // Export Spritesheet PNG
  const handleExportSpritesheet = async () => {
    if (spritesheet.frames.length === 0) return;

    try {
      // Use 64x64 block sizes for pristine pixel sheets, or full 512 depending on quality
      // Standard game dev uses 64px blocks which is perfectly crisp for retro characters!
      const frameBlockSize = pixelSize > 0 ? pixelSize : 128; 
      const sheetDataUrl = await stitchSpritesheet(
        spritesheet.frames.map(f => f.processedUrl),
        spritesheet.columns,
        frameBlockSize
      );

      // Trigger download
      const link = document.createElement('a');
      link.download = `${spritesheet.name.toLowerCase().replace(/\s+/g, '_')}_spritesheet.png`;
      link.href = sheetDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export spritesheet:", err);
      alert("Could not compile spritesheet. Make sure all frames are fully loaded.");
    }
  };

  // Export current active workspace frame
  const handleExportSingleFrame = () => {
    if (!activeProcessedUrl) return;
    const link = document.createElement('a');
    link.download = `${spritesheet.name.toLowerCase().replace(/\s+/g, '_')}_${pose}.png`;
    link.href = activeProcessedUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Populate dynamic default character on first render to make the app ready-to-use
  useEffect(() => {
    // Generate a default character mock palette and load presets
    setExtractedPalette(['#D97706', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#1F2937', '#9CA3AF', '#F3F4F6']);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#0c0c0e] text-[#d1d1d6] font-sans selection:bg-cyan-500 selection:text-white relative overflow-hidden">
      
      {/* Scanline Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-50 opacity-[0.03]" 
        style={{ 
          background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 255, 0, 0.06))", 
          backgroundSize: "100% 4px, 3px 100%" 
        }} 
      />

      {/* Top Navigation */}
      <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#111114] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border-2 border-cyan-500 rounded flex items-center justify-center bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <div className="w-5 h-5 bg-cyan-400" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 80%, 20% 80%, 20% 20%, 0 20%)" }}></div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-widest text-white uppercase italic">
              Bit-Forge <span className="text-cyan-400">v2.1</span>
            </h1>
            <p className="text-[10px] text-cyan-500/60 font-mono tracking-tighter uppercase">
              IMAGEN CORE // 16-BIT EMULATION ENGINE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></span>
            <span className="text-xs font-mono text-green-500/80 uppercase">Imagen Cloud: Ready</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Flame className="w-3.5 h-3.5 text-cyan-500" />
            <span>TRANSPARENT SPRITESHEET OUT</span>
          </div>
        </div>
      </nav>

      {/* Main Workspace Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        
        {/* Left Panel: 16-Bit Character Creator (4 Columns) */}
        <section className="lg:col-span-4 bg-[#111114] border border-white/10 rounded-lg p-5 flex flex-col gap-5 shadow-xl" id="creator-panel">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="font-retro text-xs text-cyan-400">1. GENERATE CHARACTER</h2>
          </div>

          {/* Quick Preset Grid */}
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">CHARACTER CLASS PRESETS</label>
            <div className="grid grid-cols-3 gap-2">
              {CHARACTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className="bg-white/5 hover:bg-white/10 active:translate-y-0.5 border border-white/10 hover:border-cyan-500 text-slate-200 text-xs py-2 px-1.5 rounded-sm transition font-mono truncate"
                  title={preset.name}
                >
                  ⚔️ {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Prompt */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">PROMPT INSTRUCTIONS</label>
              <span className="text-[10px] font-mono text-cyan-500/60">IMAGEN 3 CORE</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your hero..."
              className="w-full h-32 bg-black border border-white/10 p-3 text-sm focus:outline-none focus:border-cyan-500/50 resize-none font-mono text-cyan-100/90 leading-relaxed rounded-sm"
            />
          </div>

          {/* Visual Style Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">CONSOLE ENGINE</label>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setStyle('snes')}
                  className={`flex items-center justify-between text-xs py-2 px-3 rounded-sm border font-mono transition ${
                    style === 'snes'
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)] font-bold'
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                  }`}
                >
                  <span>Super NES</span>
                  <span className="text-[9px] bg-white/10 px-1 py-0.5 rounded-sm text-white">VIVID</span>
                </button>
                <button
                  onClick={() => setStyle('genesis')}
                  className={`flex items-center justify-between text-xs py-2 px-3 rounded-sm border font-mono transition ${
                    style === 'genesis'
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)] font-bold'
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                  }`}
                >
                  <span>Sega Genesis</span>
                  <span className="text-[9px] bg-white/10 px-1 py-0.5 rounded-sm text-white">HIGH</span>
                </button>
                <button
                  onClick={() => setStyle('arcade')}
                  className={`flex items-center justify-between text-xs py-2 px-3 rounded-sm border font-mono transition ${
                    style === 'arcade'
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)] font-bold'
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                  }`}
                >
                  <span>Retro Arcade</span>
                  <span className="text-[9px] bg-white/10 px-1 py-0.5 rounded-sm text-white">CLASSIC</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">CHROMA KEY BACKING</label>
              <div className="grid grid-cols-1 gap-1.5">
                {BG_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setBgColor(color.id as any)}
                    className={`flex items-center gap-2 text-xs py-1.5 px-3 rounded-sm border font-mono transition ${
                      bgColor === color.id
                        ? 'bg-cyan-900/30 border-cyan-500 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    <span 
                      className="w-3 h-3 rounded-sm border border-white/20 inline-block shrink-0" 
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate">{color.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Poses selector */}
          <div>
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">POSE / STANCE PRESET</label>
            <div className="grid grid-cols-2 gap-2">
              {POSE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPose(p.id)}
                  className={`py-2 px-3 text-xs font-mono rounded-sm border text-left transition ${
                    pose === p.id
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                  }`}
                  title={p.desc}
                >
                  <span className="block font-semibold">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {generationError && (
            <div className="bg-red-950/40 border border-red-500/30 text-red-200 text-xs p-3 rounded-sm font-mono">
              <p className="font-bold flex items-center gap-1">⚠️ CORE ERROR</p>
              <p className="mt-1 leading-relaxed text-red-300">{generationError}</p>
            </div>
          )}

          {/* Core Generate Button */}
          <button
            onClick={handleGenerateSprite}
            disabled={isGenerating}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold uppercase tracking-[0.2em] rounded-sm shadow-[0_0_25px_rgba(6,182,212,0.4)] border-t border-cyan-400 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 cursor-pointer select-none transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <span className="animate-pulse">DECODING ROM SPRITE...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>GENERATE SPRITE</span>
              </>
            )}
          </button>

          {/* Immersive loading animation */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-black border border-white/10 rounded-sm p-4 font-mono text-[11px] text-cyan-400 leading-normal flex flex-col gap-2 overflow-hidden shadow-inner"
              >
                <div className="flex justify-between items-center text-cyan-400 font-bold border-b border-cyan-950 pb-1.5">
                  <span>💾 ROM COMPILER STATUS</span>
                  <span className="animate-pulse">LOADING...</span>
                </div>
                
                {/* Loader bar */}
                <div className="w-full bg-slate-900 h-2.5 rounded-full border border-white/10 overflow-hidden mt-1">
                  <motion.div 
                    initial={{ width: '5%' }}
                    animate={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-cyan-500 shadow-[0_0_8px_#22d3ee]"
                  />
                </div>

                <div className="flex flex-col gap-1 mt-1 font-mono text-cyan-200">
                  <div className="text-cyan-400 font-bold">
                    &gt; {loadingMessages[loadingStep]}
                  </div>
                  <div className="text-slate-500 text-[10px] italic">
                    Running Imagen 3 generate operation... might take ~10-15s.
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Middle Panel: Active Sprite Studio (5 Columns) */}
        <section className="lg:col-span-5 bg-[#111114] border border-white/10 rounded-lg p-5 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-cyan-400" />
              <h2 className="font-retro text-xs text-cyan-400">2. SPRITE DESIGNER</h2>
            </div>
            {activeOriginalUrl && (
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className={`text-[10px] font-mono border px-2 py-1 rounded-sm transition ${
                  showOriginal 
                    ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]' 
                    : 'bg-black border-white/10 text-white/50 hover:bg-white/5'
                }`}
              >
                {showOriginal ? "SHOWING ORIGINAL IMAGEN" : "SHOW ORIGINAL STANCE"}
              </button>
            )}
          </div>

          {/* Active Canvas Workspace */}
          <div className="relative bg-black border border-white/10 rounded-lg p-6 flex items-center justify-center min-h-[340px] shadow-2xl overflow-hidden group">
            
            {/* Decorative corners */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-500"></div>
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-500"></div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-500"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-500"></div>

            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }} />

            {activeOriginalUrl ? (
              <div className="relative flex flex-col items-center gap-3">
                {showOriginal ? (
                  <img
                    src={activeOriginalUrl}
                    alt="Original generated"
                    className="w-[300px] h-[300px] object-contain bg-[#111114] border border-white/10 rounded-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="relative group cursor-crosshair">
                    {/* Transparent check background for actual transparent png appreciation */}
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,8px_0] bg-[#050506] rounded-sm border border-cyan-500/10" />
                    
                    <canvas
                      ref={workspaceCanvasRef}
                      width={512}
                      height={512}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUpOrLeave}
                      onMouseLeave={handleMouseUpOrLeave}
                      className="relative w-[300px] h-[300px] pixelated rounded-sm"
                    />

                    {/* Paint Tools HUD Overlay */}
                    <div className="absolute bottom-2 left-2 right-2 bg-black/95 border border-white/10 rounded px-3 py-1.5 flex justify-between items-center text-xs font-mono select-none">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditorTool('brush')}
                          className={`p-1.5 rounded transition ${editorTool === 'brush' ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Pencil Brush Tool"
                        >
                          <Paintbrush className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditorTool('eraser')}
                          className={`p-1.5 rounded transition ${editorTool === 'eraser' ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'}`}
                          title="Eraser Tool"
                        >
                          <Eraser className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-[10px] text-cyan-400">
                        {editorTool === 'brush' ? "BRUSH MODE" : "ERASER MODE"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-6 flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-slate-700 font-retro text-lg">
                  ?
                </div>
                <div>
                  <p className="text-sm text-cyan-400/80 font-mono font-bold uppercase tracking-wider">WORKSPACE VACANT</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs font-mono">
                    Select a class preset or write a custom prompt on the left, then click **Generate** to forge your 16-bit retro sprite.
                  </p>
                </div>
              </div>
            )}

            {/* Dimension Badge */}
            <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-cyan-600 text-[9px] px-3 py-1 font-bold text-white italic tracking-widest rounded-full z-20 shadow-[0_0_10px_#0891b2] uppercase">
              RENDER: {pixelSize === 0 ? "RAW" : `${pixelSize}x${pixelSize}px`} // UPSCALED
            </div>
          </div>

          {/* Extracted Color Palette Bar */}
          {activeProcessedUrl && extractedPalette.length > 0 && (
            <div className="bg-black border border-white/10 rounded-lg p-3">
              <div className="flex justify-between items-center text-[10px] font-mono text-white/40 mb-2">
                <span className="font-bold flex items-center gap-1">🎨 {style === 'snes' ? 'SNES SUB-PALETTE' : 'GENESIS SUB-PALETTE'} ({extractedPalette.length} COLS)</span>
                <span>CLICK COLOR TO SWAP</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {extractedPalette.map((colorHex, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedPaintColor(colorHex);
                      setEditorTool('brush');
                    }}
                    className={`w-7 h-7 rounded-sm border transition-all ${
                      selectedPaintColor === colorHex && editorTool === 'brush'
                        ? 'border-cyan-400 scale-115 ring-2 ring-cyan-500/40'
                        : 'border-white/10 hover:scale-105'
                    }`}
                    style={{ backgroundColor: colorHex }}
                    title={`Color hex: ${colorHex} (Click to set as drawing color)`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Image Slicing, Background and Downsampling parameters */}
          {activeOriginalUrl && (
            <div className="bg-black border border-white/10 rounded-lg p-4 flex flex-col gap-4 font-mono text-xs">
              
              {/* Sliders heading */}
              <div className="flex items-center gap-1 text-white/40 border-b border-white/10 pb-1.5">
                <Sliders className="w-3.5 h-3.5" />
                <span className="font-bold text-[10px] uppercase tracking-wider">RETRO CONSOLE EMULATION TUNERS</span>
              </div>

              {/* Downsample (Pixel Size) slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>🎮 CHARACTER SPRITE RESOLUTION:</span>
                  <span className="text-cyan-400 font-bold">
                    {pixelSize === 0 ? "Original" : `${pixelSize}x${pixelSize} Grid`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[32, 64, 128, 0].map((resValue) => (
                    <button
                      key={resValue}
                      onClick={() => setPixelSize(resValue)}
                      className={`py-1.5 rounded-sm text-[10px] border transition ${
                        pixelSize === resValue
                          ? 'bg-cyan-600 border-cyan-400 text-white font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {resValue === 0 ? "RAW" : `${resValue}x${resValue}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color limiter */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>🎨 CONSOLE PALETTE LIMIT:</span>
                  <span className="text-cyan-400 font-bold">
                    {colorLimit === 4 ? "4 Colors (Game Boy)" : 
                     colorLimit === 8 ? "8 Colors (8-Bit NES)" : 
                     colorLimit === 15 ? "15 Colors (Mega Drive)" : 
                     colorLimit === 16 ? "16 Colors (Super NES)" : 
                     colorLimit === 32 ? "32 Colors (Arcade)" : "Original Colors"}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[4, 8, 15, 16, 32, 0].map((limitValue) => (
                    <button
                      key={limitValue}
                      onClick={() => setColorLimit(limitValue)}
                      className={`py-1 rounded-sm text-[10px] border transition ${
                        colorLimit === limitValue
                          ? 'bg-cyan-600 border-cyan-400 text-white font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {limitValue === 0 ? "NONE" : `${limitValue}C`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chroma tolerance slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>🟢 CHROMA-KEY TOLERANCE (BACKGROUND ERASER):</span>
                  <span className="text-cyan-400 font-bold">{tolerance}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  value={tolerance}
                  onChange={(e) => setTolerance(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                />
              </div>

              {/* Frame Addition Area */}
              <div className="border-t border-white/10 pt-3 flex gap-2">
                <button
                  onClick={handleAddFrame}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 active:translate-y-0.5 border border-cyan-400 text-white font-mono text-xs py-2.5 px-3 rounded shadow-[0_0_12px_rgba(6,182,212,0.3)] flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>ADD TO SPRITESHEET</span>
                </button>
                <button
                  onClick={handleExportSingleFrame}
                  className="bg-white/5 hover:bg-white/10 active:translate-y-0.5 border border-white/10 text-slate-300 font-mono text-xs py-2.5 px-3 rounded flex items-center justify-center gap-1 cursor-pointer transition"
                  title="Export active frame only"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right Panel: Animation & Spritesheet Builder (3 Columns) */}
        <section className="lg:col-span-3 bg-[#111114] border border-white/10 rounded-lg p-5 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="font-retro text-xs text-cyan-400">3. ANIMATION COMPILER</h2>
          </div>

          {/* Live Looping Animation Preview Player */}
          <div className="bg-black border border-white/10 rounded-lg p-4 flex flex-col items-center gap-3 relative overflow-hidden">
            
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }} />

            <div className="absolute top-2 left-2 text-[8px] font-retro text-white/40">
              ANIMATION REEL
            </div>

            {spritesheet.frames.length > 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 w-full relative z-10">
                
                {/* Active Player screen */}
                <div className="relative w-32 h-32 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:12px_12px] bg-[position:0_0,0_6px,6px_-6px,6px_0] bg-black border border-white/10 rounded-lg flex items-center justify-center overflow-hidden shadow-inner">
                  <img
                    src={spritesheet.frames[currentFrameIndex]?.processedUrl}
                    alt="Active animation frame"
                    className="pixelated object-contain"
                    style={{ 
                      width: `${64 * (playbackScale / 2)}px`,
                      height: `${64 * (playbackScale / 2)}px`
                    }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-mono text-cyan-400 px-1 py-0.5 rounded border border-white/10">
                    FRAME {currentFrameIndex + 1}/{spritesheet.frames.length}
                  </div>
                </div>

                {/* Player Controls */}
                <div className="flex items-center gap-3 font-mono text-xs w-full justify-center">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="bg-white/5 hover:bg-white/10 p-2 rounded-lg text-slate-200 transition active:scale-95 border border-white/10"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 text-cyan-400" /> : <Play className="w-4 h-4 text-cyan-400" />}
                  </button>
                  
                  <div className="flex flex-col gap-1 shrink-0 w-24">
                    <span className="text-[9px] text-white/40 font-bold uppercase">SPEED: {animationFps} FPS</span>
                    <input
                      type="range"
                      min="1"
                      max="18"
                      value={animationFps}
                      onChange={(e) => setAnimationFps(parseInt(e.target.value))}
                      className="w-full accent-cyan-500 h-1 bg-slate-900 rounded"
                    />
                  </div>

                  <div className="flex flex-col gap-1 shrink-0 w-16">
                    <span className="text-[9px] text-white/40 font-bold uppercase">ZOOM: {playbackScale}x</span>
                    <input
                      type="range"
                      min="2"
                      max="6"
                      value={playbackScale}
                      onChange={(e) => setPlaybackScale(parseInt(e.target.value))}
                      className="w-full accent-cyan-500 h-1 bg-slate-900 rounded"
                    />
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-8 text-slate-600 font-mono text-xs relative z-10">
                No frames added yet. Add current design below the designer canvas to animate!
              </div>
            )}
          </div>

          {/* Frames List Timeline */}
          <div className="flex-1 flex flex-col gap-2 min-h-[200px]">
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest">SPRITESHEET FRAMES ({spritesheet.frames.length})</label>
            
            <div className="flex-1 bg-black border border-white/10 rounded-lg p-2 overflow-y-auto max-h-[280px] flex flex-col gap-2 shadow-inner">
              {spritesheet.frames.length === 0 ? (
                <div className="text-center py-12 text-slate-700 font-mono text-xs">
                  EMPTY TIMELINE
                </div>
              ) : (
                spritesheet.frames.map((frame, index) => (
                  <div
                    key={frame.id}
                    className={`bg-[#111114] border p-2 rounded flex items-center justify-between gap-2 text-xs font-mono group transition ${
                      selectedFrameId === frame.id ? 'border-cyan-500 bg-cyan-950/20' : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Tiny transparent grid thumbnail */}
                    <button
                      onClick={() => {
                        setSelectedFrameId(frame.id);
                        handleLoadFrameToWorkspace(frame);
                      }}
                      className="relative w-11 h-11 bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:6px_6px] bg-[position:0_0,0_3px,3px_-3px,3px_0] bg-black border border-white/10 rounded-sm flex items-center justify-center shrink-0 overflow-hidden cursor-pointer active:scale-95"
                      title="Load frame parameter settings into workspace"
                    >
                      <img
                        src={frame.processedUrl}
                        alt="frame thumb"
                        className="w-8 h-8 object-contain pixelated"
                        referrerPolicy="no-referrer"
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-300 truncate text-[10px]" title={frame.name}>
                        {frame.name}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate capitalize font-mono mt-0.5">
                        {frame.pose} Pose
                      </p>
                    </div>

                    {/* Frame sequencer controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveFrame(frame.id, 'left')}
                        disabled={index === 0}
                        className="p-1 hover:bg-white/5 text-slate-500 hover:text-slate-300 disabled:opacity-20 transition"
                        title="Move Left"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveFrame(frame.id, 'right')}
                        disabled={index === spritesheet.frames.length - 1}
                        className="p-1 hover:bg-white/5 text-slate-500 hover:text-slate-300 disabled:opacity-20 transition"
                        title="Move Right"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDuplicateFrame(frame)}
                        className="p-1 hover:bg-white/5 text-slate-500 hover:text-slate-300 transition"
                        title="Duplicate Frame"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleRemoveFrame(frame.id)}
                        className="p-1 hover:bg-white/5 text-red-500/70 hover:text-red-400 transition"
                        title="Delete Frame"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Spritesheet Compile Parameters & Compile trigger */}
          <div className="bg-black border border-white/10 rounded-lg p-3 font-mono text-xs flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest">SPRITESHEET FILE NAME</label>
              <input
                type="text"
                value={spritesheet.name}
                onChange={(e) => setSpritesheet(prev => ({ ...prev, name: e.target.value }))}
                className="bg-[#111114] border border-white/10 rounded-sm p-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest">GRID SHEET LAYOUT</label>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">GRID COLS:</span>
                <select
                  value={spritesheet.columns}
                  onChange={(e) => setSpritesheet(prev => ({ ...prev, columns: parseInt(e.target.value) }))}
                  className="bg-[#111114] border border-white/10 text-slate-300 rounded-sm p-1"
                >
                  <option value="2">2 Columns</option>
                  <option value="4">4 Columns</option>
                  <option value="6">6 Columns</option>
                  <option value="8">8 Columns</option>
                  <option value="12">12 Columns</option>
                </select>
              </div>
            </div>

            {/* Spritesheet Compiler Button */}
            <button
              onClick={handleExportSpritesheet}
              disabled={spritesheet.frames.length === 0}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold uppercase rounded-sm shadow-[0_0_15px_rgba(6,182,212,0.3)] border-t border-cyan-400 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-0.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT SPRITESHEET (PNG)</span>
            </button>
          </div>

        </section>

      </main>

      {/* Immersive Console Bottom Status Rail */}
      <footer className="h-8 bg-cyan-950/20 border-t border-white/5 px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex gap-6 text-[9px] font-mono text-cyan-500/60 uppercase tracking-widest">
          <span>Session: 0x82f1...</span>
          <span>Core Latency: 420ms</span>
          <span>Seed: 9283741</span>
          <span className="hidden md:inline">Unity & Godot Grid Slicing Compatible</span>
        </div>
        <div className="text-[9px] font-mono text-cyan-500/60 uppercase">
          System Status: <span className="text-green-500 shadow-[0_0_8px_#22c55e]">Optimal</span>
        </div>
      </footer>

    </div>
  );
}
