// This allowance belongs to CSSOM serialization and computed-style readback.
// Requested text enlargement remains exactly twice its measured baseline.
export const CSS_FONT_READBACK_PRECISION_PX=0.001;

const positive=value=>Number.isFinite(value)&&value>0;
const near=(actual,requested)=>Math.abs(actual-requested)<=CSS_FONT_READBACK_PRECISION_PX;

export function isDoubledFontReadback(reading){
  if(!reading||typeof reading!=='object')return false;
  const {before,requested,authored,inline,actual}=reading;
  if(!positive(before)||!positive(requested)||!positive(actual))return false;
  if(requested!==before*2||authored!==requested+'px'||actual<=before)return false;
  if(typeof inline!=='string')return false;
  const length=/^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)px$/i.exec(inline);
  if(!length)return false;
  const inlineSize=Number(length[1]);
  return positive(inlineSize)&&near(inlineSize,requested)&&near(actual,requested);
}
