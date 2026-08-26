export interface MentionIdentity {
  user_id: number;
  name: string;
}

export function formatMentionTokens(text: string, mentions: MentionIdentity[], trailingSpace = false) {
  const names = new Map(mentions.map((user) => [user.user_id, user.name]));
  return text.replace(/<@(\d+)>/g, (_, userId: string) => {
    const mention = `@${names.get(Number(userId)) || userId}`;
    return trailingSpace ? `${mention} ` : mention;
  });
}
