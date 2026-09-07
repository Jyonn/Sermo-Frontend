const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
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
};

const tableColumns = {
  users: ["qq", "nickname"],
  posts: ["id", "source_post_id", "author_qq", "content_raw", "content_text", "published_at", "visibility", "media", "source_payload", "created_at", "updated_at"],
  comments: ["id", "post_id", "author_qq", "parent_comment_id", "reply_to_qq", "content_raw", "published_at", "source_payload", "created_at", "updated_at"],
};

const elements = {
  jsonInput: $("#jsonInput"),
  mdInput: $("#mdInput"),
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
  toast: $("#toast"),
};

function setFiles(kind, files) {
  const accepted = [...files].filter((file) => kind === "json" ? file.name.toLowerCase().endsWith(".json") : file.name.toLowerCase().endsWith(".md"));
  state[`${kind}Files`] = accepted;
  const label = $(`#${kind}FileLabel`);
  label.textContent = accepted.length ? `${accepted.length} 个文件 · ${formatBytes(accepted.reduce((sum, file) => sum + file.size, 0))}` : kind === "json" ? "可同时选择东墙和西墙" : "可选，用于交叉校验";
  elements.processButton.disabled = state.jsonFiles.length === 0;
}

function wireDropZone(id, kind) {
  const zone = $(`#${id}`);
  ["dragenter", "dragover"].forEach((eventName) => zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => zone.addEventListener(eventName, (event) => {
    event.preventDefault();
    zone.classList.remove("dragging");
  }));
  zone.addEventListener("drop", (event) => setFiles(kind, event.dataTransfer.files));
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
      const file = state.jsonFiles[index];
      const text = await file.text();
      setProgress(15 + Math.round((index / state.jsonFiles.length) * 35), `正在解析 ${file.name}…`);
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error(`${file.name} 顶层不是说说数组`);
      sources.push({ filename: file.name, posts: parsed });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setProgress(58, "正在生成三张表…");
    buildTables(sources);
    const mdTexts = [];
    for (const file of state.mdFiles) mdTexts.push(await file.text());
    parseMarkdown(mdTexts);
    setProgress(86, "正在建立人工整理队列…");
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
  $("#postSourceCount").textContent = `${state.jsonFiles.length} 份源文件`;
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

elements.jsonInput.addEventListener("change", (event) => setFiles("json", event.target.files));
elements.mdInput.addEventListener("change", (event) => setFiles("md", event.target.files));
elements.processButton.addEventListener("click", processFiles);
wireDropZone("jsonDrop", "json");
wireDropZone("mdDrop", "md");

$$('.tab-button').forEach((button) => button.addEventListener("click", () => {
  $$('.tab-button').forEach((item) => item.classList.toggle("active", item === button));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
}));

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
