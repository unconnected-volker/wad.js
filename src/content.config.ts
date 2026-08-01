import { defineCollection } from 'astro:content';
import { wadDataLoader } from './wadDataLoader';

const doomData = defineCollection({
  loader: wadDataLoader,
});

export const collections = { doomData };