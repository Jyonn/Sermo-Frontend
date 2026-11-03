import type {ResourceCollectionDTO} from '../types';
export const RESOURCE_CATEGORIES = [
  {id:'activity',icon:'celebration'}, {id:'emoji',icon:'mood'},
  {id:'avatar-frame',icon:'filter_frames'}, {id:'background',icon:'landscape'},
  {id:'profile-card',icon:'id_card'}, {id:'bubble',icon:'chat_bubble'},
  {id:'illustration',icon:'draw'},
] as const;
export type ResourceCategory = ResourceCollectionDTO['category'];
export function resourcesInCategory(rows:ResourceCollectionDTO[],category:ResourceCategory){
  return rows.filter(row=>row.category===category);
}
