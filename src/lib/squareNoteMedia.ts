import type {ImageMetadataDTO,SquareStatementDTO,StillfolioCollectionDTO} from '../types';

export interface SquareNotePhoto {uri:string;poster?:string|null;metadata?:ImageMetadataDTO|null;external:boolean}
export function naturalMediaRatio(width?:number|null,height?:number|null){
  return typeof width==='number'&&typeof height==='number'&&Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0?width/height:null;
}
export function squareNotePhotos(statement:SquareStatementDTO,collection?:StillfolioCollectionDTO|null):SquareNotePhoto[]{
  const photos:SquareNotePhoto[]=statement.media.filter(media=>media.kind==='image').map(media=>({uri:media.uri,poster:media.thumbnail_uri,metadata:media.metadata as ImageMetadataDTO|null,external:false}));
  if(!photos.length&&collection) return collection.images.map((uri,index)=>({uri,poster:`${uri}${uri.includes('?')?'&':'?'}thumbnail=1`,metadata:collection.image_metadata?.[index],external:true}));
  return photos;
}
export function squareDetailView(search:string){return new URLSearchParams(search).get('view')==='note'?'note':'classic'}
export function squareStatementSearch(search:string,view:'note'|'classic'){
  const params=new URLSearchParams(search);params.delete('panel');
  if(view==='note')params.set('view','note');else params.delete('view');
  const query=params.toString();return query?`?${query}`:'';
}
