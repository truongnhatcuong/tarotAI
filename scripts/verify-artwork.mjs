import { readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { RIDER_WAITE_FILENAMES } from '../src/data/rider-waite-images.ts';
const examples=['the-fool','the-magician','ace-of-cups','death','the-world'];
let kit;
try{kit=await import('@cometpisces/tarot-kit-images');}
catch{
  console.error('ARTWORK VERIFICATION BLOCKED: @cometpisces/tarot-kit-images is not installed. Cannot verify package API, PNG files, or visual artwork locally. CDN URLs are not evidence of successful image loading.');
  process.exit(1);
}
let root=dirname(fileURLToPath(import.meta.resolve('@cometpisces/tarot-kit-images')));
for(let i=0;i<5;i++){try{await access(join(root,'images'));break;}catch{root=dirname(root);}}
const manifest=JSON.parse(await readFile('src/data/image-manifest.json','utf8'));
if(manifest.source!=='rider-waite')throw new Error('Run npm run prepare:images to use local package artwork.');
const hashes=new Set();
for(const id of Object.keys(RIDER_WAITE_FILENAMES)){
  const filename=kit.getImagePath(id);
  if(!filename||!kit.hasImage(id))throw new Error(`Package API has no image for ${id}`);
  if(manifest.images[id]!==`/tarot/${filename}`)throw new Error(`Wrong rendered mapping for ${id}`);
  const [original,copied]=await Promise.all([readFile(join(root,'images',filename)),readFile(join('public/tarot',filename))]);
  if(!original.equals(copied))throw new Error(`Rendered file differs from package: ${id}`);
  if(!original.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error(`Not a PNG: ${id}`);
  const width=original.readUInt32BE(16),height=original.readUInt32BE(20);
  if(width<100||height<100)throw new Error(`Artwork unexpectedly small: ${id}`);
  hashes.add(createHash('sha256').update(original).digest('hex'));
  if(examples.includes(id))console.log(`${id} -> ${filename} -> ${manifest.images[id]} (${width} × ${height}, exact package bytes)`);
}
if(hashes.size!==78)throw new Error('Artwork is duplicated or fewer than 78 unique files.');
console.log('PASS: 78 unique original PNG files; every ID matches package API and copied bytes.');
