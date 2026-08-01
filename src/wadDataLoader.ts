import * as fs from 'fs';
import * as path from 'path';
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';

const extractLump = (data: Buffer, lumpIndex: number, dirOffset: number): { name: string; lumpBuffer: Buffer } => {
  const entryOffset = dirOffset + (lumpIndex * 16);
  
  const offset = data.readUInt32LE(entryOffset);
  const size = data.readUInt32LE(entryOffset + 4);
  const name = data.toString('ascii', entryOffset + 8, entryOffset + 16).replace(/\0/g, '');
  
  // Extract the raw bytes for this lump
  const lumpBuffer = data.subarray(offset, offset + size);
  
  return { name, lumpBuffer };
}

const parseWadHeader = (data: Buffer) => {
    const identifier = data.toString('ascii', 0, 4);

    if (identifier !== 'IWAD' && identifier !== 'PWAD') {
        throw new Error('Invalid WAD file identifier')
    }

    const numLumps = data.readUInt32LE(4);
    const dirOffset = data.readUInt32LE(8);

    return {identifier, numLumps, dirOffset};
}

const readWad = (wadPath: string): Buffer => {
  const fullPath = path.resolve(wadPath);
  try {
    // Read synchronously as a Buffer to preserve binary format
    return fs.readFileSync(fullPath);
  } catch (error) {
    throw new Error(`Failed to read WAD file: ${error}`);
  }
}

export type Palette = { r: number, g: number, b: number }[];
export type Sprite = { width: number, height: number, leftOffet: number, topOffet: number, columnOffsets: number[], pixelBuffer: Buffer };

const readPalettes = (palettesLumpData: Buffer): Palette[] => {
  const PALETTE_NUM = 14;
  const palettes: Palette[] = [];


  for (let paletteIndex = 0; paletteIndex < PALETTE_NUM; paletteIndex++) {
    const palette: Palette = [];
    
    for (let colorIndex = 0; colorIndex < 256; colorIndex++) {
      const colorOffset = paletteIndex * 3 * 256 + colorIndex * 3;
      console.log({paletteIndex, colorIndex, colorOffset});

      const r = palettesLumpData.readUInt8(colorOffset);
      const g = palettesLumpData.readUInt8(colorOffset + 1);
      const b = palettesLumpData.readUInt8(colorOffset + 2);

      palette.push({ r, g, b });
    }

    palettes.push(palette);
  }
  console.log(palettesLumpData.length);

  return palettes;
}

const readSprite = (spriteLumpData: Buffer) => {
  const width = spriteLumpData.readUInt16LE(0);
  const height = spriteLumpData.readUInt16LE(2);
  const leftOffet = spriteLumpData.readInt16LE(4);
  const topOffet = spriteLumpData.readInt16LE(6);

  const COLUMN_OFFET_BASE = 8;
  const COLUMN_OFFEST_ENTRY_SIZE = 4;
  const columnOffsets = [];

  for (let offsetIndex = 0; offsetIndex < width; offsetIndex ++) {
    columnOffsets.push(spriteLumpData.readUInt32LE(COLUMN_OFFET_BASE + offsetIndex * COLUMN_OFFEST_ENTRY_SIZE));
  }

  // Extract the raw bytes for this lump
  const pixelBuffer = spriteLumpData.subarray(width * COLUMN_OFFEST_ENTRY_SIZE + COLUMN_OFFET_BASE, spriteLumpData.length);

  const sprite = { width, height, leftOffet, topOffet, columnOffsets, pixelBuffer};

  return sprite;
}

export const wadDataLoader: Loader = {
  name: 'my-source', // Required: Name for logs
  load: async (context) => {
    const wadData = readWad("./src/data/doom2.wad");
    const header = parseWadHeader(wadData);
      
    console.log(header);

    for (let i = 0; i < header.numLumps; i++) {
      const lump = extractLump(wadData, i, header.dirOffset);

      if (lump.name === 'PLAYPAL') {
        const palettes = readPalettes(lump.lumpBuffer);
        // console.log(palettes);

        context.store.set({ id: 'PLAYPAL', data: { palettes } })
      }
      if (lump.name.startsWith('TROOA1')) {
        const trooa1 = readSprite(lump.lumpBuffer);

        context.store.set({ id: 'TROOA1', data: { trooa1 } })
      }
    }
  },
  schema: z.object({ palettes: z.object<Palette[]>(), trooa1: z.object<Sprite>}), // Optional: Zod schema for validation;
}