const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  folderGroups: { json: new Map(), md: new Map() },
  jsonFiles: [],
  mdFiles: [],
  users: [],
  posts: [],
  comments: [],
  reviews: [],
  anomalies: [],
  aliases: new Map(),
  mdStats: { posts: 0, comments: 0 },
  activeTable: "users",
  tablePage: 1,
  reviewFilter: "pending",
  activeReviewKind: "targets",
  importLabel: "",
  compatibilityIssues: [],
  compatibilityScope: "all",
  compatibilitySeverity: "all",
  compatibilityPage: 1,
};

const tableColumns = {
  users: ["qq", "nickname"],
  posts: ["id", "source_post_id", "author_qq", "content_raw", "content_text", "published_at", "visibility", "media", "source_payload", "created_at", "updated_at"],
  comments: ["id", "post_id", "author_qq", "parent_comment_id", "reply_to_qq", "content_raw", "published_at", "source_payload", "created_at", "updated_at"],
};

const elements = {
  jsonInput: $("#jsonInput"),
  mdInput: $("#mdInput"),
  bundleInput: $("#bundleInput"),
  jsonFolderList: $("#jsonFolderList"),
  mdFolderList: $("#mdFolderList"),
  processButton: $("#processButton"),
  progressTrack: $("#progressTrack"),
  progressFill: $("#progressFill"),
  progressText: $("#progressText"),
  workspace: $("#workspace"),
  reviewList: $("#reviewList"),
  reviewHeading: $("#reviewHeading"),
  reviewSubbar: $("#reviewSubbar"),
  createAnomaly: $("#createAnomaly"),
  dataTable: $("#dataTable"),
  tableSearch: $("#tableSearch"),
  pagination: $("#pagination"),
  auditList: $("#auditList"),
  auditPagination: $("#auditPagination"),
  auditSearch: $("#auditSearch"),
  toast: $("#toast"),
};

const compatibilityScopes = {
  all: "全部问题",
  identity: "身份",
  text: "正文",
  media: "媒体",
  reply: "回复关系",
  visibility: "可见范围",
};

const severityMeta = {
  blocker: { label: "阻断", description: "当前结构或校验无法直接入库" },
  adapt: { label: "需适配", description: "增加通用模型能力后可以保真" },
  lossy: { label: "会失真", description: "可入库，但展示语义会退化" },
};

const mappedOperatorQQs = new Set(["1493732945", "2485931633"]);

function relativePath(file) {
  return String(file.webkitRelativePath || file.name).replaceAll("\\", "/");
}

function locateArchiveFiles(kind, files) {
  const matches = [];
  [...files].forEach((file) => {
    const path = relativePath(file);
    const parts = path.split("/");
    const messagesIndex = parts.lastIndexOf("Messages");
    if (messagesIndex < 0) return;

    const isHtmlData = parts[messagesIndex + 1]?.toLowerCase() === "json"
      && parts[messagesIndex + 2]?.toLowerCase() === "messages.json"
      && messagesIndex + 3 === parts.length;
    const isMarkdownData = /^\d{4}\.md$/i.test(parts[messagesIndex + 1] || "")
      && messagesIndex + 2 === parts.length;
    if ((kind === "json" && !isHtmlData) || (kind === "md" && !isMarkdownData)) return;

    const archiveName = messagesIndex > 0 ? parts[messagesIndex - 1] : "Messages";
    matches.push({ file, archiveName, relativePath: path });
  });

  if (kind !== "json") return matches;
  const namedHtmlArchives = matches.filter((entry) => /html$/i.test(entry.archiveName));
  return namedHtmlArchives.length ? namedHtmlArchives : matches;
}

function syncSelectedFiles(kind) {
  state[`${kind}Files`] = [...state.folderGroups[kind].values()]
    .flatMap((group) => group.files)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-CN"));
}

function renderFolderSelection(kind) {
  const groups = [...state.folderGroups[kind].values()];
  const entries = state[`${kind}Files`];
  const list = elements[`${kind}FolderList`];
  const label = $(`#${kind}FileLabel`);
  list.hidden = groups.length === 0;
  list.innerHTML = groups.map((group) => `
    <div class="folder-chip${kind === "md" ? " secondary" : ""}">
      <span class="folder-glyph">DIR</span>
      <span class="folder-copy">
        <strong>${escapeHtml(group.name)}</strong>
        <small>${group.files.length} 个目标文件 · ${formatBytes(group.files.reduce((sum, entry) => sum + entry.file.size, 0))}</small>
      </span>
      <button class="folder-remove" type="button" data-remove-folder="${escapeHtml(group.name)}" data-folder-kind="${kind}" aria-label="移除 ${escapeHtml(group.name)}">×</button>
    </div>`).join("");

  if (!entries.length) {
    label.textContent = kind === "json" ? "可重复添加，自动寻找 messages.json" : "可重复添加，自动收集年份 Markdown";
    return;
  }
  const totalSize = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  label.textContent = `${groups.length} 个文件夹 · ${entries.length} 个文件 · ${formatBytes(totalSize)}`;
}

function addFolderFiles(kind, files) {
  const matches = locateArchiveFiles(kind, files);
  if (!matches.length) {
    const expected = kind === "json" ? "Messages/json/messages.json" : "Messages/YYYY.md";
    showToast(`没有找到 ${expected}`);
    return;
  }

  const discovered = new Map();
  matches.forEach((entry) => {
    if (!discovered.has(entry.archiveName)) discovered.set(entry.archiveName, []);
    discovered.get(entry.archiveName).push(entry);
  });
  discovered.forEach((entries, name) => {
    const uniqueEntries = [...new Map(entries.map((entry) => [entry.relativePath, entry])).values()]
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-CN"));
    state.folderGroups[kind].set(name, { name, files: uniqueEntries });
  });

  syncSelectedFiles(kind);
  renderFolderSelection(kind);
  elements.processButton.disabled = state.jsonFiles.length === 0;
  showToast(`已加入 ${discovered.size} 个${kind === "json" ? " HTML" : " Markdown"} 文件夹`);
}

function formatBytes(value) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function setProgress(value, text) {
  elements.progressTrack.hidden = false;
  elements.progressFill.style.width = `${value}%`;
  elements.progressText.textContent = text;
}

function itemAuthor(item) {
  if (item?.poster) return { qq: String(item.poster.id ?? ""), nickname: item.poster.name ?? "" };
  return { qq: String(item?.uin ?? ""), nickname: item?.name ?? "" };
}

function formatEpoch(epoch) {
  if (!epoch) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Number(epoch) * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function itemTime(item) {
  return item?.createTime2 || formatEpoch(item?.postTime ?? item?.create_time);
}

function cleanContent(content = "") {
  return String(content)
    .replace(/@\{uin:\d+,nick:([^,}]+),who:\d+(?:,auto:\d+)?\}/g, "@$1")
    .replace(/\[em\]e(\d+)\[\/em\]/g, "[表情 e$1]")
    .replace(/\\#/g, "#");
}

function parseJsonField(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function mediaLocalPath(item) {
  return item?.custom_filepath || item?.local_path || item?.filepath || "";
}

function mediaRemoteUrl(item) {
  return item?.custom_url || item?.url || item?.playurl || item?.url2 || item?.url1 || "";
}

function addCompatibilityIssue(issues, issue) {
  issues.push({
    id: `${issue.code}-${issue.entityType}-${issue.recordId}-${issues.length}`,
    ...issue,
  });
}

function analyzeCompatibility() {
  const issues = [];
  const usersByQQ = new Map(state.users.map((user) => [String(user.qq), user]));
  const postsById = new Map(state.posts.map((post) => [Number(post.id), post]));
  const commentsById = new Map(state.comments.map((comment) => [Number(comment.id), comment]));
  const nicknameGroups = new Map();

  state.users.forEach((user) => {
    const nickname = String(user.nickname || "").trim();
    if (nickname) {
      if (!nicknameGroups.has(nickname)) nicknameGroups.set(nickname, []);
      nicknameGroups.get(nickname).push(user);
    }
    if (!nickname) {
      addCompatibilityIssue(issues, {
        code: "blank-nickname", severity: "adapt", scope: "identity", entityType: "user", entityLabel: "QQ 用户",
        recordId: user.qq, authorQQ: user.qq, authorName: user.nickname || "", content: "该 QQ 没有可用昵称",
        title: "外部身份缺少展示名称",
        explanation: "Sermo 用户必须有名称，不能把这条 QQ 身份直接创建为普通用户。",
        suggestion: "外部身份表允许展示名称为空，并在界面使用“QQ 用户 + 尾号”兜底。",
        fieldFrom: "qzone_user.nickname", fieldTo: "User.name（必填）", source: user,
      });
    }
    if (nickname.length > 20) {
      addCompatibilityIssue(issues, {
        code: "long-nickname", severity: "adapt", scope: "identity", entityType: "user", entityLabel: "QQ 用户",
        recordId: user.qq, authorQQ: user.qq, authorName: user.nickname || "", content: nickname,
        title: `昵称超过 User.name 的 20 字限制（${nickname.length} 字）`,
        explanation: "直接创建 Sermo 用户会触发字段长度限制，截断后还可能与其他昵称冲突。",
        suggestion: "将原昵称完整保存在外部身份，Sermo 账号认领后再由用户选择站内名称。",
        fieldFrom: "qzone_user.nickname", fieldTo: "User.name · max 20", source: user,
      });
    }
  });

  nicknameGroups.forEach((users, nickname) => {
    if (users.length < 2) return;
    users.forEach((user) => addCompatibilityIssue(issues, {
      code: "duplicate-nickname", severity: "adapt", scope: "identity", entityType: "user", entityLabel: "QQ 用户",
      recordId: user.qq, authorQQ: user.qq, authorName: user.nickname || "", content: nickname,
      context: `同名 QQ：${users.map((item) => item.qq).join("、")}`,
      title: `昵称“${nickname}”不能作为唯一身份`,
      explanation: `共有 ${users.length} 个 QQ 使用这个最新昵称，不能依靠名称关联 Sermo 用户。`,
      suggestion: "始终以 QQ 号作为外部身份主键，昵称只用于展示和搜索。",
      fieldFrom: "qzone_user.qq + nickname", fieldTo: "外部身份 provider + external_id", source: user,
    }));
  });

  state.posts.forEach((post) => {
    const rawText = String(post.content_raw || "");
    const displayText = String(post.content_text || rawText);
    const media = parseJsonField(post.media, []);
    const base = {
      entityType: "post", entityLabel: "说说", recordId: post.id, postId: post.id,
      authorQQ: String(post.author_qq || ""), authorName: usersByQQ.get(String(post.author_qq))?.nickname || "",
      publishedAt: post.published_at, content: displayText, media, source: post,
    };

    if (displayText.length > 140) addCompatibilityIssue(issues, {
      ...base, code: "post-text-limit", severity: "blocker", scope: "text",
      title: `说说正文超过 140 字（${displayText.length} 字）`,
      explanation: "Statement.text 和正常发帖校验都限制为 140 字，当前内容会被拒绝。",
      suggestion: "迁移内容改用可容纳全文的字段；普通用户发帖仍在接口层保持 140 字限制。",
      fieldFrom: "qzone_post.content_text", fieldTo: "Statement.text · max 140",
    });
    if (post.visibility === "private") addCompatibilityIssue(issues, {
      ...base, code: "private-post", severity: "blocker", scope: "visibility",
      title: "QQ 私密说说没有等价可见范围",
      explanation: "Sermo 只有公开和好友可见；好友可见不等于 QQ 私密或仅自己可见。",
      suggestion: "迁移前明确选择：不导入、仅管理员可见，或新增仅自己可见策略。",
      fieldFrom: "qzone_post.visibility = private", fieldTo: "Statement.visibility = PUBLIC / FRIENDS",
    });
    if (!displayText.trim() && media.length === 0) addCompatibilityIssue(issues, {
      ...base, code: "empty-post", severity: "blocker", scope: "text", content: "（正文与媒体均为空）",
      title: "说说主体为空",
      explanation: "这类记录可能只剩评论或来源信息，Sermo 广场没有可展示的主体。",
      suggestion: "结合原始负载复核；确认不可恢复后可跳过主体并单独归档评论。",
      fieldFrom: "content_text + media", fieldTo: "Statement 展示主体",
    });
    if (media.length > 9) addCompatibilityIssue(issues, {
      ...base, code: "post-media-limit", severity: "blocker", scope: "media",
      title: `图片/媒体超过单条上限（${media.length} 项）`,
      explanation: "Sermo 正常广场发帖最多接收 9 张图片，当前关系和展示没有覆盖更多媒体。",
      suggestion: "为历史导入放宽关联数量并验证多图布局，或拆分为连续历史说说。",
      fieldFrom: "qzone_post.media", fieldTo: "StatementMedia · normal max 9",
    });

    const unsupported = media.filter((item) => ["audio", "voice", "magic"].includes(item.type));
    if (unsupported.length) addCompatibilityIssue(issues, {
      ...base, code: "unsupported-post-media", severity: "blocker", scope: "media", media: unsupported,
      title: `包含 Sermo 无法等价表达的 ${unsupported.map((item) => item.type).join(" / ")}`,
      explanation: unsupported.some((item) => item.type === "audio") ? "导出中的 audio 是 QQ 音乐分享卡片，不是可播放的语音资源。" : "该 QQ 空间媒体类型没有对应的广场媒体模型。",
      suggestion: "音乐分享应迁移为独立链接/音乐卡片，不要伪装成语音；其他类型保留来源负载。",
      fieldFrom: "qzone_post.media[].type", fieldTo: "StatementMedia · image / video / audio",
    });

    const missingLocal = media.filter((item) => !mediaLocalPath(item));
    if (missingLocal.length) addCompatibilityIssue(issues, {
      ...base, code: "remote-only-media", severity: "blocker", scope: "media", media: missingLocal,
      title: `${missingLocal.length} 项媒体没有本地文件`,
      explanation: "记录中只有旧的远程播放器或资源地址，无法直接上传为 Sermo MediaAsset。",
      suggestion: "迁移前重新下载或人工确认资源已永久丢失；不要写入失效的 MediaAsset。",
      fieldFrom: "media[].custom_filepath", fieldTo: "MediaAsset.source_key",
    });
    const placeholders = media.filter((item) => /404_16x9\.mp4/i.test(mediaRemoteUrl(item)));
    if (placeholders.length) addCompatibilityIssue(issues, {
      ...base, code: "placeholder-video", severity: "blocker", scope: "media", media: placeholders,
      title: "本地视频实际指向 QQ 404 占位资源",
      explanation: "文件名存在不代表原视频有效；这一项不能作为真实历史视频迁入。",
      suggestion: "尝试从其他备份找回原视频，否则在历史说说中显示“视频已遗失”。",
      fieldFrom: "media[].url", fieldTo: "MediaAsset 视频源文件",
    });
    if (/\[em\]e\d+\[\/em\]/i.test(rawText)) addCompatibilityIssue(issues, {
      ...base, code: "post-emoji", severity: "lossy", scope: "text",
      title: "QQ 表情会退化为普通文字",
      explanation: "Sermo 没有 QQ 表情编号到本站表情资源的映射。",
      suggestion: "建立 QQ 表情字典；未知编号保留可读占位文本。",
      fieldFrom: "qzone_post.content_raw · [em]", fieldTo: "Statement.text / sticker",
    });
    if (/@\{uin:\d+,nick:/i.test(rawText)) addCompatibilityIssue(issues, {
      ...base, code: "post-mention", severity: "lossy", scope: "text",
      title: "说说中的 QQ 提及没有站内语义",
      explanation: "直接保存正文只能显示 @昵称，不能关联外部 QQ 身份或触发站内提及。",
      suggestion: "解析为外部身份提及实体，并保留原始 QQ 号。",
      fieldFrom: "qzone_post.content_raw · @{uin}", fieldTo: "Statement mention（当前不存在）",
    });
  });

  state.comments.forEach((comment) => {
    if (comment._deleted) return;
    const rawText = String(comment.content_raw || "");
    const payload = parseJsonField(comment.source_payload, {});
    const pictures = Array.isArray(payload.pic) ? payload.pic : [];
    const parent = comment.parent_comment_id === "" ? null : commentsById.get(Number(comment.parent_comment_id));
    const post = postsById.get(Number(comment.post_id));
    const base = {
      entityType: "comment", entityLabel: parent ? "回复" : "评论", recordId: comment.id, postId: comment.post_id,
      authorQQ: String(comment.author_qq || ""), authorName: usersByQQ.get(String(comment.author_qq))?.nickname || "",
      publishedAt: comment.published_at, content: rawText || (pictures.length ? "（仅包含图片）" : "（空评论）"),
      context: post?.content_text || post?.content_raw || "", source: comment,
    };

    if (!mappedOperatorQQs.has(String(comment.author_qq))) {
      addCompatibilityIssue(issues, {
        ...base, code: "external-comment-author", severity: "adapt", scope: "identity",
        title: "QQ 评论者不是 Sermo 用户",
        explanation: "StatementComment.user 当前为必填 User 外键，无法保存未注册的 QQ 评论者。东西墙运营 QQ 已排除在此问题之外。",
        suggestion: "评论作者支持通用外部身份；用户验证 QQ 邮箱后再认领历史身份。",
        fieldFrom: `qzone_comment.author_qq = ${comment.author_qq}`, fieldTo: "StatementComment.user（必填）",
      });
    }
    if (rawText.length > 140) addCompatibilityIssue(issues, {
      ...base, code: "comment-text-limit", severity: "blocker", scope: "text",
      title: `评论正文超过 140 字（${rawText.length} 字）`,
      explanation: "StatementComment.text 不能容纳完整原文。",
      suggestion: "历史迁移评论使用长文本字段，正常发表评论仍由接口限制长度。",
      fieldFrom: "qzone_comment.content_raw", fieldTo: "StatementComment.text · max 140",
    });
    if (pictures.length) addCompatibilityIssue(issues, {
      ...base, code: "comment-picture", severity: "adapt", scope: "media", media: pictures,
      title: `评论包含 ${pictures.length} 张普通图片`,
      explanation: "StatementComment 只支持文字或收藏表情，StickerAsset 不能代替任意历史图片。",
      suggestion: "增加评论媒体关系并复用 MediaAsset，保留原图顺序。",
      fieldFrom: "source_payload.pic", fieldTo: "StatementComment media（当前不存在）",
    });
    const replyTarget = String(comment.reply_to_qq || "");
    const isExplicitNonParentTarget = replyTarget && (!parent || replyTarget !== String(parent.author_qq));
    if (isExplicitNonParentTarget) addCompatibilityIssue(issues, {
      ...base, code: "explicit-reply-target", severity: "adapt", scope: "reply",
      title: parent ? "回复目标不是父评论作者" : "一级评论直接回复了某位 QQ 用户",
      explanation: parent ? `当前 Sermo 会显示为回复 ${parent.author_qq}，但原始目标是 ${replyTarget}。` : `一级评论没有父评论，当前模型无法表达其回复目标 ${replyTarget}。`,
      suggestion: "为评论增加独立的外部回复目标，不能继续只从 parent.user 推导。",
      fieldFrom: `qzone_comment.reply_to_qq = ${replyTarget}`, fieldTo: "StatementComment.reply_to_user（当前为推导值）",
    });
    if (/\[em\]e\d+\[\/em\]/i.test(rawText)) addCompatibilityIssue(issues, {
      ...base, code: "comment-emoji", severity: "lossy", scope: "text",
      title: "评论中的 QQ 表情会退化为普通文字",
      explanation: "当前只能保留表情编号占位，无法还原视觉表情。",
      suggestion: "与说说正文共用 QQ 表情字典和降级规则。",
      fieldFrom: "qzone_comment.content_raw · [em]", fieldTo: "StatementComment.text / sticker",
    });
    if (/@\{uin:\d+,nick:/i.test(rawText)) addCompatibilityIssue(issues, {
      ...base, code: "comment-mention", severity: "lossy", scope: "text",
      title: "评论中的 QQ 提及会失去可点击身份",
      explanation: "纯文本替换可以保留昵称，但无法关联被提及的外部 QQ 用户。",
      suggestion: "将结构化 QQ 提及解析为外部身份 mention，而不是只清洗成 @昵称。",
      fieldFrom: "qzone_comment.content_raw · @{uin}", fieldTo: "StatementCommentMention（仅支持 Sermo User）",
    });
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(rawText)) addCompatibilityIssue(issues, {
      ...base, code: "control-character", severity: "lossy", scope: "text",
      title: "正文包含不可见控制字符",
      explanation: "控制字符可能造成 JSON、搜索或前端排版异常。",
      suggestion: "保留原始负载，同时在展示正文中移除不可见控制字符。",
      fieldFrom: "qzone_comment.content_raw", fieldTo: "StatementComment.text",
    });
  });

  state.compatibilityIssues = issues;
  state.compatibilityPage = 1;
}

function parseStructuredTarget(content = "") {
  const match = String(content).match(/@\{uin:(\d+),nick:([^,}]+),who:\d+(?:,auto:\d+)?\}/);
  return match ? { qq: match[1], nickname: match[2] } : null;
}

function findMalformedMentions(content = "") {
  const tokens = String(content).match(/@\{uin:[^}]*\}/g) || [];
  return tokens.filter((token) => !/^@\{uin:\d+,nick:[^,}]+,who:\d+(?:,auto:\d+)?\}$/.test(token));
}

function malformedMentionFields(token = "") {
  return {
    qq: token.match(/uin:(\d+)/)?.[1] || "",
    nickname: token.match(/nick:([^,}]*)/)?.[1] || "",
  };
}

function parsePlainLeadingMention(content = "") {
  const text = cleanContent(content).trim();
  const match = text.match(/^@([^\s，,。！？!?：:]{1,30})/u);
  return match ? match[1] : "";
}

function withoutKeys(value, keys) {
  const copy = { ...value };
  keys.forEach((key) => delete copy[key]);
  return copy;
}

function mediaFromPost(post) {
  const groups = [
    ["image", post.custom_images],
    ["video", post.custom_videos],
    ["voice", post.custom_voices],
    ["audio", post.custom_audios],
    ["magic", post.custom_magics],
  ];
  return groups.flatMap(([type, items]) => Array.isArray(items) ? items.map((item) => ({ type, ...item })) : []);
}

function observeUser(observations, aliases, author, timestamp) {
  if (!author.qq) return;
  const time = timestamp || "0000-00-00 00:00:00";
  const current = observations.get(author.qq);
  if (!current || time >= current.time) observations.set(author.qq, { qq: author.qq, nickname: author.nickname || current?.nickname || "", time });
  if (!aliases.has(author.qq)) aliases.set(author.qq, new Set());
  if (author.nickname) aliases.get(author.qq).add(author.nickname);
}

function buildTables(sources) {
  const generatedAt = new Date().toISOString();
  const rawPosts = [];
  const seenPosts = new Set();

  sources.forEach(({ posts, filename }) => {
    posts.forEach((post, sourceIndex) => {
      const author = itemAuthor(post);
      const sourceId = String(post.tid ?? post.uniKey ?? `${filename}:${sourceIndex}`);
      const key = `${author.qq}:${sourceId}`;
      if (seenPosts.has(key)) return;
      seenPosts.add(key);
      rawPosts.push({ post, author, sourceId, filename, sourceIndex });
    });
  });

  rawPosts.sort((a, b) => String(a.post.custom_create_time || formatEpoch(a.post.created_time)).localeCompare(String(b.post.custom_create_time || formatEpoch(b.post.created_time))) || a.sourceId.localeCompare(b.sourceId));

  const observations = new Map();
  const aliases = new Map();
  const posts = [];
  const comments = [];
  const reviewSeeds = [];
  let nextCommentId = 1;

  rawPosts.forEach(({ post, author, sourceId, filename }, postOffset) => {
    const postId = postOffset + 1;
    const publishedAt = post.custom_create_time || formatEpoch(post.created_time);
    observeUser(observations, aliases, author, publishedAt);

    posts.push({
      id: postId,
      source_post_id: sourceId,
      author_qq: author.qq,
      content_raw: post.custom_content ?? post.content ?? "",
      content_text: cleanContent(post.custom_content ?? post.content ?? ""),
      published_at: publishedAt,
      visibility: post.secret || post.right === 0 ? "private" : "public",
      media: JSON.stringify(mediaFromPost(post)),
      source_payload: JSON.stringify({ source_file: filename, ...withoutKeys(post, ["custom_comments", "likes", "custom_images", "custom_videos", "custom_voices", "custom_audios", "custom_magics"]) }),
      created_at: generatedAt,
      updated_at: generatedAt,
    });

    (post.custom_comments || []).forEach((root, rootIndex) => {
      const rootAuthor = itemAuthor(root);
      const rootTime = itemTime(root);
      observeUser(observations, aliases, rootAuthor, rootTime);
      const rootTarget = parseStructuredTarget(root.content);
      if (rootTarget) observeUser(observations, aliases, rootTarget, rootTime);
      const rootId = nextCommentId++;
      comments.push({
        id: rootId,
        post_id: postId,
        author_qq: rootAuthor.qq,
        parent_comment_id: "",
        reply_to_qq: rootTarget?.qq || "",
        content_raw: root.content ?? "",
        published_at: rootTime,
        source_payload: JSON.stringify({ source_file: filename, source_root_index: rootIndex, ...withoutKeys(root, ["list_3", "replies"]) }),
        created_at: generatedAt,
        updated_at: generatedAt,
        _deleted: false,
      });

      const replies = root.list_3 || root.replies || [];
      replies.forEach((reply, replyIndex) => {
        const replyAuthor = itemAuthor(reply);
        const replyTime = itemTime(reply);
        observeUser(observations, aliases, replyAuthor, replyTime);
        const target = parseStructuredTarget(reply.content);
        if (target) observeUser(observations, aliases, target, replyTime);
        const plainMention = target ? "" : parsePlainLeadingMention(reply.content);
        const inferredRootTarget = !target && !plainMention && replyAuthor.qq !== rootAuthor.qq ? rootAuthor.qq : "";
        const commentId = nextCommentId++;
        comments.push({
          id: commentId,
          post_id: postId,
          author_qq: replyAuthor.qq,
          parent_comment_id: rootId,
          reply_to_qq: target?.qq || inferredRootTarget,
          content_raw: reply.content ?? "",
          published_at: replyTime,
          source_payload: JSON.stringify({ source_file: filename, source_root_index: rootIndex, source_reply_index: replyIndex, ...reply }),
          created_at: generatedAt,
          updated_at: generatedAt,
          _deleted: false,
        });

        if (plainMention) {
          reviewSeeds.push({
            id: `review-${commentId}`,
            commentId,
            postId,
            mention: plainMention,
            rootAuthor,
            rootContent: root.content ?? "",
            replyAuthor,
            replyContent: reply.content ?? "",
            publishedAt: replyTime,
            status: "pending",
            resolution: null,
          });
        }
      });
    });
  });

  state.aliases = aliases;
  state.users = [...observations.values()].sort((a, b) => a.qq.localeCompare(b.qq)).map(({ qq, nickname }) => ({ qq, nickname }));
  state.posts = posts;
  state.comments = comments;
  state.reviews = reviewSeeds.map((review) => ({ ...review, candidates: rankCandidates(review, observations, aliases) }));
  state.anomalies = buildAnomalies(comments);
}

function buildAnomalies(comments) {
  const anomalies = [];
  comments.forEach((comment) => {
    findMalformedMentions(comment.content_raw).forEach((token, tokenIndex) => {
      const fields = malformedMentionFields(token);
      anomalies.push({
        id: `anomaly-${comment.id}-${tokenIndex}`,
        commentId: comment.id,
        postId: comment.post_id,
        token,
        originalToken: token,
        originalContent: comment.content_raw,
        qq: fields.qq,
        nickname: fields.nickname,
        status: "pending",
        resolution: null,
        createdManually: false,
      });
    });
  });
  return anomalies;
}

function rankCandidates(review, observations, aliases) {
  const needle = review.mention.toLocaleLowerCase();
  return [...observations.values()].map((user) => {
    const names = [...(aliases.get(user.qq) || [])];
    let score = 0;
    names.forEach((name) => {
      const normalized = name.toLocaleLowerCase();
      if (normalized === needle) score = Math.max(score, 100);
      else if (normalized.includes(needle) || needle.includes(normalized)) score = Math.max(score, 70);
    });
    if (score > 0 && user.qq === review.rootAuthor.qq) score += 12;
    return { qq: user.qq, nickname: user.nickname, aliases: names, score };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score || a.qq.localeCompare(b.qq)).slice(0, 12);
}

function parseMarkdown(filesText) {
  let posts = 0;
  let comments = 0;
  filesText.forEach((text) => {
    posts += (text.match(/^### \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/gm) || []).length;
    comments += (text.match(/^\s*- \[.*?\]\(https:\/\/user\.qzone\.qq\.com\/\d+\)（\d{4}-\d{2}-\d{2} \d{2}:\d{2}）：/gm) || []).length;
  });
  state.mdStats = { posts, comments };
}

async function processFiles() {
  elements.processButton.disabled = true;
  setProgress(8, "正在读取 HTML 数据…");
  try {
    const sources = [];
    for (let index = 0; index < state.jsonFiles.length; index += 1) {
      const entry = state.jsonFiles[index];
      const file = entry.file;
      const text = await file.text();
      setProgress(15 + Math.round((index / state.jsonFiles.length) * 35), `正在解析 ${entry.archiveName}…`);
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error(`${entry.archiveName} 的 messages.json 顶层不是说说数组`);
      sources.push({ filename: entry.relativePath, posts: parsed });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setProgress(58, "正在生成三张表…");
    buildTables(sources);
    state.importLabel = `${state.jsonFiles.length} 份源文件`;
    const mdTexts = [];
    for (const entry of state.mdFiles) mdTexts.push(await entry.file.text());
    parseMarkdown(mdTexts);
    setProgress(78, "正在检查 Sermo 兼容性…");
    analyzeCompatibility();
    setProgress(90, "正在建立人工整理队列…");
    renderWorkspace();
    setProgress(100, "装订完成");
    elements.workspace.hidden = false;
    elements.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { elements.progressTrack.hidden = true; }, 1200);
  } catch (error) {
    showToast(`处理失败：${error.message}`);
    setProgress(100, "处理失败，请检查文件");
  } finally {
    elements.processButton.disabled = state.jsonFiles.length === 0;
  }
}

async function loadBundleFile(file) {
  if (!file) return;
  setProgress(12, "正在读取装订结果…");
  try {
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload.qzone_user) || !Array.isArray(payload.qzone_post) || !Array.isArray(payload.qzone_comment)) {
      throw new Error("缺少 qzone_user、qzone_post 或 qzone_comment 数组");
    }
    setProgress(45, "正在恢复三张表…");
    state.users = payload.qzone_user.map((user) => ({ ...user }));
    state.posts = payload.qzone_post.map((post) => ({ ...post }));
    state.comments = payload.qzone_comment.map((comment) => ({ ...comment, _deleted: false }));
    state.aliases = new Map(state.users.map((user) => [String(user.qq), new Set(user.nickname ? [user.nickname] : [])]));
    state.reviews = [];
    state.anomalies = [];
    state.mdStats = { posts: 0, comments: 0 };
    state.importLabel = file.name;
    setProgress(72, "正在检查 Sermo 兼容性…");
    analyzeCompatibility();
    renderWorkspace();
    setProgress(100, "兼容性审阅已生成");
    elements.workspace.hidden = false;
    switchWorkspaceTab("compatibility");
    elements.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { elements.progressTrack.hidden = true; }, 1200);
  } catch (error) {
    showToast(`打开失败：${error.message}`);
    setProgress(100, "文件无法识别");
  }
}

function renderWorkspace() {
  const aliasChanges = [...state.aliases.values()].filter((names) => names.size > 1).length;
  const activeComments = state.comments.filter((comment) => !comment._deleted);
  const nested = activeComments.filter((comment) => comment.parent_comment_id !== "").length;
  const pendingTargets = state.reviews.filter((review) => review.status === "pending").length;
  const pendingAnomalies = state.anomalies.filter((anomaly) => anomaly.status === "pending").length;
  const pending = pendingTargets + pendingAnomalies;
  $("#userCount").textContent = formatNumber(state.users.length);
  $("#aliasCount").textContent = `${formatNumber(aliasChanges)} 个 QQ 有昵称变更`;
  $("#postCount").textContent = formatNumber(state.posts.length);
  $("#postSourceCount").textContent = state.importLabel || `${state.jsonFiles.length} 份源文件`;
  $("#commentCount").textContent = formatNumber(activeComments.length);
  $("#nestedCount").textContent = `${formatNumber(nested)} 条嵌套回复`;
  updateReviewMetrics();

  const rules = [
    ["QQ 身份归一", `${formatNumber(state.users.length)} 个 QQ 已按号码合并，昵称仅保留发布时间最新的一次。`],
    ["说说去重", `${formatNumber(state.posts.length)} 条说说按“作者 QQ + 原始说说 ID”生成唯一记录。`],
    ["评论树复原", `${formatNumber(nested)} 条回复已重新连接到所属根评论，结构化 QQ 目标直接采用。`],
    ["Markdown 校验", state.mdFiles.length ? `已读取 ${formatNumber(state.mdStats.posts)} 条 Markdown 说说、${formatNumber(state.mdStats.comments)} 条评论行。` : "本次未加入 Markdown；不影响 HTML 主数据导出。"],
    ["人工整理", pending ? `${pendingTargets} 条回复目标与 ${pendingAnomalies} 条异常提及仍需处理。` : "回复目标与异常提及均已处理完成。"],
  ];
  $("#ruleList").innerHTML = rules.map(([title, copy], index) => `
    <div class="rule-row">
      <span class="rule-index">${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(copy)}</p>
      <span class="rule-state">${index === 4 && pending ? "待核对" : "已完成"}</span>
    </div>`).join("");
  renderReviewList();
  renderCompatibilityAudit();
  renderTable();
  renderExportChecklist();
}

function updateReviewMetrics() {
  const pendingTargets = state.reviews.filter((review) => review.status === "pending").length;
  const pendingAnomalies = state.anomalies.filter((anomaly) => anomaly.status === "pending").length;
  const pending = pendingTargets + pendingAnomalies;
  const total = state.reviews.length + state.anomalies.length;
  const percent = total ? Math.round(((total - pending) / total) * 100) : 100;
  $("#reviewCount").textContent = formatNumber(pending);
  $("#reviewStatus").textContent = pending ? `${total - pending}/${total} 已处理` : "全部关系已明确";
  $("#reviewTabCount").textContent = pending;
  $("#targetReviewCount").textContent = pendingTargets;
  $("#anomalyReviewCount").textContent = pendingAnomalies;
  $("#completionRing").textContent = `${percent}%`;
  renderExportChecklist();
}

function renderReviewList() {
  const source = state.activeReviewKind === "targets" ? state.reviews : state.anomalies;
  const visible = source.filter((item) => state.reviewFilter === "all" || item.status === state.reviewFilter);
  elements.reviewHeading.textContent = state.activeReviewKind === "targets" ? "无法自动确定的回复目标" : "损坏或残缺的 QQ 内部提及";
  elements.reviewSubbar.hidden = state.activeReviewKind !== "anomalies";
  elements.createAnomaly.hidden = true;
  if (!visible.length) {
    elements.reviewList.innerHTML = `<div class="empty-state"><strong>${state.reviewFilter === "pending" ? "没有待处理项目" : "这一栏还是空的"}</strong><p>${state.reviewFilter === "pending" ? "当前类型的数据都已经完成整理。" : "切换筛选条件查看其他记录。"}</p></div>`;
    return;
  }
  elements.reviewList.innerHTML = visible.map((item) => state.activeReviewKind === "targets" ? reviewCard(item) : anomalyCard(item)).join("");
}

function reviewCard(review) {
  const comment = state.comments.find((item) => item.id === review.commentId);
  const isDeleted = review.status === "deleted" || comment?._deleted;
  const candidateList = review.candidates.length ? review.candidates.map((candidate) => `
    <button class="candidate-item ${review.resolution?.qq === candidate.qq ? "selected" : ""}" type="button" data-review-candidate="${review.id}" data-qq="${candidate.qq}">
      <span>${escapeHtml(candidate.nickname || "未命名")}${candidate.aliases.length > 1 ? ` <small>曾用 ${escapeHtml(candidate.aliases.filter((name) => name !== candidate.nickname).join(" / "))}</small>` : ""}</span>
      <small>${candidate.qq}</small>
    </button>`).join("") : `<div class="candidate-item"><span>没有昵称候选，请搜索 QQ 或其他昵称</span></div>`;
  const resolution = review.status === "resolved" ? `<span class="resolution-badge">已设为：${review.resolution?.label || "无明确目标"}</span>` : isDeleted ? `<span class="resolution-badge deleted">该回复已从导出结果排除</span>` : "";
  return `
    <article class="review-card" data-review-card="${review.id}">
      <div class="review-context">
        <div class="context-meta"><span>说说 #${review.postId}</span><span>${escapeHtml(review.publishedAt)}</span><span>评论 #${review.commentId}</span></div>
        <blockquote class="comment-quote"><strong>${escapeHtml(review.rootAuthor.nickname)} · ${review.rootAuthor.qq}</strong>${escapeHtml(cleanContent(review.rootContent))}</blockquote>
        <blockquote class="comment-quote reply"><strong>${escapeHtml(review.replyAuthor.nickname)} · ${review.replyAuthor.qq}</strong>${escapeHtml(cleanContent(review.replyContent))}</blockquote>
        <span class="mention-chip">待识别 @${escapeHtml(review.mention)}</span>
      </div>
      <div class="review-action">
        <label for="search-${review.id}">搜索目标 QQ 或昵称</label>
        <input class="candidate-input" id="search-${review.id}" data-review-search="${review.id}" value="${escapeHtml(review.search || review.mention)}" placeholder="输入 QQ 或昵称" />
        <div class="candidate-results">${candidateList}</div>
        <div class="resolution-actions">
          <button class="primary" type="button" data-review-confirm="${review.id}" ${review.resolution?.qq ? "" : "disabled"}>确认所选用户</button>
          <button type="button" data-review-root="${review.id}">回复根评论者</button>
          <button type="button" data-review-none="${review.id}">无明确目标</button>
          <button class="danger" type="button" data-review-delete="${review.id}">${isDeleted ? "恢复此回复" : "删除此回复"}</button>
          ${review.status === "resolved" ? `<button type="button" data-review-reset="${review.id}">重新判断</button>` : ""}
        </div>
        ${resolution}
        <span hidden>${escapeHtml(comment?.reply_to_qq || "")}</span>
      </div>
    </article>`;
}

function anomalyCard(anomaly) {
  const comment = state.comments.find((item) => item.id === anomaly.commentId);
  const author = state.users.find((item) => item.qq === comment?.author_qq);
  const isCommentDeleted = Boolean(comment?._deleted);
  const resolution = anomaly.status === "resolved"
    ? `<span class="resolution-badge">${escapeHtml(anomaly.resolution || "已更新")}</span>`
    : anomaly.status === "deleted"
      ? `<span class="resolution-badge deleted">${isCommentDeleted ? "评论及其回复已从导出结果排除" : "异常标记已删除，评论仍保留"}</span>`
      : "";
  return `
    <article class="review-card anomaly-card" data-anomaly-card="${anomaly.id}">
      <div class="review-context">
        <div class="context-meta"><span>说说 #${anomaly.postId}</span><span>评论 #${anomaly.commentId}</span><span>${escapeHtml(comment?.published_at || "")}</span>${anomaly.createdManually ? "<span>人工补记</span>" : ""}</div>
        <blockquote class="comment-quote reply"><strong>${escapeHtml(author?.nickname || "未命名")} · ${escapeHtml(comment?.author_qq || "")}</strong>${escapeHtml(cleanContent(comment?.content_raw || ""))}</blockquote>
        <span class="mention-chip malformed">${escapeHtml(anomaly.token)}</span>
      </div>
      <div class="review-action anomaly-editor">
        <label for="content-${anomaly.id}">评论正文</label>
        <textarea class="content-editor" id="content-${anomaly.id}" data-anomaly-content="${anomaly.id}" rows="4">${escapeHtml(comment?.content_raw || "")}</textarea>
        <div class="repair-fields">
          <label>目标 QQ<input data-anomaly-qq="${anomaly.id}" inputmode="numeric" value="${escapeHtml(anomaly.qq)}" placeholder="从损坏标记中提取" /></label>
          <label>目标昵称<input data-anomaly-nickname="${anomaly.id}" value="${escapeHtml(anomaly.nickname)}" placeholder="手动补全昵称" /></label>
        </div>
        <div class="resolution-actions">
          <button class="primary" type="button" data-anomaly-repair="${anomaly.id}">修复为标准提及</button>
          <button type="button" data-anomaly-save="${anomaly.id}">保存正文</button>
          <button type="button" data-anomaly-delete-token="${anomaly.id}">删除异常标记</button>
          <button class="danger" type="button" data-anomaly-delete-comment="${anomaly.id}">${isCommentDeleted ? "恢复评论" : "删除评论及回复"}</button>
          ${anomaly.status !== "pending" && !isCommentDeleted ? `<button type="button" data-anomaly-reset="${anomaly.id}">撤销本项</button>` : ""}
        </div>
        ${resolution}
      </div>
    </article>`;
}

function replaceFirst(source, target, replacement) {
  const index = source.indexOf(target);
  if (index < 0) return null;
  return `${source.slice(0, index)}${replacement}${source.slice(index + target.length)}`;
}

function upsertUser(qq, nickname) {
  let user = state.users.find((item) => item.qq === qq);
  if (user) user.nickname = nickname || user.nickname;
  else {
    user = { qq, nickname };
    state.users.push(user);
    state.users.sort((a, b) => a.qq.localeCompare(b.qq));
  }
  if (!state.aliases.has(qq)) state.aliases.set(qq, new Set());
  if (nickname) state.aliases.get(qq).add(nickname);
}

function setCommentDeletion(commentId, deleted) {
  const ids = new Set([commentId]);
  let changed = true;
  while (changed) {
    changed = false;
    state.comments.forEach((comment) => {
      if (comment.parent_comment_id !== "" && ids.has(Number(comment.parent_comment_id)) && !ids.has(comment.id)) {
        ids.add(comment.id);
        changed = true;
      }
    });
  }
  state.comments.forEach((comment) => {
    if (ids.has(comment.id)) comment._deleted = deleted;
  });
  [...state.reviews, ...state.anomalies].forEach((item) => {
    if (!ids.has(item.commentId)) return;
    if (deleted) {
      if (!item.commentDeleted) item.statusBeforeCommentDelete = item.status;
      item.status = "deleted";
      item.commentDeleted = true;
    } else if (item.commentDeleted) {
      item.status = item.statusBeforeCommentDelete || "pending";
      item.commentDeleted = false;
    }
  });
}

function refreshAfterEdit(message) {
  renderWorkspace();
  showToast(message);
}

function searchCandidates(review, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return review.candidates;
  return state.users.filter((user) => user.qq.includes(needle) || user.nickname.toLocaleLowerCase().includes(needle) || [...(state.aliases.get(user.qq) || [])].some((alias) => alias.toLocaleLowerCase().includes(needle))).slice(0, 20).map((user) => ({ qq: user.qq, nickname: user.nickname, aliases: [...(state.aliases.get(user.qq) || [])] }));
}

function setReviewResolution(review, qq, label) {
  const comment = state.comments.find((item) => item.id === review.commentId);
  comment.reply_to_qq = qq || "";
  review.status = "resolved";
  review.resolution = { qq: qq || "", label };
  renderWorkspace();
  showToast("这条关系已记录");
}

function filteredCompatibilityIssues() {
  const query = elements.auditSearch.value.trim().toLocaleLowerCase();
  return state.compatibilityIssues.filter((issue) => {
    if (state.compatibilityScope !== "all" && issue.scope !== state.compatibilityScope) return false;
    if (state.compatibilitySeverity !== "all" && issue.severity !== state.compatibilitySeverity) return false;
    if (!query) return true;
    return [issue.title, issue.content, issue.context, issue.authorQQ, issue.authorName, issue.recordId, issue.postId]
      .some((value) => String(value || "").toLocaleLowerCase().includes(query));
  });
}

function compatibilityRecordKey(issue) {
  return `${issue.entityType}:${issue.recordId}`;
}

function renderCompatibilityAudit() {
  const issues = state.compatibilityIssues;
  const affectedRecords = new Set(issues.map(compatibilityRecordKey));
  const blockerRecords = new Set(issues.filter((issue) => issue.severity === "blocker").map(compatibilityRecordKey));
  const adaptRecords = new Set(issues.filter((issue) => issue.severity === "adapt").map(compatibilityRecordKey));
  const lossyRecords = new Set(issues.filter((issue) => issue.severity === "lossy").map(compatibilityRecordKey));
  const blockedPosts = new Set(issues.filter((issue) => issue.severity === "blocker" && issue.entityType === "post").map((issue) => issue.recordId));
  const directPosts = Math.max(0, state.posts.length - blockedPosts.size);
  const directPercent = state.posts.length ? ((directPosts / state.posts.length) * 100).toFixed(1) : "100.0";

  $("#compatibilityTabCount").textContent = formatNumber(affectedRecords.size);
  $("#auditVerdict").innerHTML = `<span>无结构阻断的说说</span><strong>${directPercent}%</strong><small>${formatNumber(directPosts)} / ${formatNumber(state.posts.length)} · 仅检查 JSON 字段</small>`;
  $("#auditSummary").innerHTML = [
    ["affected", "受影响记录", affectedRecords.size, `${formatNumber(issues.length)} 次问题命中`],
    ["blocker", "阻断迁移", blockerRecords.size, severityMeta.blocker.description],
    ["adapt", "需要适配", adaptRecords.size, severityMeta.adapt.description],
    ["lossy", "迁移会失真", lossyRecords.size, severityMeta.lossy.description],
  ].map(([className, label, value, detail]) => `<article class="audit-stat ${className}"><span>${label}</span><strong>${formatNumber(value)}</strong><small>${detail}</small></article>`).join("");

  const scopeCounts = Object.keys(compatibilityScopes).reduce((result, scope) => {
    result[scope] = scope === "all" ? issues.length : issues.filter((issue) => issue.scope === scope).length;
    return result;
  }, {});
  $("#auditScope").innerHTML = Object.entries(compatibilityScopes).map(([scope, label]) => `
    <button class="scope-button ${state.compatibilityScope === scope ? "active" : ""}" data-audit-scope="${scope}" type="button">${label}<span>${formatNumber(scopeCounts[scope])}</span></button>`).join("");

  renderCompatibilityList();
}

function renderCompatibilityList() {
  const visible = filteredCompatibilityIssues();
  const pageSize = 30;
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  state.compatibilityPage = Math.min(state.compatibilityPage, pages);
  const pageItems = visible.slice((state.compatibilityPage - 1) * pageSize, state.compatibilityPage * pageSize);
  $("#auditResultMeta").textContent = `当前筛选命中 ${formatNumber(visible.length)} 项；同一记录可能包含多个独立问题。`;

  if (!pageItems.length) {
    elements.auditList.innerHTML = `<div class="empty-state"><strong>没有匹配的问题</strong><p>可以切换类型、严重程度，或清空搜索条件。</p></div>`;
  } else {
    elements.auditList.innerHTML = pageItems.map(compatibilityIssueCard).join("");
  }
  elements.auditPagination.innerHTML = `<span>第 ${state.compatibilityPage}/${pages} 页</span><button type="button" data-audit-page="prev" ${state.compatibilityPage <= 1 ? "disabled" : ""}>上一页</button><button type="button" data-audit-page="next" ${state.compatibilityPage >= pages ? "disabled" : ""}>下一页</button>`;
}

function compatibilityIssueCard(issue) {
  const severity = severityMeta[issue.severity];
  const content = String(issue.content || "");
  const media = Array.isArray(issue.media) ? issue.media : [];
  const mediaList = media.length ? `<div class="audit-media-list">${media.map((item) => {
    const label = mediaLocalPath(item) || mediaRemoteUrl(item) || item.custom_filename || item.type || "媒体";
    return `<span class="audit-media-chip" title="${escapeHtml(label)}">${escapeHtml(item.type || "media")} · ${escapeHtml(label)}</span>`;
  }).join("")}</div>` : "";
  const context = issue.context ? `<div class="audit-context">所属说说：${escapeHtml(displayCell(issue.context))}</div>` : "";
  const sourceText = JSON.stringify(issue.source, null, 2);
  const sourcePreview = sourceText.length > 12000 ? `${sourceText.slice(0, 12000)}\n… 已截断` : sourceText;
  return `
    <article class="audit-item">
      <div class="audit-rail">
        <span class="audit-severity ${issue.severity}">${severity.label}</span>
        <small>${escapeHtml(compatibilityScopes[issue.scope])}<br>${escapeHtml(issue.entityLabel)} #${escapeHtml(issue.recordId)}</small>
      </div>
      <div class="audit-record">
        <div class="audit-meta">
          ${issue.postId ? `<span>说说 #${escapeHtml(issue.postId)}</span>` : ""}
          ${issue.authorQQ ? `<span>${escapeHtml(issue.authorName || "未命名")} · ${escapeHtml(issue.authorQQ)}</span>` : ""}
          ${issue.publishedAt ? `<span>${escapeHtml(issue.publishedAt)}</span>` : ""}
          <span>${escapeHtml(issue.code)}</span>
        </div>
        <h3>${escapeHtml(issue.title)}</h3>
        <p class="audit-copy ${content.startsWith("（") ? "muted" : ""}">${escapeHtml(content)}</p>
        ${mediaList}${context}
      </div>
      <aside class="audit-diagnosis">
        <strong>为什么不兼容</strong>
        <p>${escapeHtml(issue.explanation)}</p>
        <dl class="audit-field-map"><dt>来源</dt><dd>${escapeHtml(issue.fieldFrom)}</dd><dt>Sermo</dt><dd>${escapeHtml(issue.fieldTo)}</dd></dl>
        <strong>建议处理</strong>
        <p>${escapeHtml(issue.suggestion)}</p>
        <details class="audit-source"><summary>查看原始记录</summary><pre>${escapeHtml(sourcePreview)}</pre></details>
      </aside>
    </article>`;
}

function switchWorkspaceTab(tabName) {
  $$('.tab-button').forEach((item) => item.classList.toggle("active", item.dataset.tab === tabName));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabName));
}

function renderTable() {
  const rows = state.activeTable === "comments" ? state.comments.filter((comment) => !comment._deleted) : state[state.activeTable];
  const columns = tableColumns[state.activeTable];
  const query = elements.tableSearch.value.trim().toLocaleLowerCase();
  const filtered = query ? rows.filter((row) => columns.some((column) => String(row[column] ?? "").toLocaleLowerCase().includes(query))) : rows;
  const pageSize = 50;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  state.tablePage = Math.min(state.tablePage, pages);
  const visible = filtered.slice((state.tablePage - 1) * pageSize, state.tablePage * pageSize);
  elements.dataTable.innerHTML = `<thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${visible.map((row) => `<tr>${columns.map((column) => `<td title="${escapeHtml(String(row[column] ?? ""))}">${escapeHtml(displayCell(row[column]))}</td>`).join("")}</tr>`).join("")}</tbody>`;
  elements.pagination.innerHTML = `<span>${formatNumber(filtered.length)} 行 · 第 ${state.tablePage}/${pages} 页</span><button type="button" data-page="prev" ${state.tablePage <= 1 ? "disabled" : ""}>上一页</button><button type="button" data-page="next" ${state.tablePage >= pages ? "disabled" : ""}>下一页</button>`;
}

function displayCell(value) {
  const text = String(value ?? "");
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

function renderExportChecklist() {
  const pending = [...state.reviews, ...state.anomalies].filter((item) => item.status === "pending").length;
  const deleted = state.comments.filter((comment) => comment._deleted).length;
  const duplicateUsers = state.users.length - new Set(state.users.map((user) => user.qq)).size;
  const postIds = new Set(state.posts.map((post) => post.id));
  const orphanComments = state.comments.filter((comment) => !comment._deleted && !postIds.has(comment.post_id)).length;
  const checks = [
    [duplicateUsers === 0, "用户 QQ 唯一", duplicateUsers ? `${duplicateUsers} 条重复` : `${formatNumber(state.users.length)} 个身份无重复`],
    [orphanComments === 0, "评论均有关联说说", orphanComments ? `${orphanComments} 条孤立评论` : "外键关系完整"],
    [pending === 0, "人工整理完成", pending ? `仍有 ${pending} 个待处理项目` : "回复目标与异常提及均已处理"],
    [true, "删除项目已排除", deleted ? `${deleted} 条评论不会进入导出` : "当前没有排除评论"],
    [true, "原始正文保留", "导出不会改写历史文本"],
  ];
  $("#exportChecklist").innerHTML = checks.map(([ok, title, detail]) => `<div class="check-row ${ok ? "" : "warning"}"><span class="check-mark">${ok ? "✓" : "!"}</span><div><strong>${escapeHtml(title)}</strong><br><span>${escapeHtml(detail)}</span></div></div>`).join("");
}

function exportData(type) {
  const exportedComments = state.comments.filter((comment) => !comment._deleted).map(({ _deleted, ...comment }) => comment);
  if (type === "bundle") {
    const payload = {
      exported_at: new Date().toISOString(),
      qzone_user: state.users,
      qzone_post: state.posts,
      qzone_comment: exportedComments,
      manual_resolutions: state.reviews.filter((review) => review.status !== "pending").map(({ commentId, mention, resolution, status }) => ({ comment_id: commentId, mention, status, reply_to_qq: resolution?.qq || "", resolution: resolution?.label || "已删除" })),
      anomaly_resolutions: state.anomalies.filter((anomaly) => anomaly.status !== "pending").map(({ commentId, originalToken, token, status, resolution }) => ({ comment_id: commentId, original_token: originalToken, final_token: token, status, resolution })),
    };
    downloadBlob("qzone-migration.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    return;
  }
  const columns = tableColumns[type];
  const rows = type === "comments" ? exportedComments : state[type];
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
  downloadBlob(`qzone_${type === "users" ? "user" : type === "posts" ? "post" : "comment"}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`已生成 ${filename}`);
}

function formatNumber(value) { return new Intl.NumberFormat("zh-CN").format(value); }

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2400);
}

elements.jsonInput.addEventListener("change", (event) => {
  addFolderFiles("json", event.target.files);
  event.target.value = "";
});
elements.mdInput.addEventListener("change", (event) => {
  addFolderFiles("md", event.target.files);
  event.target.value = "";
});
elements.bundleInput.addEventListener("change", (event) => {
  loadBundleFile(event.target.files?.[0]);
  event.target.value = "";
});
[$("#jsonFolderList"), $("#mdFolderList")].forEach((list) => list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-folder]");
  if (!button) return;
  const kind = button.dataset.folderKind;
  state.folderGroups[kind].delete(button.dataset.removeFolder);
  syncSelectedFiles(kind);
  renderFolderSelection(kind);
  elements.processButton.disabled = state.jsonFiles.length === 0;
}));
elements.processButton.addEventListener("click", processFiles);

$$('.tab-button').forEach((button) => button.addEventListener("click", () => {
  switchWorkspaceTab(button.dataset.tab);
}));

$("#auditScope").addEventListener("click", (event) => {
  const button = event.target.closest("[data-audit-scope]");
  if (!button) return;
  state.compatibilityScope = button.dataset.auditScope;
  state.compatibilityPage = 1;
  renderCompatibilityAudit();
});

$$('.severity-button').forEach((button) => button.addEventListener("click", () => {
  state.compatibilitySeverity = button.dataset.severity;
  state.compatibilityPage = 1;
  $$('.severity-button').forEach((item) => item.classList.toggle("active", item === button));
  renderCompatibilityList();
}));

elements.auditSearch.addEventListener("input", () => {
  state.compatibilityPage = 1;
  renderCompatibilityList();
});

elements.auditPagination.addEventListener("click", (event) => {
  const button = event.target.closest("[data-audit-page]");
  if (!button) return;
  state.compatibilityPage += button.dataset.auditPage === "next" ? 1 : -1;
  renderCompatibilityList();
  $("#panel-compatibility").scrollIntoView({ behavior: "smooth", block: "start" });
});

$$('.filter-button').forEach((button) => button.addEventListener("click", () => {
  state.reviewFilter = button.dataset.filter;
  $$('.filter-button').forEach((item) => item.classList.toggle("active", item === button));
  renderReviewList();
}));

$$('.review-kind-button').forEach((button) => button.addEventListener("click", () => {
  state.activeReviewKind = button.dataset.reviewKind;
  $$('.review-kind-button').forEach((item) => item.classList.toggle("active", item === button));
  renderReviewList();
}));

$("#openCreateAnomaly").addEventListener("click", () => {
  elements.createAnomaly.hidden = false;
  $("#newAnomalyCommentId").focus();
});

$("#cancelCreateAnomaly").addEventListener("click", () => {
  elements.createAnomaly.hidden = true;
});

$("#confirmCreateAnomaly").addEventListener("click", () => {
  const commentId = Number($("#newAnomalyCommentId").value);
  const token = $("#newAnomalyToken").value.trim();
  const comment = state.comments.find((item) => item.id === commentId);
  if (!comment || !token) {
    showToast("请填写有效的评论 ID 和异常标记");
    return;
  }
  const fields = malformedMentionFields(token);
  state.anomalies.unshift({
    id: `anomaly-manual-${Date.now()}`,
    commentId,
    postId: comment.post_id,
    token,
    originalToken: token,
    originalContent: comment.content_raw,
    qq: fields.qq,
    nickname: fields.nickname,
    status: "pending",
    resolution: null,
    createdManually: true,
  });
  $("#newAnomalyCommentId").value = "";
  $("#newAnomalyToken").value = "";
  renderWorkspace();
  showToast("异常项已加入待处理队列");
});

$$('.table-button').forEach((button) => button.addEventListener("click", () => {
  state.activeTable = button.dataset.table;
  state.tablePage = 1;
  $$('.table-button').forEach((item) => item.classList.toggle("active", item === button));
  renderTable();
}));

elements.tableSearch.addEventListener("input", () => { state.tablePage = 1; renderTable(); });

elements.pagination.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  state.tablePage += button.dataset.page === "next" ? 1 : -1;
  renderTable();
});

elements.reviewList.addEventListener("input", (event) => {
  const input = event.target.closest("[data-review-search]");
  if (!input) return;
  const review = state.reviews.find((item) => item.id === input.dataset.reviewSearch);
  review.search = input.value;
  review.candidates = searchCandidates(review, input.value);
  const card = input.closest("[data-review-card]");
  const results = $(".candidate-results", card);
  results.innerHTML = review.candidates.length ? review.candidates.map((candidate) => `<button class="candidate-item" type="button" data-review-candidate="${review.id}" data-qq="${candidate.qq}"><span>${escapeHtml(candidate.nickname || "未命名")}</span><small>${candidate.qq}</small></button>`).join("") : `<div class="candidate-item"><span>没有找到候选用户</span></div>`;
});

elements.reviewList.addEventListener("click", (event) => {
  const anomalyAction = event.target.closest("[data-anomaly-repair], [data-anomaly-save], [data-anomaly-delete-token], [data-anomaly-delete-comment], [data-anomaly-reset]");
  if (anomalyAction) {
    const anomalyId = anomalyAction.dataset.anomalyRepair || anomalyAction.dataset.anomalySave || anomalyAction.dataset.anomalyDeleteToken || anomalyAction.dataset.anomalyDeleteComment || anomalyAction.dataset.anomalyReset;
    const anomaly = state.anomalies.find((item) => item.id === anomalyId);
    const comment = state.comments.find((item) => item.id === anomaly.commentId);
    const card = anomalyAction.closest("[data-anomaly-card]");
    if (anomalyAction.dataset.anomalyDeleteComment) {
      setCommentDeletion(comment.id, !comment._deleted);
      refreshAfterEdit(comment._deleted ? "评论及其回复已排除，可在“已删除”中恢复" : "评论及其回复已恢复");
      return;
    }
    if (anomalyAction.dataset.anomalyReset) {
      if (anomaly.previousContent !== undefined) comment.content_raw = anomaly.previousContent;
      anomaly.token = anomaly.originalToken;
      const fields = malformedMentionFields(anomaly.originalToken);
      anomaly.qq = fields.qq;
      anomaly.nickname = fields.nickname;
      anomaly.status = "pending";
      anomaly.resolution = null;
      refreshAfterEdit("已撤销本项修改");
      return;
    }
    const editor = $("[data-anomaly-content]", card);
    const editedContent = editor.value;
    anomaly.previousContent = comment.content_raw;
    if (anomalyAction.dataset.anomalySave) {
      comment.content_raw = editedContent;
      anomaly.status = "resolved";
      anomaly.resolution = "评论正文已人工更新";
      refreshAfterEdit("正文修改已保存");
      return;
    }
    if (anomalyAction.dataset.anomalyDeleteToken) {
      const updated = replaceFirst(editedContent, anomaly.token, "") ?? replaceFirst(editedContent, anomaly.originalToken, "");
      if (updated === null) {
        showToast("正文中没有找到这段异常标记");
        return;
      }
      comment.content_raw = updated;
      anomaly.status = "deleted";
      anomaly.resolution = "异常标记已删除";
      refreshAfterEdit("异常标记已删除，评论正文仍保留");
      return;
    }
    if (anomalyAction.dataset.anomalyRepair) {
      const qq = $("[data-anomaly-qq]", card).value.trim();
      const nickname = $("[data-anomaly-nickname]", card).value.trim();
      if (!/^\d{5,20}$/.test(qq) || !nickname || /[,{}]/.test(nickname)) {
        showToast("需要有效 QQ；昵称不能包含逗号或花括号");
        return;
      }
      const repairedToken = `@{uin:${qq},nick:${nickname},who:1}`;
      const updated = replaceFirst(editedContent, anomaly.token, repairedToken) ?? replaceFirst(editedContent, anomaly.originalToken, repairedToken);
      if (updated === null) {
        showToast("正文中没有找到这段异常标记");
        return;
      }
      comment.content_raw = updated;
      anomaly.token = repairedToken;
      anomaly.qq = qq;
      anomaly.nickname = nickname;
      anomaly.status = "resolved";
      anomaly.resolution = `已修复为 @${nickname} · ${qq}`;
      upsertUser(qq, nickname);
      refreshAfterEdit("异常提及已修复并同步用户表");
      return;
    }
  }
  const candidate = event.target.closest("[data-review-candidate]");
  if (candidate) {
    const review = state.reviews.find((item) => item.id === candidate.dataset.reviewCandidate);
    const user = state.users.find((item) => item.qq === candidate.dataset.qq);
    review.resolution = { qq: user.qq, label: `${user.nickname} · ${user.qq}` };
    $$(`[data-review-candidate="${review.id}"]`, candidate.closest("[data-review-card]")).forEach((item) => item.classList.toggle("selected", item === candidate));
    const confirm = $(`[data-review-confirm="${review.id}"]`);
    confirm.disabled = false;
    return;
  }
  const action = event.target.closest("[data-review-confirm], [data-review-root], [data-review-none], [data-review-delete], [data-review-reset]");
  if (!action) return;
  const reviewId = action.dataset.reviewConfirm || action.dataset.reviewRoot || action.dataset.reviewNone || action.dataset.reviewDelete || action.dataset.reviewReset;
  const review = state.reviews.find((item) => item.id === reviewId);
  if (action.dataset.reviewConfirm && review.resolution?.qq) setReviewResolution(review, review.resolution.qq, review.resolution.label);
  if (action.dataset.reviewRoot) setReviewResolution(review, review.rootAuthor.qq, `${review.rootAuthor.nickname} · ${review.rootAuthor.qq}`);
  if (action.dataset.reviewNone) setReviewResolution(review, "", "无明确目标");
  if (action.dataset.reviewDelete) {
    const comment = state.comments.find((item) => item.id === review.commentId);
    setCommentDeletion(comment.id, !comment._deleted);
    refreshAfterEdit(comment._deleted ? "回复已排除，可在“已删除”中恢复" : "回复已恢复");
  }
  if (action.dataset.reviewReset) {
    review.status = "pending";
    review.resolution = null;
    const comment = state.comments.find((item) => item.id === review.commentId);
    comment.reply_to_qq = "";
    renderWorkspace();
  }
});

$$('[data-export]').forEach((button) => button.addEventListener("click", () => exportData(button.dataset.export)));
