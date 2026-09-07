const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  jsonFiles: [],
  mdFiles: [],
  users: [],
  posts: [],
  comments: [],
  reviews: [],
  aliases: new Map(),
  mdStats: { posts: 0, comments: 0 },
  activeTable: "users",
  tablePage: 1,
  reviewFilter: "pending",
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
    setProgress(86, "正在建立人工合并队列…");
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
  const nested = state.comments.filter((comment) => comment.parent_comment_id !== "").length;
  const pending = state.reviews.filter((review) => review.status === "pending").length;
  $("#userCount").textContent = formatNumber(state.users.length);
  $("#aliasCount").textContent = `${formatNumber(aliasChanges)} 个 QQ 有昵称变更`;
  $("#postCount").textContent = formatNumber(state.posts.length);
  $("#postSourceCount").textContent = `${state.jsonFiles.length} 份源文件`;
  $("#commentCount").textContent = formatNumber(state.comments.length);
  $("#nestedCount").textContent = `${formatNumber(nested)} 条嵌套回复`;
  updateReviewMetrics();

  const rules = [
    ["QQ 身份归一", `${formatNumber(state.users.length)} 个 QQ 已按号码合并，昵称仅保留发布时间最新的一次。`],
    ["说说去重", `${formatNumber(state.posts.length)} 条说说按“作者 QQ + 原始说说 ID”生成唯一记录。`],
    ["评论树复原", `${formatNumber(nested)} 条回复已重新连接到所属根评论，结构化 QQ 目标直接采用。`],
    ["Markdown 校验", state.mdFiles.length ? `已读取 ${formatNumber(state.mdStats.posts)} 条 Markdown 说说、${formatNumber(state.mdStats.comments)} 条评论行。` : "本次未加入 Markdown；不影响 HTML 主数据导出。"],
    ["人工判断", pending ? `${pending} 条普通文字 @昵称 无法可靠映射到 QQ，已进入人工合并区。` : "没有遗留的回复目标需要人工判断。"],
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
  const pending = state.reviews.filter((review) => review.status === "pending").length;
  const total = state.reviews.length;
  const percent = total ? Math.round(((total - pending) / total) * 100) : 100;
  $("#reviewCount").textContent = formatNumber(pending);
  $("#reviewStatus").textContent = pending ? `${total - pending}/${total} 已处理` : "全部关系已明确";
  $("#reviewTabCount").textContent = pending;
  $("#completionRing").textContent = `${percent}%`;
  renderExportChecklist();
}

function renderReviewList() {
  const visible = state.reviews.filter((review) => state.reviewFilter === "all" || review.status === state.reviewFilter);
  if (!visible.length) {
    elements.reviewList.innerHTML = `<div class="empty-state"><strong>${state.reviewFilter === "pending" ? "没有待处理关系" : "这一栏还是空的"}</strong><p>${state.reviewFilter === "pending" ? "所有回复目标都已自动确定或由你完成判断。" : "切换筛选条件查看其他记录。"}</p></div>`;
    return;
  }
  elements.reviewList.innerHTML = visible.map((review) => reviewCard(review)).join("");
}

function reviewCard(review) {
  const comment = state.comments.find((item) => item.id === review.commentId);
  const candidateList = review.candidates.length ? review.candidates.map((candidate) => `
    <button class="candidate-item ${review.resolution?.qq === candidate.qq ? "selected" : ""}" type="button" data-review-candidate="${review.id}" data-qq="${candidate.qq}">
      <span>${escapeHtml(candidate.nickname || "未命名")}${candidate.aliases.length > 1 ? ` <small>曾用 ${escapeHtml(candidate.aliases.filter((name) => name !== candidate.nickname).join(" / "))}</small>` : ""}</span>
      <small>${candidate.qq}</small>
    </button>`).join("") : `<div class="candidate-item"><span>没有昵称候选，请搜索 QQ 或其他昵称</span></div>`;
  const resolution = review.status === "resolved" ? `<span class="resolution-badge">已设为：${review.resolution?.label || "无明确目标"}</span>` : "";
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
          ${review.status === "resolved" ? `<button type="button" data-review-reset="${review.id}">重新判断</button>` : ""}
        </div>
        ${resolution}
        <span hidden>${escapeHtml(comment?.reply_to_qq || "")}</span>
      </div>
    </article>`;
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
  updateReviewMetrics();
  renderReviewList();
  showToast("这条关系已记录");
}

function renderTable() {
  const rows = state[state.activeTable];
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
  const pending = state.reviews.filter((review) => review.status === "pending").length;
  const duplicateUsers = state.users.length - new Set(state.users.map((user) => user.qq)).size;
  const orphanComments = state.comments.filter((comment) => !state.posts.some((post) => post.id === comment.post_id)).length;
  const checks = [
    [duplicateUsers === 0, "用户 QQ 唯一", duplicateUsers ? `${duplicateUsers} 条重复` : `${formatNumber(state.users.length)} 个身份无重复`],
    [orphanComments === 0, "评论均有关联说说", orphanComments ? `${orphanComments} 条孤立评论` : "外键关系完整"],
    [pending === 0, "人工判断完成", pending ? `仍有 ${pending} 条以空目标导出` : "所有待审关系已处理"],
    [true, "原始正文保留", "导出不会改写历史文本"],
  ];
  $("#exportChecklist").innerHTML = checks.map(([ok, title, detail]) => `<div class="check-row ${ok ? "" : "warning"}"><span class="check-mark">${ok ? "✓" : "!"}</span><div><strong>${escapeHtml(title)}</strong><br><span>${escapeHtml(detail)}</span></div></div>`).join("");
}

function exportData(type) {
  if (type === "bundle") {
    const payload = {
      exported_at: new Date().toISOString(),
      qzone_user: state.users,
      qzone_post: state.posts,
      qzone_comment: state.comments,
      manual_resolutions: state.reviews.filter((review) => review.status === "resolved").map(({ commentId, mention, resolution }) => ({ comment_id: commentId, mention, reply_to_qq: resolution.qq, resolution: resolution.label })),
    };
    downloadBlob("qzone-migration.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    return;
  }
  const columns = tableColumns[type];
  const rows = state[type];
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
  const action = event.target.closest("[data-review-confirm], [data-review-root], [data-review-none], [data-review-reset]");
  if (!action) return;
  const reviewId = action.dataset.reviewConfirm || action.dataset.reviewRoot || action.dataset.reviewNone || action.dataset.reviewReset;
  const review = state.reviews.find((item) => item.id === reviewId);
  if (action.dataset.reviewConfirm && review.resolution?.qq) setReviewResolution(review, review.resolution.qq, review.resolution.label);
  if (action.dataset.reviewRoot) setReviewResolution(review, review.rootAuthor.qq, `${review.rootAuthor.nickname} · ${review.rootAuthor.qq}`);
  if (action.dataset.reviewNone) setReviewResolution(review, "", "无明确目标");
  if (action.dataset.reviewReset) {
    review.status = "pending";
    review.resolution = null;
    const comment = state.comments.find((item) => item.id === review.commentId);
    comment.reply_to_qq = "";
    updateReviewMetrics();
    renderReviewList();
  }
});

$$('[data-export]').forEach((button) => button.addEventListener("click", () => exportData(button.dataset.export)));
