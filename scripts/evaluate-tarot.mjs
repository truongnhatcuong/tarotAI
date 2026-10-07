import { writeFile } from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import { analyzeWithAI } from '../src/services/ai.ts';
import { TAROT_EVALUATION_CASES } from '../tests/fixtures/tarot-evaluation-cases.ts';

// Explicit live evaluation: never runs as part of npm test and uses synthetic data.
// Provider credentials remain in the environment, never in the report.
const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : '/private/tmp/tarot-evaluation.json';
if (!output) throw new Error('Missing --output path');
const requestedCase = process.argv.indexOf('--case');
const cases = requestedCase < 0 ? TAROT_EVALUATION_CASES : TAROT_EVALUATION_CASES.filter(item=>item.id===process.argv[requestedCase+1]);
if (!cases.length) throw new Error('Unknown evaluation case');
const results = [];
const diagnostics=process.argv.includes('--diagnostics');
const context=new AsyncLocalStorage();
const originalFetch=globalThis.fetch;
if(diagnostics)globalThis.fetch=async(...args)=>{
  const response=await originalFetch(...args);
  const outputs=context.getStore();
  if(outputs){
    try{
      const payload=await response.clone().json();
      const text=payload.choices?.[0]?.message?.content ?? (payload.output ?? []).flatMap(item=>item.content ?? []).filter(part=>part.type==='output_text').map(part=>part.text ?? '').join('');
      if(text)outputs.push(text);
    }catch{/* Invalid provider JSON is reported by the production parser. */}
  }
  return response;
};
// Two independent synthetic requests at a time, to avoid overloading the provider.
for (let offset=0; offset<cases.length; offset+=2) {
  results.push(...await Promise.all(cases.slice(offset,offset+2).map(async item=>{
    const started=Date.now();
    const outputs=[];
    try {
      const analysis=await context.run(outputs,()=>analyzeWithAI(item.request));
      console.log(`${item.id}: generated and validated (${Math.round((Date.now()-started)/1000)}s)`);
      return {...item,analysis,error:null,...(diagnostics?{providerOutputs:outputs}:{})};
    } catch(error) {
      console.log(`${item.id}: failed (${error.code ?? 'UNEXPECTED_ERROR'})`);
      return {...item,analysis:null,error:{code:error.code ?? 'UNEXPECTED_ERROR',message:error.message},...(diagnostics?{providerOutputs:outputs}:{})};
    }
  })));
  await writeFile(output,JSON.stringify({generatedAt:new Date().toISOString(),model:process.env.AI_MODEL ?? 'default',note:'Real provider outputs; expectations require human review, not a prediction-accuracy score.',results},null,2)+'\n');
}
console.log(`Saved ${results.length} cases to ${output}. Review overview, card reasoning and message against each expectation.`);
if (results.some(item=>item.error)) process.exitCode=1;
globalThis.fetch=originalFetch;
