import type {ReleaseNotes} from './pwaUpdate';

export function localizedReleaseNotes(release:ReleaseNotes|null|undefined,language:string){
  if(!release)return null;
  for(const locale of [language,language.startsWith('zh')?'zh-CN':'en','en','zh-CN']){
    const notes=release.locales[locale];
    if(notes&&typeof notes.title==='string'&&Array.isArray(notes.items)){
      const items=notes.items.filter(item=>typeof item==='string'&&item.trim());
      if(items.length)return {title:notes.title,items};
    }
  }
  return null;
}
