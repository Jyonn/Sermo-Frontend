import {StickerImage} from './StickerImage';

export function StickerPickerItem({src,staticSrc,description,busy,onClick}:{src:string;staticSrc?:string;description?:string;busy:boolean;onClick:()=>void}) {
  return <button className={`composer-sticker-item${description?' has-description':''}`} type="button" disabled={busy} aria-label={description} title={description} onClick={onClick}>
    <picture className="sticker-item-art">{staticSrc?<source media="(prefers-reduced-motion: reduce)" srcSet={staticSrc}/>:null}<StickerImage src={src}/></picture>
    {description?<span className="sticker-item-description">{description}</span>:null}
  </button>;
}
