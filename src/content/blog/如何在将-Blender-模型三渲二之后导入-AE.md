---
title: 如何在将 Blender 模型三渲二之后导入 AE
date: '2021-12-15T02:22:30.000Z'
author: Aaron Xu
tags:
  - Blender
  - 动效设计
  - AE
categories:
  - 炜哥的研究笔记
excerpt: >-
  针对于目前 Lottie 暂不支持3D 动画的情况，如果想要在手机上播放手机旋转的动画，只能在 AE 上逐帧 K。 目前想到一个可行的方式，是在
  Blender 上完成 3D 动画的制作，然后通过 Freestyle SVG 的方式导出 SVG 序列帧，最后将 SVG 变为路径导
minutes: 3
---
针对于目前 Lottie 暂不支持3D 动画的情况，如果想要在手机上播放手机旋转的动画，只能在 AE 上逐帧 K。 目前想到一个可行的方式，是在 Blender 上完成 3D 动画的制作，然后通过 Freestyle SVG 的方式导出 SVG 序列帧，最后将 SVG 变为路径导入到 AE 中，完成 SVG 的序列动画。



## Blender 导出 SVG

这里使用了一个 Freestyle SVG 插件。

在渲染属性中将 SVG 导出打开

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxca7so475j30uu0bsgm9.jpg)

因为 AE 不支持 SVG 动画直接导入，而且直接导出的 SVG 还需要进行一些处理，所以这里选择帧。

Blender** 不支持分层导出填充色，这里可以不勾选，

线条是后面辅助我们上色用的，所以线条宽度使用绝对即可。

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxca7rd57rj30ui0sctak.jpg)

这里只勾选了导出笔画，因为发现导出的填充并不好用（后续会直接在 Figma 里面用一个插件处理填充）

一定要加上线条集，不然导出的 SVG 中就没有线条了。

导出完成，然后导入到 Figma 中，在 Figma 中完成对线条的优化以及上色。

## Figma 内优化
figma 内的优化分为两个部分：路径点的优化和填色
### 路径点的优化
直接导出的路径会存在很多的无用路径点，例如一条直线上可能隔一段距离就会进行打点。这些路径点通过通过计算相邻三个点的夹角就可以直接进行判断，看是否要移除。

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxca7s92boj30u00xx0sz.jpg)

如上图，左侧边三点的角度为179.7，近似于三点共线，可以将中间的点直接移除。

这里举一个实际的优化例子：

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxca7t24imj31ep0u0wfb.jpg)

可以看到边上的点都已经被优化完成，矢量点数量有明显减少。

这里其实还可以通过将圆角处的点优化为贝塞尔曲线点的形式，来进一步减少锚点数量，不过目前还没想到合适的算法去对它进行处理。

当然目前路径点优化并不完美，因为目前 Blender 导出的线条有时会比较碎片，比如曲线有可能被分成多段显示：

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxca7tijg1j30u00u0aa2.jpg)

此时需要用户对这样的线段进行手动处理，头尾相接合并为一段，这个在之后也会通过插件进行实现。

### 填色
至于填色，稍微麻烦一些，需要用户完成第一帧画板的手动上色，然后第二帧会去寻找和第一帧画板中相近的元素，并进行颜色的复制，如此重复直到最后一个画板，就可以将所有帧都完成上色。

当然这一步之前你需要确保前一步所有的线段都完成了处理，不然相近元素有可能出现错误，可能出现如下错误：

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxc6ihb37qj30u00u00sx.jpg)

背后的曲线被分成了两端，所以选择了较大的那一块进行上色，这并不是我们想要的效果。

最后，上完色之后记得选择所有形状然后将描边去除。

## 导入AE

使用 AEUX 工具将所有序列帧导入 AE 之后，设置每帧合适的时间长度（我这里设置为1帧），然后使用关键帧辅助将图层都错开。

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxcaeelq15j31fs0pcgq9.jpg)

完成后，直接使用 Bodymovin 完成 Lottie 的文件输出。

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxcangxwowj30ea09cjrp.jpg)

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxcar2o7gyj30wk0c8dgg.jpg)

输出的文件体积相对会比较大（相对 AE K帧），但是渲染的性能却能满足要求。

这里提供一个比较理想的效果：

![](https://tva1.sinaimg.cn/large/008i3skNgy1gxeaxve7hpg30u00u0n10.gif)

Gif 画质有所压缩，建议下载 [json 文件](https://nangonghan.oss-cn-beijing.aliyuncs.com/Lottie/2021-12-15 10%3A17%3A43.522_compress.json)预览

## 后续提升思路

性能已经能满足要求，后续以减少文件体积为目标进行优化。

1. 精简矢量图中的锚点数量，将圆角处的点进行优化
2. 在 AE 中对完全一致的两帧进行合并处理
