import { resolve as pathResolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { access } from 'node:fs/promises';

// Node 22.18+ strips TypeScript natively. Resolve extensionless imports and the
// app's @/ alias without tsx's operating-system account lookup dependency.
export async function resolve(specifier,context,nextResolve){
  let target=specifier;
  if(specifier==='next/server')return nextResolve('next/server.js',context);
  if(specifier.startsWith('@/'))target=pathToFileURL(resolvePath('src',specifier.slice(2))).href;
  if((target.startsWith('file:')||target.startsWith('.'))&&!extname(target)){
    const url=new URL(target,context.parentURL);
    for(const suffix of ['.ts','.tsx','.json','/index.ts']){
      const candidate=new URL(url.href+suffix);
      try{await access(candidate);return {url:candidate.href,shortCircuit:true};}catch{}
    }
  }
  return nextResolve(target,context);
}
function resolvePath(...parts){return pathResolve(...parts);}
export async function load(url,context,nextLoad){
  if(url.endsWith('.json'))return nextLoad(url,{...context,importAttributes:{type:'json'}});
  return nextLoad(url,context);
}
