import manifest from './activityAssetManifest.json' with {type:'json'};
const assets:Record<string,string>=manifest;
const origins=new Set(['https://sermo.jyonn.space','https://frienden.jyonn.space','https://sermo.6-79.cn','https://frienden.6-79.cn']);
export function activityAsset(value:string) {
  if(assets[value])return assets[value];
  try{const url=new URL(value);if(origins.has(url.origin)&&!url.search&&!url.hash)return assets[url.pathname]??value}catch{/* Relative or external artwork. */}
  return value;
}
