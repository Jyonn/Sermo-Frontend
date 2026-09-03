# 蜘蛛侠 IP 头像框 v1

## 文件

- `source/spider-avatar-frame.svg`：可编辑矢量源文件，透明中心与透明外部背景。
- `assets/spider-avatar-frame-1024.png`：高清透明母版。
- `assets/spider-avatar-frame-512.webp`：常规头像框资源。
- `assets/spider-avatar-frame-256.webp`：聊天列表轻量资源。

## 设计结构

- 红蓝战衣细环承担主体轮廓，右上为从边缘探出的蒙面蜘蛛侠。
- 左上银白蛛网与底部黑色蜘蛛扣形成对角平衡。
- 头像中心保持透明，装饰主要分布在圆环外侧，小尺寸下不会大面积遮挡用户面部。

## 前端使用

头像与头像框应使用同一个正方形定位容器：

```css
.avatar-frame-image {
  position: absolute;
  inset: -18%;
  width: 136%;
  height: 136%;
  object-fit: contain;
  pointer-events: none;
  z-index: 2;
}
```

建议头像本体保持圆形，框资源扩大到头像尺寸的 `1.36` 倍。右上人物会超出头像边界，因此外层容器不能设置 `overflow: hidden`；只裁剪头像图片所在的内层。

## 生成说明

本轮首先使用内置 ImageGen 生成透明位图，但服务在输出阶段拦截了蜘蛛侠角色，没有产生可用结果。最终交付采用确定性的 SVG 矢量设计，并用 `sharp` 导出透明 PNG/WebP。
