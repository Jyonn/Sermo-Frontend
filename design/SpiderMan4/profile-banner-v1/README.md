# 蜘蛛侠 IP 个人主页横幅 v1

## 文件

- `source/profile-banner-imagegen-master.png`：ImageGen 原始母版，1774×887。
- `assets/spider-profile-banner-1774x887.png`：无损 2:1 主版本。
- `assets/spider-profile-banner-1536x768.webp`：推荐的高清 WebP。
- `assets/spider-profile-banner-1024x512.webp`：常规加载版本。
- `assets/spider-profile-banner-mobile-1400x800.webp`：1.75:1 移动端/窄抽屉版本。
- `assets/spider-profile-banner-preview-1200x480.webp`：2.5:1 收藏卡片预览版本。

## 构图说明

- 左下 38% 为头像遮挡安全区；该区域故意保持低对比、少细节。
- 右侧纽约天际线、雨后屋顶和远处摆荡身影提供蜘蛛侠 IP 识别。
- 不在图片内写入名称或活动文案，用户名、状态和徽章继续由前端渲染。
- 图像焦点约为 `64% 44%`，在不同容器比例下应优先保留右侧天际线和摆荡身影。

## 前端接入

完整个人主页优先按容器比例切换资源：

```css
.profile-theme-spider-city .user-profile-cover {
  background: url('/assets/profile-card-themes/spider-profile-banner-1536x768.webp') 64% 44% / cover no-repeat;
}

@media (max-width: 560px) {
  .profile-theme-spider-city .user-profile-cover {
    background-image: url('/assets/profile-card-themes/spider-profile-banner-mobile-1400x800.webp');
  }
}
```

头像仍应在横幅左下方叠放。建议增加从透明到 `rgba(3, 11, 20, .72)` 的底部渐变，以保证用户名和在线状态稳定可读。

## ImageGen 最终提示词

用途为移动优先社交聊天 Web App 的个人主页横幅；雨后蓝调时刻的曼哈顿屋顶峡谷，深海军蓝建筑与少量暖色窗灯、红色反光；银白蛛网连接建筑角落；右上远处仅有一个很小的红蓝蒙面摆荡身影；左下 38% 保持安静深色，供头像覆盖；2:1 横向构图，可在 1.75:1–2.6:1 范围安全裁切；写实电影海报质感；无近景人物、无脸、无反派、无文字、无 Logo、无边框和 UI。

生成方式：Codex 内置 ImageGen。最终资源由母版确定性裁切并导出为 PNG/WebP。
