const state = {
  route: "/entry",
  entryMode: "join",
  entryErrors: {},
  codeCountdown: 0,
  friendTab: "incoming",
  settingsTab: "account",
  usersTab: "directory",
  activeChatId: 201,
  notificationPrefs: {
    email: { enabled: true, threshold: 5 },
    sms: { enabled: false, threshold: 15 },
    bark: { enabled: true, threshold: 1 },
  },
  contacts: {
    email: "alex@sermo.space",
    sms: "+852 9732 4219",
    bark: "https://api.day.app/alex-sermo-device",
  },
  chatDrafts: {},
};

const app = document.querySelector("#app");
let countdownTimer = null;

const chats = [
  {
    id: 201,
    title: "Alex Rivera",
    subtitle: "私聊 · 已验证",
    preview: "Working on them right now. The light mode looks very clean.",
    time: "11:02",
    unread: 3,
    online: true,
    members: 2,
    type: "direct",
    detail: {
      summary: "偏产品设计，已互为好友，响应很快。",
      relation: "好友中",
      actions: ["发起语音原型评审", "打开资料卡", "删除好友关系"],
    },
    messages: [
      { from: "other", name: "Alex", time: "10:42", text: "Hey! 设计稿里主色、卡片层级和输入区悬浮感已经统一了。" },
      { from: "self", name: "我", time: "10:45", text: "我在把 FE 规范里的三栏结构和移动端单栏切换一起落掉。" },
      { from: "other", name: "Alex", time: "11:02", text: "别忘了把好友申请限制态和升级引导放进朋友页。" },
    ],
  },
  {
    id: 202,
    title: "Night Shift",
    subtitle: "群聊 · 8 人",
    preview: "今晚把在线用户页也补进来，列表卡片做呼吸感在线点。",
    time: "昨天",
    unread: 0,
    online: false,
    members: 8,
    type: "group",
    detail: {
      summary: "设计协作群，当前由你作为 owner 维护邀请。",
      relation: "群主",
      actions: ["邀请成员", "修改群名", "移除成员"],
    },
    messages: [
      { from: "other", name: "June", time: "20:14", text: "我建议右栏保留成员和权限操作，不要把信息塞回主消息区。" },
      { from: "self", name: "我", time: "20:17", text: "同意，平板我会改成抽屉，桌面保留固定右栏。" },
    ],
  },
  {
    id: 203,
    title: "Space Ops",
    subtitle: "群聊 · 24 人",
    preview: "上线前确认验证码倒计时、slug 自动转小写和 401 refresh 流程。",
    time: "周二",
    unread: 12,
    online: false,
    members: 24,
    type: "group",
    detail: {
      summary: "偏交付排期和上线清单。",
      relation: "成员",
      actions: ["查看邀请", "静音 8 小时"],
    },
    messages: [
      { from: "other", name: "Ops", time: "09:00", text: "QA 会重点看关键状态的可视反馈和可达性。" },
    ],
  },
];

const friendRequests = {
  incoming: [
    { id: 1, name: "Mika", time: "2 分钟前", level: "Verified", note: "想约一个 Space onboarding 演示。" },
    { id: 2, name: "Sarah", time: "1 小时前", level: "Basic", note: "刚从在线用户页发起请求。" },
  ],
  outgoing: [
    { id: 3, name: "Noah", time: "等待中", level: "Basic", note: "待对方确认，可撤回。" },
    { id: 4, name: "Lina", time: "等待中", level: "Verified", note: "触达限制：当前 Basic 用户最多 5 个挂起请求。" },
  ],
  accepted: [
    { id: 5, name: "Elena", status: "在线", mood: "主聊产品节奏" },
    { id: 6, name: "Julian", status: "3 小时前在线", mood: "偶尔参与群讨论" },
  ],
};

const users = [
  { id: 31, name: "Avery", level: "Verified", online: true, bio: "擅长把复杂设置页压成清晰的信息架构。" },
  { id: 32, name: "Momo", level: "Basic", online: true, bio: "常驻 Space，最近在补通知偏好。 " },
  { id: 33, name: "Riko", level: "Basic", online: false, bio: "会从在线列表直接发起私聊。" },
  { id: 34, name: "Chen", level: "Verified", online: true, bio: "关注群聊权限和成员管理体验。" },
  { id: 35, name: "Nia", level: "Basic", online: false, bio: "正在完成邮箱升级流程。" },
  { id: 36, name: "Theo", level: "Verified", online: true, bio: "喜欢强对比按钮和街头贴纸感。 " },
];

const formatAvatar = (name) => name.slice(0, 2).toUpperCase();

function syncRoute() {
  const raw = location.hash.replace(/^#/, "") || "/entry";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  state.route = path;

  if (path.startsWith("/app/chats/")) {
    const chatId = Number(path.split("/").pop());
    if (chats.some((chat) => chat.id === chatId)) {
      state.activeChatId = chatId;
    }
  } else if (path === "/app/chats") {
    state.activeChatId = chats[0].id;
  } else if (path === "/app/friends") {
    state.friendTab = "accepted";
  } else if (path === "/app/friends/requests") {
    state.friendTab = "incoming";
  } else if (path === "/app/space-users") {
    state.usersTab = "directory";
  } else if (path === "/app/space-users/online") {
    state.usersTab = "online";
  } else if (path === "/app/settings/account") {
    state.settingsTab = "account";
  } else if (path === "/app/settings/notifications") {
    state.settingsTab = "notifications";
  } else if (path === "/app/settings/contacts") {
    state.settingsTab = "contacts";
  }
}

function navigate(path) {
  if (location.hash !== `#${path}`) {
    location.hash = path;
  } else {
    syncRoute();
    render();
  }
}

function activeChat() {
  return chats.find((chat) => chat.id === state.activeChatId) || chats[0];
}

function routePills() {
  const items = [
    ["/entry", "进入层"],
    ["/app/chats", "会话层"],
    ["/app/friends/requests", "关系层"],
    ["/app/settings/account", "设置层"],
  ];

  return `
    <div class="route-nav">
      ${items
        .map(
          ([path, label]) => `
          <button class="route-chip ${state.route.startsWith(path) ? "active" : ""}" data-route="${path}">
            ${label}
          </button>
        `
        )
        .join("")}
    </div>
  `;
}

function topbar() {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark"><span class="material-symbols-outlined">rocket_launch</span></div>
        <div class="brand-copy">
          <h1>Sermo</h1>
          <p>Neon Street Prototype</p>
        </div>
      </div>
      ${routePills()}
      <div class="utility-nav">
        <span class="ghost-chip mono">FE-Design-Spec-v1</span>
        <button class="ghost-chip" data-route="/app/chats">Open Prototype</button>
      </div>
    </header>
  `;
}

function entryView() {
  const modeCopy = {
    create: {
      eyebrow: "Create Space",
      title: "三步创建你的 Space",
      subtitle: "创建品牌感更强的进入层：发验证码、填写名称与 slug、完成创建后继续进入聊天。",
      fields: `
        <div>
          <label class="field-label">Space 名称</label>
          <input class="input" name="spaceName" placeholder="例如：Neon Corner" />
        </div>
        <div>
          <label class="field-label">
            <span>Space Slug</span>
            <span class="field-help">自动转小写</span>
          </label>
          <input class="input" name="slug" data-lowercase="true" placeholder="neon-corner" />
          ${state.entryErrors.slug ? `<div class="validation-error">${state.entryErrors.slug}</div>` : ""}
        </div>
        <div>
          <div class="field-line">
            <label>邮箱验证码</label>
            <button class="ghost-button" type="button" data-action="send-code">
              ${state.codeCountdown > 0 ? `${state.codeCountdown}s 后重发` : "发送验证码"}
            </button>
          </div>
          <div class="code-row">${Array.from({ length: 6 }, (_, index) => `<div class="code-box">${["8", "2", "", "", "", ""][index]}</div>`).join("")}</div>
          <div class="prototype-note">验证码发送后建议展示 60 秒倒计时与明确的失效时间提示。</div>
        </div>
      `,
      cta: "创建并进入 Space",
    },
    login: {
      eyebrow: "Space Login",
      title: "使用 Space 邮箱验证码登录",
      subtitle: "登录流保持低门槛，但错误提示必须紧贴字段，便于快速纠正。",
      fields: `
        <div>
          <label class="field-label">Space Slug</label>
          <input class="input" name="slug" data-lowercase="true" placeholder="sermo-lab" />
          ${state.entryErrors.slug ? `<div class="validation-error">${state.entryErrors.slug}</div>` : ""}
        </div>
        <div>
          <label class="field-label">邮箱</label>
          <input class="input" name="email" placeholder="team@sermo.space" />
        </div>
        <div>
          <div class="field-line">
            <label>验证码</label>
            <button class="ghost-button" type="button" data-action="send-code">
              ${state.codeCountdown > 0 ? `${state.codeCountdown}s 后重发` : "发送验证码"}
            </button>
          </div>
          <div class="code-row">${Array.from({ length: 6 }, (_, index) => `<div class="code-box">${["1", "4", "7", "", "", ""][index]}</div>`).join("")}</div>
        </div>
      `,
      cta: "登录 Space",
    },
    join: {
      eyebrow: "Join Space",
      title: "10 秒内进入会话",
      subtitle: "加入流程聚焦昵称唯一性、密码可选和低打扰反馈，让用户优先体验聊天。",
      fields: `
        <div>
          <label class="field-label">
            <span>Space Slug</span>
            <span class="field-help">不可为空</span>
          </label>
          <input class="input" name="slug" data-lowercase="true" placeholder="sermo-lab" />
          ${state.entryErrors.slug ? `<div class="validation-error">${state.entryErrors.slug}</div>` : ""}
        </div>
        <div class="input-row">
          <div>
            <label class="field-label">昵称</label>
            <input class="input" name="nickname" placeholder="例如：Alex Nova" />
            ${state.entryErrors.nickname ? `<div class="validation-error">${state.entryErrors.nickname}</div>` : ""}
          </div>
          <div>
            <label class="field-label">访问密码</label>
            <input class="input" name="password" placeholder="可选" />
          </div>
        </div>
        <div class="inline-note">
          <strong>状态要求：</strong>错误文案贴字段展示；昵称重复时给出可行动建议；提交成功后直接进入聊天主界面。
        </div>
      `,
      cta: "进入 Space",
    },
  };

  const copy = modeCopy[state.entryMode];

  return `
    ${topbar()}
    <main class="shell page">
      <section class="entry-layout">
        <div class="entry-hero">
          <div>
            <span class="hero-badge">
              <span class="material-symbols-outlined">bolt</span>
              快 / 酷 / 清 / 稳
            </span>
            <h1>Space-based IM for expressive circles.</h1>
            <p>
              这个原型严格按文档把 IA、视觉 token、关键状态和移动端路径放进来。视觉方向延续你在
              <span class="mono">design/</span> 中的霓虹街头语气，但应用层更克制、更偏产品可用性。
            </p>
          </div>
          <div class="hero-metrics">
            <div class="metric">
              <p class="metric-value">3</p>
              <p class="metric-label">桌面端核心栏位</p>
            </div>
            <div class="metric">
              <p class="metric-value">60s</p>
              <p class="metric-label">验证码倒计时</p>
            </div>
            <div class="metric">
              <p class="metric-value">44px</p>
              <p class="metric-label">移动触达最小尺寸</p>
            </div>
          </div>
        </div>

        <section class="card">
          <div class="card-header">
            <p class="eyebrow">${copy.eyebrow}</p>
            <h2 class="card-title">${copy.title}</h2>
            <p class="card-subtitle">${copy.subtitle}</p>
          </div>

          <div class="mode-switch">
            <button class="mode-pill ${state.entryMode === "create" ? "active" : ""}" data-entry-mode="create">创建</button>
            <button class="mode-pill ${state.entryMode === "login" ? "active" : ""}" data-entry-mode="login">登录</button>
            <button class="mode-pill ${state.entryMode === "join" ? "active" : ""}" data-entry-mode="join">加入</button>
          </div>

          <form class="form-grid" data-entry-form="${state.entryMode}">
            ${copy.fields}
            <div class="button-row">
              <button class="button" type="submit">
                <span>${copy.cta}</span>
                <span class="material-symbols-outlined">east</span>
              </button>
              <button class="ghost-button" type="button" data-route="/app/chats">查看主界面</button>
            </div>
          </form>

          <p class="prototype-note">推荐路由：<span class="mono">/entry /space/create /space/login /space/join</span>。当前原型统一收敛在进入页切换，便于快速走查设计。</p>
        </section>
      </section>
      ${mobileNav()}
    </main>
    <div class="footer-note">当前为前端设计原型，不依赖后端接口；交互状态以 mock 数据模拟真实业务场景。</div>
  `;
}

function chatView() {
  const chat = activeChat();
  const headerTitle = chat.type === "direct" ? "私聊资料" : "群聊详情";

  return `
    ${topbar()}
    <main class="shell page">
      <section class="app-layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <p class="eyebrow">Chats</p>
            <h2 class="panel-title">会话列表</h2>
            <div class="search-box"><span class="material-symbols-outlined">search</span> 搜索会话名 / 用户名</div>
            <div class="button-row">
              <button class="ghost-button"><span class="material-symbols-outlined">add</span> 发起私聊</button>
              <button class="ghost-button"><span class="material-symbols-outlined">groups</span> 创建群</button>
            </div>
          </div>
          <div class="sidebar-scroll">
            <div class="chat-list">
              ${chats
                .map(
                  (item) => `
                    <button class="chat-item ${item.id === chat.id ? "active" : ""}" data-route="/app/chats/${item.id}">
                      <div class="avatar-wrap">
                        <div class="avatar ${item.online ? "status-online" : ""}">${formatAvatar(item.title)}</div>
                      </div>
                      <div style="text-align:left">
                        <p class="chat-name">${item.title}</p>
                        <div class="detail-text">${item.preview}</div>
                      </div>
                      <div>
                        <div class="chat-time">${item.time}</div>
                        ${item.unread ? `<span class="small-badge">${item.unread > 99 ? "99+" : item.unread}</span>` : ""}
                      </div>
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
        </aside>

        <section class="message-pane">
          <div class="message-header">
            <div class="message-header-meta">
              <div class="avatar-wrap">
                <div class="avatar-large ${chat.online ? "status-online" : ""}">${formatAvatar(chat.title)}</div>
              </div>
              <div>
                <h2 class="message-title">${chat.title}</h2>
                <div class="detail-text">${chat.subtitle} · ${chat.members} 位成员</div>
              </div>
            </div>
            <div class="button-row">
              <button class="icon-button"><span class="material-symbols-outlined">group_add</span></button>
              <button class="icon-button"><span class="material-symbols-outlined">more_horiz</span></button>
            </div>
          </div>

          <div class="message-scroll">
            <div class="day-divider">今天</div>
            ${chat.messages
              .map(
                (message) => `
                  <div class="message-group ${message.from === "self" ? "self" : ""}">
                    <div class="avatar" style="width:36px;height:36px;border-radius:12px;font-size:.78rem">${formatAvatar(message.name)}</div>
                    <div class="message-bubbles">
                      <div class="message-bubble ${message.from === "self" ? "self" : "other"}">${message.text}</div>
                      <div class="message-meta">
                        <span>${message.time}</span>
                        ${message.from === "self" ? `<span class="material-symbols-outlined" style="font-size:14px;color:var(--brand-primary)">done_all</span>` : ""}
                      </div>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>

          <form class="composer" data-chat-form="${chat.id}">
            <div class="composer-row">
              <button class="icon-button" type="button"><span class="material-symbols-outlined">add_circle</span></button>
              <textarea
                class="textarea"
                name="message"
                placeholder="输入消息，Enter 发送，Shift + Enter 换行"
              >${state.chatDrafts[chat.id] || ""}</textarea>
              <button class="button" type="submit"><span class="material-symbols-outlined">send</span>发送</button>
            </div>
          </form>
        </section>

        <aside class="panel">
          <div class="panel-header" style="padding:0 0 16px;border-bottom:1px solid rgba(232,235,242,.9)">
            <p class="eyebrow">Context</p>
            <h3 class="panel-title">${headerTitle}</h3>
            <p class="card-subtitle">${chat.detail.summary}</p>
          </div>
          <div class="panel-scroll" style="padding-top:18px">
            <div class="detail-list">
              <div class="detail-card">
                <div class="detail-row">
                  <div>
                    <strong>当前状态</strong>
                    <div class="detail-text">${chat.detail.relation}</div>
                  </div>
                  <span class="status-chip">${chat.online ? "在线" : "离线"}</span>
                </div>
                <div class="detail-row">
                  <div>
                    <strong>最后同步</strong>
                    <div class="detail-text">基于 heartbeat 判定，不由前端本地推断。</div>
                  </div>
                </div>
              </div>

              <div class="detail-card">
                <strong>快捷操作</strong>
                <div class="settings-actions" style="margin-top:12px">
                  ${chat.detail.actions.map((action, index) => `<button class="${index === 2 ? "danger-button" : "ghost-button"}">${action}</button>`).join("")}
                </div>
              </div>

              <div class="detail-card">
                <strong>交互约束</strong>
                <div class="detail-text" style="margin-top:10px">
                  消息按时间连续分组，同人同分钟可并组。输入区固定底部，消息新到达时采用轻弹反馈。
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
      ${mobileNav("chats")}
    </main>
  `;
}

function friendsView() {
  return `
    ${topbar()}
    <main class="shell page">
      <section class="friend-shell">
        <div class="panel">
          <div class="panel-header" style="padding:0 0 16px;border-bottom:1px solid rgba(232,235,242,.9)">
            <p class="eyebrow">Friends</p>
            <h2 class="panel-title">好友与申请</h2>
            <p class="card-subtitle">Basic 用户默认隐藏“发起好友申请”主按钮；若接口被拒绝，需要给出升级引导。</p>
          </div>

          <div class="tab-row" style="padding:18px 0">
            <button class="tab-chip ${state.friendTab === "incoming" ? "active" : ""}" data-friend-tab="incoming">Incoming (${friendRequests.incoming.length})</button>
            <button class="tab-chip ${state.friendTab === "outgoing" ? "active" : ""}" data-friend-tab="outgoing">Outgoing (${friendRequests.outgoing.length})</button>
            <button class="tab-chip ${state.friendTab === "accepted" ? "active" : ""}" data-friend-tab="accepted">Friends (${friendRequests.accepted.length})</button>
          </div>

          <div class="${state.friendTab === "accepted" ? "settings-list" : "request-list"}">
            ${
              state.friendTab === "accepted"
                ? friendRequests.accepted
                    .map(
                      (friend) => `
                        <div class="request-card">
                          <div class="request-head">
                            <div class="request-profile">
                              <div class="mini-avatar ${friend.status === "在线" ? "status-online" : ""}">${formatAvatar(friend.name)}</div>
                              <div>
                                <strong>${friend.name}</strong>
                                <div class="detail-text">${friend.status}</div>
                              </div>
                            </div>
                            <div class="request-actions">
                              <button class="ghost-button">发起私聊</button>
                              <button class="danger-button">删除好友</button>
                            </div>
                          </div>
                          <div class="detail-text" style="margin-top:12px">${friend.mood}</div>
                        </div>
                      `
                    )
                    .join("")
                : friendRequests[state.friendTab]
                    .map(
                      (request) => `
                        <div class="request-card">
                          <div class="request-head">
                            <div class="request-profile">
                              <div class="mini-avatar ${request.level === "Verified" ? "status-online" : ""}">${formatAvatar(request.name)}</div>
                              <div>
                                <strong>${request.name}</strong>
                                <div class="detail-text">${request.level} · ${request.time}</div>
                              </div>
                            </div>
                            <span class="status-chip">${state.friendTab === "incoming" ? "待处理" : "挂起中"}</span>
                          </div>
                          <div class="detail-text" style="margin:14px 0">${request.note}</div>
                          <div class="request-actions">
                            ${
                              state.friendTab === "incoming"
                                ? `
                                  <button class="button">同意</button>
                                  <button class="ghost-button">拒绝</button>
                                `
                                : `
                                  <button class="ghost-button">发消息提醒</button>
                                  <button class="danger-button">撤回</button>
                                `
                            }
                          </div>
                        </div>
                      `
                    )
                    .join("")
            }
          </div>
        </div>

        <div class="settings-list">
          <div class="restriction-banner">
            <span class="material-symbols-outlined" style="color:var(--brand-primary)">lock_open</span>
            <div>
              <strong>Basic 限制态</strong>
              <div class="detail-text" style="margin-top:6px">当前账号只能保留 5 个挂起中的 outgoing request。直接请求接口被拒绝时，弹出升级引导而不是静默失败。</div>
              <div class="button-row" style="margin-top:14px">
                <button class="button" data-route="/app/settings/account">升级到 Verified</button>
                <button class="ghost-button" data-route="/app/space-users/online">去在线用户页</button>
              </div>
            </div>
          </div>

          <div class="settings-card">
            <p class="eyebrow">Permissions</p>
            <h3 class="settings-headline">受限交互说明</h3>
            <div class="detail-list" style="margin-top:14px">
              <div class="detail-row">
                <div>
                  <strong>主动加好友</strong>
                  <div class="detail-text">Basic 隐藏主 CTA</div>
                </div>
                <span class="small-badge">LOCKED</span>
              </div>
              <div class="detail-row">
                <div>
                  <strong>响应申请</strong>
                  <div class="detail-text">所有等级均可操作</div>
                </div>
                <span class="status-chip">OPEN</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      ${mobileNav("friends")}
    </main>
  `;
}

function usersView() {
  const list = state.usersTab === "online" ? users.filter((user) => user.online) : users;
  return `
    ${topbar()}
    <main class="shell page">
      <section class="directory-shell">
        <div class="panel">
          <div class="panel-header" style="padding:0 0 16px;border-bottom:1px solid rgba(232,235,242,.9)">
            <p class="eyebrow">Space Users</p>
            <h2 class="panel-title">${state.usersTab === "online" ? "在线用户" : "Space 用户列表"}</h2>
            <p class="card-subtitle">支持检索、分页加载和在线过滤。在线状态以后端心跳结果为准。</p>
            <div class="tab-row" style="margin-top:18px">
              <button class="tab-chip ${state.usersTab === "directory" ? "active" : ""}" data-route="/app/space-users">全部用户</button>
              <button class="tab-chip ${state.usersTab === "online" ? "active" : ""}" data-route="/app/space-users/online">只看在线</button>
            </div>
          </div>
          <div class="panel-scroll" style="padding-top:18px">
            <div class="search-box"><span class="material-symbols-outlined">search</span> 输入昵称关键字 / 分页加载占位</div>
            <div class="user-grid">
              ${list
                .map(
                  (user) => `
                    <div class="user-card">
                      <div class="user-head">
                        <div class="user-profile">
                          <div class="mini-avatar ${user.online ? "status-online" : ""}">${formatAvatar(user.name)}</div>
                          <div>
                            <strong>${user.name}</strong>
                            <div class="detail-text">${user.level} · ${user.online ? "在线" : "离线"}</div>
                          </div>
                        </div>
                        <span class="status-chip">${user.online ? "alive" : "offline"}</span>
                      </div>
                      <div class="detail-text" style="margin:14px 0">${user.bio}</div>
                      <div class="user-actions">
                        <button class="button">发起私聊</button>
                        <button class="ghost-button">${user.level === "Basic" ? "升级后可加好友" : "发起好友申请"}</button>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>

        <aside class="panel">
          <div class="panel-header" style="padding:0 0 16px;border-bottom:1px solid rgba(232,235,242,.9)">
            <p class="eyebrow">Realtime</p>
            <h3 class="panel-title">在线状态规范</h3>
          </div>
          <div class="panel-scroll" style="padding-top:18px">
            <div class="detail-list">
              <div class="detail-card">
                <strong>判定来源</strong>
                <div class="detail-text" style="margin-top:10px">每 60 秒心跳，UI 不自行猜测在线，避免出现“看起来在线但后端已超时”的假状态。</div>
              </div>
              <div class="detail-card">
                <strong>视觉表达</strong>
                <div class="detail-text" style="margin-top:10px">在线点使用弱呼吸感，不做强闪烁；同时附文案 “在线 / 离线”。</div>
              </div>
              <div class="detail-card">
                <strong>分页建议</strong>
                <div class="detail-text" style="margin-top:10px">首屏展示 12 个卡片；继续加载使用按钮或无限滚动，保持列表节奏稳定。</div>
              </div>
            </div>
          </div>
        </aside>
      </section>
      ${mobileNav("space")}
    </main>
  `;
}

function settingsView() {
  const tab = state.settingsTab;
  return `
    ${topbar()}
    <main class="shell page">
      <section class="settings-shell">
        <aside class="panel settings-sidebar">
          <p class="eyebrow">Settings</p>
          <h2 class="panel-title">设置中心</h2>
          <div class="settings-list" style="margin-top:18px">
            <button class="settings-nav-item ${tab === "account" ? "active" : ""}" data-route="/app/settings/account">
              <span>
                <strong>账号升级</strong>
                <div class="detail-text">Basic / Verified 身份、邮箱验证</div>
              </span>
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <button class="settings-nav-item ${tab === "notifications" ? "active" : ""}" data-route="/app/settings/notifications">
              <span>
                <strong>通知偏好</strong>
                <div class="detail-text">渠道级开关与离线阈值</div>
              </span>
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
            <button class="settings-nav-item ${tab === "contacts" ? "active" : ""}" data-route="/app/settings/contacts">
              <span>
                <strong>联系方式绑定</strong>
                <div class="detail-text">Email / SMS / Bark</div>
              </span>
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </aside>

        <div class="settings-list">
          ${
            tab === "account"
              ? accountSettings()
              : tab === "notifications"
                ? notificationSettings()
                : contactSettings()
          }
        </div>
      </section>
      ${mobileNav("settings")}
    </main>
  `;
}

function accountSettings() {
  return `
    <section class="settings-card upgrade-card">
      <div class="upgrade-hero">
        <p class="eyebrow" style="color:rgba(255,255,255,.76)">Current Identity</p>
        <h3 class="settings-headline" style="color:white">Basic Account</h3>
        <p style="margin:8px 0 0;max-width:32rem;line-height:1.6">发送验证码、输入验证码与密码、完成升级。升级成功后解锁主动加好友和更高可信身份。</p>
      </div>
      <div class="upgrade-body">
        <div class="detail-list">
          <div class="detail-card">
            <div class="detail-row">
              <div>
                <strong>当前等级</strong>
                <div class="detail-text">Basic / 未完成邮箱验证</div>
              </div>
              <span class="small-badge">BASIC</span>
            </div>
          </div>
          <form class="detail-card">
            <div>
              <label class="field-label">验证邮箱</label>
              <input class="input" placeholder="alex@sermo.space" />
            </div>
            <div class="button-row" style="margin-top:14px">
              <button class="ghost-button" type="button" data-action="send-code">发送验证码</button>
              <button class="button" type="button">输入验证码 + 设置密码</button>
            </div>
            <div class="prototype-note">升级成功状态需要明确给出 icon 打勾动画与身份切换反馈。</div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function notificationSettings() {
  const channels = [
    ["email", "Email", "邮件提醒，适合正式通知"],
    ["sms", "SMS", "短信提醒，成本更高但到达更直接"],
    ["bark", "Bark", "针对即时推送场景"],
  ];

  return `
    <section class="settings-card">
      <div class="settings-header" style="padding:0 0 16px;border-bottom:1px solid rgba(232,235,242,.9)">
        <p class="eyebrow">Notifications</p>
        <h3 class="settings-headline">通知偏好</h3>
        <p class="card-subtitle">每个渠道独立配置启用状态和离线阈值，避免表格化表达。</p>
      </div>
      <div class="pref-grid" style="padding-top:18px">
        ${channels
          .map(([key, label, desc]) => {
            const pref = state.notificationPrefs[key];
            return `
              <div class="detail-card">
                <div class="channel-row">
                  <div>
                    <strong>${label}</strong>
                    <div class="detail-text">${desc}</div>
                  </div>
                  <button class="switch ${pref.enabled ? "active" : ""}" data-toggle-channel="${key}" aria-label="toggle ${label}"></button>
                </div>
                <div class="threshold-row" style="margin-top:14px">
                  <div>
                    <strong>离线阈值</strong>
                    <div class="detail-text">超过该分钟数仍未在线时触发</div>
                  </div>
                  <div class="stepper">
                    <button type="button" data-step-channel="${key}" data-step-dir="-1">−</button>
                    <input class="stepper-input mono" value="${pref.threshold}" readonly />
                    <button type="button" data-step-channel="${key}" data-step-dir="1">+</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function contactSettings() {
  const channels = [
    ["email", "Email", state.contacts.email],
    ["sms", "SMS", state.contacts.sms],
    ["bark", "Bark", state.contacts.bark],
  ];

  return `
    <section class="settings-card">
      <div class="settings-header" style="padding:0 0 16px;border-bottom:1px solid rgba(232,235,242,.9)">
        <p class="eyebrow">Contacts</p>
        <h3 class="settings-headline">联系方式绑定</h3>
        <p class="card-subtitle">统一采用“发送验证码 → 输入验证码 → 完成绑定”的流程，按渠道拆卡片呈现。</p>
      </div>
      <div class="contact-grid" style="padding-top:18px">
        ${channels
          .map(
            ([key, label, value]) => `
              <div class="detail-card">
                <div class="contact-row">
                  <div>
                    <strong>${label}</strong>
                    <div class="detail-text">${value}</div>
                  </div>
                  <span class="status-chip">已绑定</span>
                </div>
                <div class="button-row" style="margin-top:14px">
                  <button class="ghost-button" type="button" data-action="send-code">发送验证码</button>
                  <button class="button" type="button">更新 ${label}</button>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function mobileNav(active = "") {
  const items = [
    ["chats", "/app/chats", "chat", "聊天"],
    ["friends", "/app/friends/requests", "group", "好友"],
    ["space", "/app/space-users", "public", "空间"],
    ["settings", "/app/settings/account", "settings", "设置"],
  ];
  return `
    <nav class="mobile-nav">
      ${items
        .map(
          ([key, route, icon, label]) => `
            <button class="nav-button ${active === key ? "active" : ""}" data-route="${route}">
              <span class="material-symbols-outlined">${icon}</span>
              ${label}
            </button>
          `
        )
        .join("")}
    </nav>
  `;
}

function renderNotFound() {
  return `
    ${topbar()}
    <main class="shell page">
      <div class="empty-state">
        <h2 class="panel-title">未找到该视图</h2>
        <p>当前原型已覆盖文档中的关键页面，你可以直接回到入口页或聊天页继续查看。</p>
        <div class="button-row" style="justify-content:center;margin-top:16px">
          <button class="button" data-route="/entry">回到入口</button>
          <button class="ghost-button" data-route="/app/chats">打开聊天</button>
        </div>
      </div>
    </main>
  `;
}

function render() {
  syncRoute();

  let html = "";
  if (state.route === "/entry") {
    html = entryView();
  } else if (state.route === "/app" || state.route === "/app/chats" || state.route.startsWith("/app/chats/")) {
    html = chatView();
  } else if (state.route === "/app/friends" || state.route === "/app/friends/requests") {
    html = friendsView();
  } else if (state.route === "/app/space-users" || state.route === "/app/space-users/online") {
    html = usersView();
  } else if (
    state.route === "/app/settings/account" ||
    state.route === "/app/settings/notifications" ||
    state.route === "/app/settings/contacts"
  ) {
    html = settingsView();
  } else {
    html = renderNotFound();
  }

  app.innerHTML = html;
}

function startCountdown() {
  if (state.codeCountdown > 0) return;
  state.codeCountdown = 60;
  render();
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  countdownTimer = setInterval(() => {
    state.codeCountdown -= 1;
    if (state.codeCountdown <= 0) {
      state.codeCountdown = 0;
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (state.route === "/entry" || state.route.startsWith("/app/settings")) {
      render();
    }
  }, 1000);
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-route], [data-entry-mode], [data-action], [data-friend-tab], [data-toggle-channel], [data-step-channel]");
  if (!target) return;

  if (target.dataset.route) {
    navigate(target.dataset.route);
    return;
  }

  if (target.dataset.entryMode) {
    state.entryMode = target.dataset.entryMode;
    state.entryErrors = {};
    render();
    return;
  }

  if (target.dataset.action === "send-code") {
    if (state.codeCountdown === 0) {
      startCountdown();
    }
    return;
  }

  if (target.dataset.friendTab) {
    state.friendTab = target.dataset.friendTab;
    render();
    return;
  }

  if (target.dataset.toggleChannel) {
    const channel = target.dataset.toggleChannel;
    state.notificationPrefs[channel].enabled = !state.notificationPrefs[channel].enabled;
    render();
    return;
  }

  if (target.dataset.stepChannel) {
    const channel = target.dataset.stepChannel;
    const dir = Number(target.dataset.stepDir);
    const next = state.notificationPrefs[channel].threshold + dir;
    state.notificationPrefs[channel].threshold = Math.max(1, next);
    render();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

  if (target.dataset.lowercase === "true") {
    target.value = target.value.toLowerCase();
  }

  if (target instanceof HTMLTextAreaElement && target.form?.dataset.chatForm) {
    state.chatDrafts[target.form.dataset.chatForm] = target.value;
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;

  if (event.key === "Enter" && !event.shiftKey && target.form?.dataset.chatForm) {
    event.preventDefault();
    target.form.requestSubmit();
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.dataset.entryForm) {
    const formData = new FormData(form);
    const errors = {};
    const slug = String(formData.get("slug") || "").trim().toLowerCase();
    const nickname = String(formData.get("nickname") || "").trim();

    if (!slug) {
      errors.slug = "请输入 Space slug，系统会自动转为小写。";
    }
    if (form.dataset.entryForm === "join" && !nickname) {
      errors.nickname = "昵称是加入 Space 的必填项，用于唯一身份识别。";
    }

    state.entryErrors = errors;
    if (Object.keys(errors).length === 0) {
      navigate("/app/chats");
      return;
    }
    render();
    return;
  }

  if (form.dataset.chatForm) {
    const chatId = Number(form.dataset.chatForm);
    const message = String(new FormData(form).get("message") || "").trim();
    if (!message) return;
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;
    chat.messages.push({
      from: "self",
      name: "我",
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      text: message,
    });
    chat.preview = message;
    chat.time = "刚刚";
    state.chatDrafts[chatId] = "";
    render();
  }
});

window.addEventListener("hashchange", render);

syncRoute();
render();
