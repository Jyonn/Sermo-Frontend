export type Status = 'planning' | 'active' | 'completed';
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export type Member = { id: number; name: string; role: 'mentor' | 'student' };
export type Entry = { id: number; owner: number; recipient?: number; kind: 'progress' | 'summary' | 'feedback'; body: string; date: string };
export type Task = { id: number; title: string; description: string; assignees: number[]; deadline: string; status: TaskStatus; entries: Entry[] };
export type Meeting = { id: number; title: string; date: string; place: string; agenda: string; minutes: string };
export type ResearchChat = { id: number; name: string; members: number[]; dedicated?: boolean };
export const chatGroups: ResearchChat[] = [
  { id: 101, name: '推荐系统研究小组', members: [0, 1, 2] },
  { id: 102, name: '周四论文讨论', members: [0, 1, 2, 3] },
  { id: 103, name: '可信问答探索', members: [0, 3] },
];
export type Project = { id: number; title: string; status: Status; description: string; members: Member[]; tasks: Task[]; meetings: Meeting[]; chat?: ResearchChat };
export const friends: Member[] = [{ id: 1, name: '林澄', role: 'student' }, { id: 2, name: '周予', role: 'student' }, { id: 3, name: '许知夏', role: 'student' }, { id: 4, name: '沈言', role: 'student' }];
export const mentor: Member = { id: 0, name: '陈知远', role: 'mentor' };
export const seed: Project[] = [
  { id: 1, title: '让推荐更懂人的意图', status: 'active', description: '探索大语言模型与序列推荐的协同，让每一次推荐都能回应真实的用户意图。', members: [mentor, ...friends.slice(0, 2)], tasks: [
    { id: 11, title: '复现序列推荐基线', description: '在 MovieLens-1M 上复现 SASRec，固定数据划分和随机种子。\n\n交付：可复现脚本、实验配置，以及 Recall@20 / NDCG@20 的结果对照。\n\n先确认评估协议一致，再尝试改模型。', assignees: [1], deadline: '2026-10-30', status: 'doing', entries: [{ id: 111, owner: 1, kind: 'progress', body: '数据预处理已完成。发现原仓库负采样策略与论文描述不一致，正在核对评估脚本。', date: '2026-10-27 10:40' }, { id: 112, owner: 0, recipient: 1, kind: 'feedback', body: '先把两种评估协议的差异整理出来，周四组会一起确认，不急着跑完整实验。', date: '2026-10-27 11:20' }] },
    { id: 12, title: '梳理意图建模相关工作', description: '阅读近两年意图建模与 LLM 推荐相关论文。按方法、数据、指标和局限整理对照表，提出一个值得验证的假设。', assignees: [2], deadline: '2026-10-29', status: 'review', entries: [{ id: 121, owner: 2, kind: 'summary', body: '完成 8 篇论文的对照。现有方法大多依赖长历史，下一步想研究短序列下的意图补全。对照表已整理，等待老师反馈。', date: '2026-10-26 20:15' }] },
    { id: 13, title: '确定消融实验方案', description: '基线稳定后，对齐消融变量、实验预算与预期结论。', assignees: [1, 2], deadline: '2026-11-03', status: 'todo', entries: [] },
    { id: 14, title: '明确研究问题与数据集', description: '完成问题定义，确定 MovieLens-1M 为第一阶段数据集。', assignees: [1, 2], deadline: '2026-10-23', status: 'done', entries: [] },
  ], meetings: [{ id: 21, title: '本周进展与评估协议讨论', date: '2026-10-29T14:00', place: '计算机楼 402 · 线上可加入', agenda: '1. 基线复现遇到的评估差异\n2. 意图建模论文对照\n3. 确定下周的一个关键实验', minutes: '' }] },
  { id: 2, title: '面向长文档的可信问答', status: 'planning', description: '从一个清晰的问题开始：回答的依据，如何被可靠地找到？', members: [mentor, friends[2]], tasks: [], meetings: [] },
  { id: 3, title: '跨域推荐的表示对齐', status: 'completed', description: '阶段成果已归档，研究记录与讨论仍可回看。', members: [mentor, friends[0], friends[1]], tasks: [{ id: 31, title: '完成阶段报告与实验归档', description: '保留实验配置、报告和后续问题。', assignees: [1, 2], deadline: '2026-09-30', status: 'done', entries: [] }], meetings: [] },
];
export function visibleEntries(task: Task, viewer: number, isMentor: boolean) {
  return task.entries.filter(entry => isMentor || entry.owner === viewer || (entry.kind === 'feedback' && entry.recipient === viewer));
}
export function canWrite(project: Project) { return project.status !== 'completed'; }
export function visibleTasks(project: Project, status: TaskStatus | 'all') {
  return project.tasks.filter(task => status === 'all' || task.status === status);
}
export function canLinkChat(project: Project, chat: ResearchChat) {
  const creator = project.members.find(member => member.role === 'mentor');
  return Boolean(creator && chat.members.includes(creator.id));
}
