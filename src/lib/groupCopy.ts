export interface CopySuggestion {
  message_id: number;
  content: string;
  author: string;
  created_at: number;
  copied: boolean;
}

export const GROUP_COPY_EVENT = "frienden:group-copy";
export const GROUP_COPY_REMOVED = "frienden:group-copy-removed";

export function orderCopySuggestions(items: CopySuggestion[], now = Date.now()) {
  return items.filter(item => item.created_at * 1000 + 86400000 > now)
    .map((item, index) => ({item,index}))
    .sort((a,b) => Number(a.item.copied)-Number(b.item.copied) || a.index-b.index)
    .map(({item})=>item);
}

export function copySuggestionHint(items: CopySuggestion[], previous: {day?:string; ids?:number[]} | null, day: string) {
  return previous?.day !== day && items.some(item => !item.copied && !previous?.ids?.includes(item.message_id));
}
