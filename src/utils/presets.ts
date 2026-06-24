export interface PromptPreset {
  id: string;
  name: string;
  prompt: string;
  style: 'snes' | 'genesis' | 'arcade';
  pose: string;
  bgColor: 'magenta' | 'green' | 'blue' | 'black' | 'white';
}

export const CHARACTER_PRESETS: PromptPreset[] = [
  {
    id: 'knight',
    name: 'Paladin Knight',
    prompt: 'a heroic medieval knight in polished steel armor, gold trimming, holding a glowing holy sword, side view',
    style: 'snes',
    pose: 'idle',
    bgColor: 'magenta'
  },
  {
    id: 'ninja',
    name: 'Neon Ninja',
    prompt: 'a cyberpunk shadow ninja, wearing matte-black gear with glowing neon-blue visor and sash, holding a glowing katana, side profile',
    style: 'genesis',
    pose: 'walk',
    bgColor: 'green'
  },
  {
    id: 'mage',
    name: 'Cosmic Wizard',
    prompt: 'a retro sorcerer in deep violet starry robes, wearing a pointed wizard hat, holding a staff crowned with a sparkling cyan crystal sphere, side view',
    style: 'snes',
    pose: 'attack',
    bgColor: 'magenta'
  },
  {
    id: 'alien',
    name: 'Cute Space Blob',
    prompt: 'a cute gelatinous lime-green alien blob with two tiny antenna and huge expressive black eyes, bouncing cheerful pose, side profile',
    style: 'arcade',
    pose: 'jump',
    bgColor: 'blue'
  },
  {
    id: 'bounty',
    name: 'Cyber Hunter',
    prompt: 'a sci-fi bounty hunter wearing power armor with brass and copper plates, glowing amber visor, arm cannon extended, side view',
    style: 'genesis',
    pose: 'idle',
    bgColor: 'magenta'
  },
  {
    id: 'dino',
    name: 'Pixel Dino',
    prompt: 'a tiny chubby red dinosaur with small spikes on its back, breathing a tiny puff of yellow flame, side profile',
    style: 'snes',
    pose: 'attack',
    bgColor: 'magenta'
  }
];

export const POSE_PRESETS = [
  { id: 'idle', name: 'Idle Stance', desc: 'Standing, looking forward ready for action' },
  { id: 'walk', name: 'Walking Frame', desc: 'Mid-stride, one leg bent and arms swung' },
  { id: 'jump', name: 'Jumping pose', desc: 'In mid-air, arms raised and knees tucked' },
  { id: 'attack', name: 'Attack Strike', desc: 'Weapon fully extended, driving forward' },
  { id: 'hurt', name: 'Hurt / Stunned', desc: 'Recoiling back, eye squeezed shut in impact' },
  { id: 'die', name: 'Defeated / KO', desc: 'Lying horizontally on the ground' }
];

export const BG_COLORS = [
  { id: 'magenta', name: 'Magenta Chroma (#FF00FF)', hex: '#FF00FF', textClass: 'text-fuchsia-500' },
  { id: 'green', name: 'Green Chroma (#00FF00)', hex: '#00FF00', textClass: 'text-green-500' },
  { id: 'blue', name: 'Blue Chroma (#0000FF)', hex: '#0000FF', textClass: 'text-blue-500' },
  { id: 'white', name: 'White Key (#FFFFFF)', hex: '#FFFFFF', textClass: 'text-slate-300' },
  { id: 'black', name: 'Black Key (#000000)', hex: '#000000', textClass: 'text-slate-800' }
];
