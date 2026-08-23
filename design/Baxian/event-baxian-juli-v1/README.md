# “八仙聚力”竖屏活动素材 v1

## 文件

- `title-baxian-juli.png`：透明底标题母版
- `title-baxian-juli-1200.png`：大屏标题
- `title-baxian-juli-800.png`：常规移动端标题
- `title-baxian-juli-480.png`：低带宽/小屏标题
- `event-background-portrait.png`：竖屏活动背景，杨戬近景怒视、孙悟空远处云上盘坐
- `event-background-portrait.webp`：Web 交付版
- `event-banner.png` / `event-banner.webp`：带“八仙聚力”标题的 3:1 活动横条
- `event-banner-background.png` / `.webp`：仅含剑、玉净瓶、黑斗笠的无字横条背景
- `event-banner-1080.*`、`event-banner-750.*`：移动端常用横条尺寸
- `source/`：ImageGen 原始/抠像中间稿

## 页面落位

背景应覆盖活动页面而不是单张卡片：

```css
.baxian-event {
  min-height: 100dvh;
  background-color: #171a38;
  background-image: url('./event-background-portrait.webp');
  background-position: top center;
  background-repeat: no-repeat;
  background-size: 100% auto;
}

.baxian-event__title {
  display: block;
  width: min(78vw, 520px);
  height: auto;
  margin-inline: auto;
}
```

建议标题放在顶部安全区下方、两个人物视线之间；不要遮挡杨戬侧脸、孙悟空或额间/头顶饰物。正文、活动规则、按钮和榜单从画面约 `62%` 高度后开始，以底部纯色区域承载。

窄屏应保持 `background-position: top center`，避免使用 `cover` 导致人物被横向裁切。宽屏预览可限制容器宽度并用 `#171a38` 补齐两侧。

横条默认使用带标题的 WebP；如果页面需要动态标题、角标或国际化文字，则使用 `event-banner-background.webp`，在中央约 42% 的安全区叠加 DOM 内容。不要裁切左右边缘，否则会损失长剑、黑斗笠或玉净瓶。

## 设计约束

- 杨戬使用电影银蓝甲胄、浅色披风及双叉束冠造型；背侧朝向孙悟空，仅露约 1/6 侧脸，通过紧绷侧脸与外翻施力手掌表达克制怒意。
- 孙悟空使用电影成熟长脸、金棕毛发、蓝领红披风与金甲造型。
- 两人只呈现对峙，不进入直接战斗。
- 页面底部不应追加高亮纹样，以免破坏正文可读性。
