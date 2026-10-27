export type Member = {
    id: number;
    name: string;
};
export type Asset = {
    id: number;
    name: string;
    url: string;
    kind: 'file' | 'link';
};
export type Progress = {
    id: number;
    owner: number;
    body: string;
    at: string;
    images: string[];
    replyTo?: number;
};
export type Task = {
    id: number;
    title: string;
    body: string;
    start: string;
    end: string | null;
    assignees: number[];
    status: 'todo' | 'doing' | 'done';
    assets: Asset[];
    comments: Progress[];
};
export type Meeting = {
    id: number;
    title: string;
    start: string;
    end: string;
    attendees: number[];
    place: string;
    agenda: string;
    minutes: string;
};
export type Milestone = {
    id: number;
    title: string;
    date: string;
    kind: 'deadline' | 'milestone';
};
export type Project = {
    id: number;
    chatId: number;
    title: string;
    description: string;
    status: 'planning' | 'active' | 'completed';
    start: string;
    end: string | null;
    owner: number;
    members: Member[];
    tasks: Task[];
    meetings: Meeting[];
    timeline: Milestone[];
    resources: Asset[];
    messages: {
        id: number;
        owner: number;
        body: string;
    }[];
};
export const mentor = { id: 0, name: '陈知远' };
export const friends = [{ id: 1, name: '林澄' }, { id: 2, name: '周予' }, { id: 3, name: '许知夏' }, { id: 4, name: '沈言' }];
export function createProject(title: string, description: string, start: string, end: string | null, creator: Member, id = Date.now()): Project {
    if (!title.trim() || !validRange(start, end))
        throw new Error('invalid_project');
    return { id, chatId: id + 100000, title: title.trim(), description, start, end, owner: creator.id, status: 'planning', members: [creator], tasks: [], meetings: [], timeline: [], resources: [], messages: [] };
}
export function validRange(start: string, end: string | null) { return Boolean(start && Number.isFinite(Date.parse(start)) && (!end || Number.isFinite(Date.parse(end)) && end >= start)); }
export function inviteMembers(project: Project, members: Member[]) { return { ...project, members: [...new Map([...project.members, ...members].map(member => [member.id, member])).values()] }; }
export function groupFor(project: Project) { return { id: project.chatId, owner: project.owner, members: project.members, title: project.title }; }
export function progressFor(task: Task, viewer: number, scope: 'mine' | 'all') { return task.comments.filter(comment => scope === 'all' || comment.owner === viewer).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id - a.id); }
export function canManageGroupDirectly() { return false; }
export function removeMember(project: Project, id: number) {
    if (id === project.owner)
        throw new Error('transfer_first');
    return { ...project, members: project.members.filter(member => member.id !== id), tasks: project.tasks.map(task => ({ ...task, assignees: task.assignees.filter(assignee => assignee !== id) })) };
}
export function transferProject(project: Project, id: number) {
    if (!project.members.some(member => member.id === id))
        throw new Error('not_a_member');
    return { ...project, owner: id };
}
export function checkImages(existing: number, incoming: number) { return existing + incoming <= 9; }
export function meetingConflict(project: Project, start: string, end: string, members: number[]) {
    return project.meetings.some(meeting => Date.parse(start) < Date.parse(meeting.end) && Date.parse(end) > Date.parse(meeting.start) && meeting.attendees.some(id => members.includes(id)));
}
export const seed: Project[] = [
    { ...createProject('让推荐更懂人的意图', '以可复现实验为起点，探索大语言模型与序列推荐的协同。', '2026-10-12', '2027-05-31', mentor, 1), status: 'active', members: [mentor, ...friends.slice(0, 3)],
        timeline: [{ id: 1, title: '评估协议确认', date: '2026-10-30', kind: 'milestone' }, { id: 2, title: '首轮消融实验', date: '2026-11-20', kind: 'milestone' }, { id: 3, title: 'SIGIR 投稿计划 · 截止占位，待官方确认', date: '2027-01-15', kind: 'deadline' }],
        tasks: [
            { id: 11, title: '复现序列推荐基线', start: '2026-10-12', end: '2026-10-30', status: 'doing', assignees: [1], body: '## 目标\n在 MovieLens-1M 上复现 **SASRec**，固定数据划分与随机种子。\n\n## 交付\n- 可复现脚本与实验配置\n- Recall@20 / NDCG@20 对照\n- 评估协议的差异说明\n\n> 先确认评估协议一致，再尝试改模型。\n\n```python\nseed = 2026\n```', assets: [{ id: 1, name: 'SASRec · 参考实现', kind: 'link', url: 'https://github.com/kang205/SASRec' }], comments: [{ id: 111, owner: 1, body: '完成数据预处理，发现**负采样策略**与论文描述不一致。\n\n下一步：核对评估脚本。', at: '2026-10-27T10:40:00+08:00', images: [] }, { id: 112, owner: 0, replyTo: 111, body: '先整理两种协议的差异，周四一起确认。', at: '2026-10-27T11:20:00+08:00', images: [] }, { id: 113, owner: 2, body: '我补充了相关工作的评估设置，可以一起对照。', at: '2026-10-27T13:00:00+08:00', images: [] }] },
            { id: 12, title: '梳理意图建模相关工作', start: '2026-10-15', end: '2026-11-02', status: 'doing', assignees: [2, 3], body: '按**方法、数据、指标、局限**整理文献对照表。\n\n- 先阅读 8 篇相关论文\n- 提出一个值得验证的假设', assets: [], comments: [{ id: 121, owner: 2, body: '已完成第一轮对照，短序列的意图补全值得继续研究。', at: '2026-10-26T20:15:00+08:00', images: [] }] },
            { id: 13, title: '确定消融实验方案', start: '2026-11-01', end: '2026-11-20', status: 'todo', assignees: [1, 2], body: '对齐实验变量、计算预算和预期结论。', assets: [], comments: [] },
        ],
        meetings: [{ id: 21, title: '本周进展与评估协议讨论', start: '2026-10-29T14:00', end: '2026-10-29T15:00', attendees: [0, 1, 2, 3], place: '计算机楼 402 / 线上', agenda: '1. 基线复现中的协议差异\n2. 相关工作对照\n3. 下周实验分工', minutes: '' }],
        resources: [{ id: 1, name: '课题代码仓库', kind: 'link', url: 'https://github.com/kang205/SASRec' }, { id: 2, name: '文献与实验记录 · 示例链接', kind: 'link', url: 'https://arxiv.org/' }],
        messages: [{ id: 1, owner: 0, body: '周四讨论先聚焦评估协议。个人研究记录不会自动发到群里，需要分享时再手动发送。' }, { id: 2, owner: 1, body: '收到，我会带上两份评估结果。' }],
    },
    { ...createProject('面向长文档的可信问答', '回答的依据，如何被可靠地找到？', '2026-11-01', null, mentor, 2), members: [mentor, friends[2]] },
];
