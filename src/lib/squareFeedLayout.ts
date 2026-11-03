import type {SquareStatementDTO} from '../types';
export type SquareFeedLayout='list'|'masonry';
export function squareMediaRatio(width?:number|null,height?:number|null){return width&&height&&Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0?Math.max(2/3,Math.min(3/2,width/height)):.8}
const musicProviders=new Set(['netease_music','qq_music','kugou_music','qishui_music','apple_music','kuwo_music']);
export function squareCover(statement:SquareStatementDTO){
  const images=statement.media.filter(item=>item.kind==='image');
  const media=images.find(item=>item.kind==='image')??statement.media.find(item=>item.kind==='video')??statement.media.find(item=>item.kind==='audio');
  const preview=statement.external_media?.status==='ready'?statement.external_media:null;
  const data=preview?.provider_data as Record<string,unknown>|undefined;
  const provider=typeof data?.provider==='string'?data.provider:'';
  const externalImages=Array.isArray(data?.images)?data.images.filter((uri):uri is string=>typeof uri==='string'&&Boolean(uri)):[];
  const externalCover=typeof data?.cover_url==='string'?data.cover_url:'';
  const music=musicProviders.has(provider),collection=provider==='stillfolio_collection';
  const externalVideo=['douyin_video','xiaohongshu_video'].includes(provider);
  const kind=media?.kind??(music?'music':collection||externalImages.length?'collection':externalVideo?'video':statement.chat_record?'chat':preview?'link':'text');
  const uri=media?.kind==='video'?media.thumbnail_uri:media?.thumbnail_uri||media?.uri;
  const metadata=media?.metadata;
  const width=metadata?.pixel_width,height=metadata?.pixel_height;
  const title=typeof data?.title==='string'?data.title:preview?.title||'';
  const duration=media?.duration_seconds??(typeof data?.duration_ms==='number'?data.duration_ms/1000:null);
  const count=images.length||Math.max(externalImages.length,typeof data?.photo_count==='number'?data.photo_count:0);
  const cover=media?.kind==='audio'?null:uri||externalCover||externalImages[0]||preview?.image_url||null;
  return {uri:cover,fallbackUri:media?.kind==='image'?media.uri:externalImages[0]||preview?.image_url||null,kind,provider,video:kind==='video',count,title,duration,ratio:music?1:squareMediaRatio(width,height)};
}
export function textCoverStyle(id:number,text:string){
  return {theme:Math.abs(id)%4,ratio:text.length>100?.75:text.length>35?.85:1,font:text.length>100?'small':text.length>35?'medium':'large'};
}
export function arrangeSquareColumns(items:SquareStatementDTO[],width:number){
  const count=width>=1100?4:width>=660?3:2;
  const columns:SquareStatementDTO[][]=Array.from({length:count},()=>[]),heights=Array(count).fill(0);
  const cardWidth=(Math.max(280,width)-(count-1)*14)/count;
  for(const item of items){
    const cover=squareCover(item),ratio=cover.uri?cover.ratio:textCoverStyle(item.statement_id,item.text).ratio;
    const column=heights.indexOf(Math.min(...heights));
    columns[column].push(item);heights[column]+=cardWidth/ratio+106;
  }
  return columns;
}
