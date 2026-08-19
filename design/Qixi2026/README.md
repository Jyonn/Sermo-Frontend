# Sermo 2026 七夕全站主题：鹊桥夜航

这是网站级季节主题，不属于聊天气泡、聊天室背景或个人用户装扮。主题以根节点 `data-site-theme="qixi-2026"` 为唯一开关，并继续尊重现有 `data-theme="light|dark"`。

## 设计方向

- 主叙事：靛青夏夜中的银汉、鹊桥和红线，不使用情侣人物、爱心雨或婚庆粉色。
- 公共界面优先：装饰服务于全站 Header、Tab、页面背景、抽屉、空状态与活动入口，不能压过导航和内容。
- 克制动效：只有月轮徽记可做 1px 呼吸浮动；Header、背景和 Tab 托纹保持静态。
- 双模式：深色使用靛青丝纸，浅色使用月白纤维纸，不强制改变用户的明暗偏好。

## 素材

| 文件 | 用途 | 推荐显示 |
| --- | --- | --- |
| `assets/qixi-header-ribbon.webp` | 全站 Header 下缘、桌面侧栏顶部 | 高 40–64px |
| `assets/qixi-tab-underline.webp` | 激活 Tab、分段控件、页面小标题托纹 | 宽 80–140px，高 8–14px |
| `assets/qixi-corner-magpies.webp` | 空状态、抽屉、登录页、活动说明区角饰 | 宽 96–180px |
| `assets/qixi-moon-medallion.webp` | 品牌区、节日入口、加载状态 | 24–72px |
| `assets/qixi-background-light.webp` | 浅色网站背景 | 768px 平铺 |
| `assets/qixi-background-dark.webp` | 深色网站背景 | 768px 平铺 |

PNG 文件用于需要无损透明边缘的场景；WebP 用于线上展示。`source/` 保存五组 ImageGen 源图。

## 接入

将 `qixi-theme.css` 复制或导入应用样式入口，然后在活动生效期设置：

```ts
document.documentElement.dataset.siteTheme = "qixi-2026";
```

结束活动时只删除该属性：

```ts
delete document.documentElement.dataset.siteTheme;
```

不要覆盖 `data-theme`，它仍由现有明暗模式系统管理。

### Header

`qixi-theme.css` 会通过 `.topbar::after` 自动添加银汉横幅。Header 高度、按钮位置和点击区域均不改变；装饰层 `pointer-events: none`。

### Tab

原生 ARIA Tab 使用 `role="tab"` 与 `aria-selected="true"` 即可获得托纹。非 ARIA 组件添加：

```html
<button class="qixi-tab is-active">广场</button>
```

### 页面角饰

只给需要节日强调的容器添加类，不要让每张卡片都出现喜鹊：

```html
<section class="empty-state qixi-corner-decorated">...</section>
```

同一视口建议最多出现一个喜鹊角饰。

### 月轮入口

```html
<button class="qixi-festival-mark" aria-label="七夕活动"></button>
```

按钮文案必须通过现有中英文翻译键提供；图片本身不包含文字。

## 使用边界

- 不向 `.message-group`、`.message-bubble` 或个人资料组件注入本主题变量。
- 不改变业务状态颜色：错误仍为错误红，成功仍为成功绿。
- 内容密集页面可以只启用背景和 Header，不必使用角饰。
- `prefers-reduced-motion: reduce` 下不播放任何主题动画。
- 主题开关应由站点配置或活动时间窗控制，不写入用户个性化设置。
- 活动素材失效或加载失败时，CSS 颜色令牌仍能独立形成完整主题。

## 重建

```bash
python design/Qixi2026/build_assets.py
```

脚本会裁切透明素材并导出统一 PNG/WebP 规格，不会重新生成视觉内容。
