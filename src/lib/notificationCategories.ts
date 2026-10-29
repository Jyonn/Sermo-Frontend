export type NotificationTopic = 1|2|3|4|5|6|7|8|9|10|11;
export const notificationCategories = [
  {id:'chat',title:'notification.chatType',hint:'notification.chatTypeHint',icon:'chat',topics:[1,6]},
  {id:'square',title:'notification.squareType',hint:'notification.squareTypeHint',icon:'explore',topics:[2,3,4,5,11]},
  {id:'submission',title:'notification.submissionType',hint:'notification.submissionTypeHint',icon:'article',topics:[7]},
  {id:'research',title:'notification.researchType',hint:'notification.researchTypeHint',icon:'science',topics:[8,9,10]},
] as const;
type NotificationSpaceFeatures = {
  ready:boolean;
  chatEnabled:boolean;
  squareEnabled:boolean;
  submissionEnabled:boolean;
  researchEnabled?:boolean;
};
export function notificationCategoriesForSpace(features:NotificationSpaceFeatures) {
  if (!features.ready) return [];
  const enabled = {
    chat:features.chatEnabled,
    square:features.squareEnabled,
    submission:features.submissionEnabled,
    research:features.researchEnabled === true,
  };
  return notificationCategories.filter(category=>enabled[category.id]);
}
export const notificationTopicLabels:Record<NotificationTopic,string> = {
  1:'notification.messages',2:'notification.statementLikes',3:'notification.statementComments',4:'notification.commentLikes',
  5:'notification.commentReplies',6:'notification.onlineType',7:'notification.submissionActivity',8:'notification.researchTasks',
  9:'notification.researchProgress',10:'notification.researchUpdates',11:'notification.squarePosts',
};
