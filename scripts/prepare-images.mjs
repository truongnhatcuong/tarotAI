import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RIDER_WAITE_FILENAMES, PACKAGE_CDN } from '../src/data/rider-waite-images.ts';

await mkdir('public/tarot', { recursive: true });
await mkdir('src/data', { recursive: true });
let kit;
try { kit=await import('@cometpisces/tarot-kit-images'); }
catch(error){
  if(error.code!=='ERR_MODULE_NOT_FOUND'&&error.code!=='MODULE_NOT_FOUND')throw error;
}
const images={};
let source;
if(kit){
  let root=dirname(fileURLToPath(import.meta.resolve('@cometpisces/tarot-kit-images')));
  let found=false;
  for(let depth=0;depth<5;depth++){
    try{await access(join(root,'images'));found=true;break;}catch{root=dirname(root);}
  }
  if(!found)throw new Error('Installed image package has no images directory. No replacement artwork is generated.');
  if(kit.getAllImagePaths().length!==78)throw new Error('The installed image package does not expose exactly 78 images.');
  const actual=new Set();
  for(const [id,documented] of Object.entries(RIDER_WAITE_FILENAMES)){
    const filename=kit.getImagePath(id);
    if(!filename||!kit.hasImage(id)||!filename.endsWith('.png'))throw new Error(`No Rider–Waite PNG mapped to ${id}`);
    // The installed package is authoritative. A discrepancy is reported and
    // its exact mapping is used; no guessed image is substituted.
    if(filename!==documented)console.warn(`Package mapping differs from documentation: ${id}: ${documented} -> ${filename}`);
    const bytes=await readFile(join(root,'images',filename));
    if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error(`Invalid PNG artwork: ${filename}`);
    await copyFile(join(root,'images',filename),join('public/tarot',filename));
    actual.add(filename);images[id]=`/tarot/${filename}`;
  }
  if(actual.size!==78)throw new Error('Multiple card IDs map to the same artwork.');
  for(const license of ['LICENSE.md','LICENSE','LICENSE.txt']){
    try{await copyFile(join(root,license),join('public/tarot',license));break;}catch{}
  }
  source='rider-waite';
  console.log('Verified 78 unique package mappings and PNG files; copied original Rider–Waite artwork.');
}else{
  // Real PNG artwork from the exact npm package, served by its CDN. No local
  // placeholder, synthetic artwork, SVG, icon, or CSS front is ever generated.
  for(const [id,filename] of Object.entries(RIDER_WAITE_FILENAMES))images[id]=PACKAGE_CDN+filename;
  source='rider-waite-cdn';
  console.warn('Package install is unavailable. Fronts use original package PNG URLs on jsDelivr; external images require connectivity. Local package mapping/file verification is pending.');
}
const manifest=JSON.stringify({source,images},null,2)+'\n';
const target=resolve('src/data/image-manifest.json');
let previous='';try{previous=await readFile(target,'utf8');}catch{}
if(previous!==manifest)await writeFile(target,manifest);
