// One finite static default table, from the existing equations and HTML defaults.
// Default/check mode is read-only. --write updates only the marked wind.html block.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {MPH,FOOT,samplePassage} from '../web/wind-model.mjs';
import {componentHistory} from '../web/component-model.mjs';
import {renderSampleSection} from '../web/passage-values.mjs';

export const start='<!-- BEGIN GENERATED WIND SAMPLES -->';
export const end='<!-- END GENERATED WIND SAMPLES -->';
export function defaultExperiment(html) {
  const value=id=>{
    const matches=[...html.matchAll(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`, 'g'))];
    if(matches.length!==1)throw new Error(`One default input required: ${id}`);
    const number=Number(matches[0][0].match(/\bvalue="([^"]+)"/)?.[1]);
    if(!Number.isFinite(number))throw new Error(`Finite default required: ${id}`);
    return number;
  };
  const field={peak:value('peak')*MPH,radius:value('radius')*FOOT,background:value('background')*MPH,
    travel:value('travel')*MPH,offset:value('offset'),area:value('area'),coefficient:value('coefficient')};
  const threshold=value('threshold')*MPH,capacity=value('capacity')*1000;
  const result=samplePassage(field,{threshold});
  const component=componentHistory(result.samples,{...field,capacity});
  return {field,threshold,capacity,result,component};
}
export function generatedBlock(html) {
  return start+'\n'+renderSampleSection(defaultExperiment(html))+'\n'+end;
}
export function replaceBlock(html) {
  if(html.split(start).length!==2 || html.split(end).length!==2)throw new Error('One ordered generated block required');
  const a=html.indexOf(start),b=html.indexOf(end);
  if(b<a)throw new Error('Reversed generated markers');
  return html.slice(0,a)+generatedBlock(html)+html.slice(b+end.length);
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  const args=process.argv.slice(2);
  if(args.length>1 || (args.length===1 && !['--check','--write'].includes(args[0])))throw new Error('Use --check or --write');
  const path=new URL('../web/wind.html',import.meta.url);
  const html=await readFile(path,'utf8'),built=replaceBlock(html);
  if(args[0]==='--write')await writeFile(path,built,'utf8');
  else if(built!==html)throw new Error('Static wind samples differ from the current defaults and calculations');
  console.log('Complete default wind table matches 481 existing samples.');
}
