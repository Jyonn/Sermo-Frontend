/** Home must never point at a space feature which is disabled. */
export function availableAppHome(features:{chatEnabled:boolean;squareEnabled:boolean}) {
  return features.chatEnabled?'/app/chats':features.squareEnabled?'/app/square':'/app/menu';
}
