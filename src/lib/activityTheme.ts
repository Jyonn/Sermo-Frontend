const themes:Record<string,string>={
  'explorer-2026':'explorer',
  'baxian-immortal-force-2026':'baxian',
  'number-duel-2026':'number_duel',
  'main-character-bgm-2026':'bgm',
  'spider-man-4-preview':'spider-man-4',
  'starry-night-five-evenings-2026':'starry-night',
  'permanent-vip-founding-100':'permanent-vip',
};
/** Choose the initial surface before the campaign request completes. */
export function activityThemeForKey(key?:string) {return key?themes[key]??'':'';}
export function activityDrawerClassName(key:string,declaredTheme?:string) {
  const theme=declaredTheme||activityThemeForKey(key);
  const modifier:Record<string,string>={baxian:'is-baxian-activity',explorer:'is-explorer-activity',bgm:'is-bgm-activity','spider-man-4':'is-friendly-neighbor','starry-night':'is-starry-night',number_duel:'is-number-duel-activity','permanent-vip':'vip-activity-drawer'};
  return ['activity-drawer','activity-transparent-header',theme!=='baxian'?'is-custom-activity':'',modifier[theme]??''].filter(Boolean).join(' ');
}
