export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';

export interface Palette {
  id: SeasonId;
  label: string;
  /** Canopy colours, sampled per leaf. */
  leaf: string[];
  /** Darker, high-contrast tones used once the leaves settle into QR modules. */
  qrLeaf: string[];
  bark: string;
  barkDark: string;
  hedge: string[];
  /** Colour of the raised (dark) QR modules on the ground slab. */
  moduleDark: string;
  moduleLight: string;
  slab: string;
  ground: string;
}

/**
 * Spring lets the visitor repaint the blossom. Each swatch carries a canopy
 * tone and a much deeper `qr` tone: once the leaves become code modules they
 * have to stay dark enough for a scanner to binarise against the pale plot.
 */
export const BLOSSOM_SWATCHES = [
  { id: 'blush', label: 'Blush', leaf: ['#f4b8cf', '#efa4c2', '#f8cfe0', '#e88fb2'], qr: ['#5e2340', '#4e1c35', '#6b2b4a'], hedge: ['#f5d4e2', '#f0c2d7', '#f8dce9'] },
  { id: 'lilac', label: 'Lilac', leaf: ['#c3aae6', '#b295dd', '#d6c4f0', '#a17fd2'], qr: ['#392556', '#2f1e48', '#432d63'], hedge: ['#d9c5f0', '#ceb8e6', '#e8dbf5'] },
  { id: 'poppy', label: 'Poppy', leaf: ['#ef7c72', '#e35f56', '#f59a92', '#d64c45'], qr: ['#5c1a16', '#4d1512', '#69211c'], hedge: ['#f5a39a', '#ef8f85', '#f9b9ae'] },
  { id: 'honey', label: 'Honey', leaf: ['#f2c25c', '#e8b141', '#f7d585', '#dda32c'], qr: ['#543c08', '#463105', '#61470d'], hedge: ['#f5d891', '#ead65b', '#f9e4a8'] },
  { id: 'sky', label: 'Sky', leaf: ['#7cb6ea', '#63a4e0', '#9dcbf2', '#4a92d6'], qr: ['#16324d', '#122942', '#1b3b5a'], hedge: ['#a8d0f5', '#8ac2ed', '#c3dff7'] },
  { id: 'snow', label: 'Snow', leaf: ['#f4f1ea', '#e8e3d8', '#fbfaf6', '#ddd6c8'], qr: ['#46403a', '#3a3531', '#514a43'], hedge: ['#faf8f4', '#f1ebe0', '#fcfbf8'] },
] as const;

export type BlossomId = (typeof BLOSSOM_SWATCHES)[number]['id'];

export const SEASONS: Record<SeasonId, Palette> = {
  spring: {
    id: 'spring',
    label: 'Spring',
    leaf: ['#f4b8cf', '#efa4c2', '#f8cfe0', '#e88fb2'],
    qrLeaf: ['#5e2340', '#4e1c35', '#6b2b4a'],
    bark: '#8a6a4e',
    barkDark: '#5f4733',
    hedge: ['#a8d88f', '#94c677', '#bce4a5'],
    moduleDark: '#e8a4c2',
    moduleLight: '#fef5f9',
    slab: '#f5dae6',
    ground: '#fce8f2',
  },
  summer: {
    id: 'summer',
    label: 'Summer',
    leaf: ['#6ab24a', '#5aa03c', '#84c664', '#4c8f31'],
    qrLeaf: ['#255417', '#1e4512', '#2c631d'],
    bark: '#8a6a4e',
    barkDark: '#5f4733',
    hedge: ['#7ec25a', '#6bb047', '#93d06f'],
    moduleDark: '#a4d68a',
    moduleLight: '#f8fef5',
    slab: '#d6eac8',
    ground: '#e8f5e0',
  },
  autumn: {
    id: 'autumn',
    label: 'Autumn',
    leaf: ['#f2a13c', '#e8842a', '#f7c05e', '#d96a1f'],
    qrLeaf: ['#8a400c', '#763409', '#9c4c12'],
    bark: '#6f5540',
    barkDark: '#4a382a',
    hedge: ['#dcb84a', '#c9a437', '#e8cc6a'],
    moduleDark: '#f2c97a',
    moduleLight: '#fefaf5',
    slab: '#f5e8cc',
    ground: '#fef4e6',
  },
  winter: {
    id: 'winter',
    label: 'Winter',
    leaf: ['#7cb6ea', '#63a4e0', '#9dcbf2', '#4a92d6'],
    qrLeaf: ['#16324d', '#122942', '#1b3b5a'],
    bark: '#6d7a8a',
    barkDark: '#49525d',
    hedge: ['#b8d9f5', '#a0c9ed', '#d0e8f7'],
    moduleDark: '#a8c9ed',
    moduleLight: '#f5fafe',
    slab: '#d9e8f5',
    ground: '#e8f2fa',
  },
};

export const SEASON_ORDER: SeasonId[] = ['spring', 'summer', 'autumn', 'winter'];
