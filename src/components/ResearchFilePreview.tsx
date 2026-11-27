import {useEffect,useState} from 'react';
import {useI18n} from '../lib/language';
import {formatResourceSize,resourceFileLabel,resourceHost} from '../lib/researchResources';
import {QuietState} from './BoundaryState';
import {SideDrawer} from './SideDrawer';
import './ResearchResources.css';

export type ResearchFile={url:string;name:string;mime_type?:string;size?:number|null;link?:boolean};

export function ResearchLocalFilePreview({file,onClose}:{file:File;onClose:()=>void}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{
    const next=URL.createObjectURL(file);
    setUrl(next);
    return()=>URL.revokeObjectURL(next);
  },[file]);
  return url?<ResearchFilePreview file={{url,name:file.name,mime_type:file.type,size:file.size}} onClose={onClose}/>:null;
}

export function ResearchFilePreview({file,onClose}:{file:ResearchFile;onClose:()=>void}) {
  const {t}=useI18n();
  const [failed,setFailed]=useState(false);
  const type=(file.mime_type??'').split(';')[0].toLowerCase();
  const trustedPreview=!file.link&&/^(https?:\/\/|blob:)/i.test(file.url);
  const pdf=type==='application/pdf';
  const image=/^image\/(jpeg|png|gif|webp|avif|bmp|heic|heif)$/.test(type);
  const video=/^video\/(mp4|webm|quicktime)$/.test(type);
  const audio=/^audio\/(mpeg|mp4|wav|aac|ogg|webm|x-wav|x-m4a)$/.test(type);
  const canPreview=trustedPreview&&!failed&&(pdf||image||video||audio);
  return <SideDrawer open showTitle historyKey="research-file-view" className="research-resource-drawer" title={t('researchChronelle.preview')} onClose={onClose}>
    <section className="research-file-preview">
      <header><h3>{file.name||t('resources.open')}</h3><small>{file.link?resourceHost(file.url):[resourceFileLabel(file.name),file.size?formatResourceSize(file.size):''].filter(Boolean).join(' · ')}</small></header>
      {canPreview? <div className="research-preview-stage">
        {image&&<img src={file.url} alt={file.name} onError={()=>setFailed(true)}/>}
        {video&&<video src={file.url} controls playsInline preload="metadata" onError={()=>setFailed(true)}/>}
        {audio&&<audio src={file.url} controls preload="metadata" onError={()=>setFailed(true)}/>}
        {pdf&&<iframe src={file.url} title={file.name} sandbox="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}
      </div>:<QuietState icon={file.link?'link':'description'} title={t(file.link?'researchChronelle.linkPreview':'researchChronelle.fileNoPreview')}/>}
      {/^(https?:\/\/|blob:)/i.test(file.url)&&<a className="button" href={file.url} target="_blank" rel="noopener noreferrer"
        download={file.url.startsWith('blob:')?file.name:undefined}>{t(file.link?'resources.open':'researchChronelle.openFile')}</a>}
    </section>
  </SideDrawer>;
}
