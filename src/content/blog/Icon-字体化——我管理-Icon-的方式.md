---
title: Icon 字体化——我管理 Icon 的方式
date: '2024-12-11T23:20:44.000Z'
author: Aaron Xu
tags:
  - 随笔
  - 设计
categories:
  - 随笔
excerpt: 最近我将自己团队的图标们升级了一下，现在的图标是这个样子的：
minutes: 9
---
最近我将自己团队的图标们升级了一下，现在的图标是这个样子的：

![image-20241211231230720](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241211231230720.png)



对，我将图标变成了一种字体，后续都可以直接通过字体的方式调用。只要安装了字体，哪怕不在设计软件中也能使用。

![image-20241211231751270](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241211231751270.png)

如果是对 Apple 的设计比较熟悉的人可能发现了，Apple 的图标“SF Symbol” 也是通过这种方式管理的。如果你平常使用的是 SF Pro 或者 PingFang SC 等字体，可以直接通过 Apple 官方的 [SF Symbols](https://developer.apple.com/sf-symbols/) 来查找复制并使用。

如果你使用的是 mac ，可以直接复制这些文字到 pages 或者 备忘录中，应该是可以显示出图标的：

􀌪􁅇􀵵

Apple 也是将图标直接做到了字体里，并广泛的用在了自己的设计体系中。那么这篇文章我会分享一下为什么这样做，以及如何这样做，也是作为自己在探索 Icon 字体化中的踩坑的记录。

## 字体化的好处

简单来说，就是性能好、易于使用和管理

### 性能好

即使是相较于同样是矢量图的 SVG 格式，字体文件的大小也出乎意料的小。我这里做了一个测试，250 个左右的图标，导出成 SVG 后大约是 900 KB，而对应的 woff 字体文件则是 60 KB。即使算上为了兼容旧浏览器而增加的 ttf 和 eot 格式，一共也不到 200 KB。

更小的尺寸带来的不止是加载速度更快，小到这个尺寸后，开发完全可以在网页初次启动时，直接将兼容的字体文件下载缓存，后续可以无缝的显示图标。而 SVG 一半是用到的时候再加载，可能存在加载出错图标无法显示的情况，通过多次网络请求也会轻微增加 Server 的负担。

前者是 60K 的单次请求（根据用户浏览器选择文件），后者是 900 K 共计的多次请求。很显然前者优于后者。

### 易于使用

我之前在设计还原的时候有个很烦的地方，虽然输出的 SVG 都是一样的格式，但是不同模块的开发者不一样，他们对于 SVG 的使用方式也“各有千秋”，经常导致最终的页面和设计师设计的有一些出入。

更加致命的是，这些出入还非常细微，比如说图标的正常尺寸是 16px，但是某个开发也许在实现时错误地应用了某种样式，最终尺寸变成了 15px。当下核查时很难看出 1px 的差异，不过当这些错误积累了几个之后，界面的错位就会比较严重了。

Icon font 的使用实际上是将图标用字体的方式进行渲染，字体的样式设置相对比较单一，不会出现 SVG 群魔乱舞一样的情况。而且，对于字体的 CSS 样式可以原封不动的用在 icon font 上，比如开发人员可以直接修改图标的大小和颜色，而不需要依赖设计师重新提供素材。

总之，减少了开发的使用成本，反过来也会让后期的设计核查轻松不少。

### 易于管理

这是最大的 benefit，也是推动我使用 iconfont 的最大原因。

我先讲讲之前团队的现状，我们的团队是一个 startup 公司，也就是创业团队。产品迭代的速度非常快，有时候甚至是上个版本开发到一半，设计和需求就改动了，对应的 icon 也更新的特别频繁。所以可以预见的是，在版本迭代了一段时间后，产品中不同版本的图标混杂在一起，设计师浪费了大量的时间在图标的细节核查上。

那么图标的管理就非常重要了，而管理图标的方式就是 icon font。

icon font 因为本身就是一种字体，而字体是有独特的 id 的。比如 emoji 也是一种字体，😀对应的 id 就是“U+1F600”，其他 emoji 也一样。这样后续如果更新了这个 emoji 样式，只要保证更新后的 emoji 还是这个 id，那么所有应用了这个图标的地方都会更新。

所以 icon font 的管理方式说白了就是，开发者在需要图标的地方通过 id 引用图标，而 font 文件中则包含了 id 和对应的图标信息。这样每次更新 font 文件都会更新网站中的所有对应图标。

而 font 文件则完全可以由设计师来维护。理想情况下，设计师更新图标后，将 SVG 们转成新的 iconfont，开发人员直接替换，就完成了一次图标更新，非常简单快捷。

那么 icon font 文件应该如何制作呢？请看下一章节。

## Icon Font 制作入门

步骤：

1. 调整 Icon 
2. 上传平台
3. 设置发布参数

搞定！

### 1. 调整 Icon

首先是要调整 Figma 中的图标，因为越简单的图标越不容易出问题，所以我建议是将形状中的 line 先 outline，然后全部合并 ，最后 flatten，总之是保证最后只有一个形状。

![image-20241212004559310](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212004559310.png)

按理来说三板斧下来这个图标应该只剩下填充，没有描边了，不过以防万一还是要确认一下。

![image-20241212005028804](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212005028804.png)

对了填充最好统一用同一个颜色，虽然不影响最后使用，但是一致了看着舒服。

最终导出的文件，应该是一个单图层，无描边仅填充的 SVG 文件。

### 2. 上传平台

国内虽然阿里有一个同名的 iconFont 网站，不过上传图标要审核，这里建议还是使用国外的 [icomoon](https://icomoon.io/app/#/select) 。Icomoon 虽然运行在浏览器，但应该属于本地软件（类似于 photopea），也不用担心自己的设计泄漏，只不过需要及时保存编辑的内容，不然浏览器一清缓存就没有了。

Anyway，上一部中导出的 SVG 们，可以直接导入到这个平台中。

![image-20241212010229584](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212010229584.png)



甚至还可以做一些简单的编辑，比如去色裁剪缩放。上一步里如果忘记去色了可以在这一步完成。

![image-20241212010330080](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212010330080.png)



> 需要注意的是，一些复杂的图标可能无法按你预期的。例如，如果我使用了不同的方式画了 googledrive 的图标，即使在 Figma 和系统中看上去一样，但导入后就会有明显的差异。
>
> ![image-20241212011229087](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212011229087.png)
>
> 
>
> 有办法调整，但这部分比较复杂，我放到后面再讲。

### 3. 设置发布参数

如果图标后续还存在迭代的可能，务必认真填写发布参数，不然后面版本会乱掉。

![image-20241212011910508](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212011910508.png)

<img src="https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212012020579.png" alt="image-20241212012020579" style="zoom:25%;" />

* 最下面的 Version 是最重要的，Major 是大版本号，Minor 是小版本号，高版本可以覆盖低版本。建议每次有新增图标就将 Minor 加一，如果图标整体风格改动较大就增加 Major
* 字体的名字和前后缀可以任意填写，不过最好先和开发确认，避免和他们定义的变量名重合了
* Font Metrics 适用于图标和文字混合输入的情况，比如 Apple 的 Symbol 就可以支持和文字一起输入。我的图标都是和文字独立的，就不需要考虑这个。
* 其他选项按默认的来



最终导出后，是一个压缩包，里面包含了字体文件和用于连接网页的 css，以及一些 demo 和简单教程。

![image-20241212012850952](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20241212012850952.png)

剩下的事情就是交付开发了。

### Important things

#### 版本管理

如果你没有清理系统垃圾的习惯，那么之前你在 icomoon 网站上编辑过的内容都会存在本地，下次点开就应该还在，可以继续更新图标，然后导出新版本的 icon font 文件。

但是，如果浏览器的缓存被清了，千万不要重新在 icomoon 上开一个新的项目，再次导入所有的 icon 文件。因为每次导入新图标时，icomoon 都会给图标创建一个 id 来对应图标。在新的项目中的每个 id - 图标 的对应关系，不太可能和旧项目一致，如果直接将新项目导出的文件交付开发，整个平台的图标都会乱掉。

这个时候，应该导入上个版本的项目文件，在那基础上继续更新。项目文件就是之前导出的文件中的 selection.json，里面包含了所有的图标和上个版本的发布参数。

#### SVG 的填充模式

SVG 是有两种填充模式的，nonzero 和 evenodd，具体的差别可以看[搞懂SVG/Canvas中nonzero和evenodd填充规则](https://www.zhangxinxu.com/wordpress/2018/10/nonzero-evenodd-fill-mode-rule/)，这篇讲的比较清楚。

icomoon 目前支持的是 nonzero 以及一些 简单形状的 evenodd。Figma 则是两种都支持，这就导致了，可能 SVG 在 evenodd 模式下看上去是正常的，在 nonzero 模式下就不如预期了。

Figma 中默认使用的是 evenodd 模式，但是依赖插件 [Vector Path Editor](https://www.figma.com/community/plugin/1391765568770221941) 可以切到 nonzero 模式，并调整在该模式下的填充规则。

对于一些复杂的图标，务必先在这个插件的帮助下调整填充模式进行预览。



## 总结

（下面是 GPT 生成的，我懒得写）

通过本文的介绍，相信你已经了解了 Icon 字体化的好处以及制作方法。以下是本文的核心总结：

1. **性能优异**

Icon 字体文件体积小，加载效率高，相比 SVG 格式更加适合网页的快速响应需求，减少多次网络请求和 Server 负担。

2. **使用方便**

Icon 字体统一了图标的管理方式，减少了 SVG 使用中可能出现的误差和不一致，让开发人员能够更高效地调整图标样式（如大小、颜色），降低了设计还原和沟通的成本。

3. **便于管理**

Icon 字体的 `id` 机制使得图标更新高效且规范，尤其适合频繁迭代的团队，可以确保图标版本管理清晰，避免因新建项目导致的图标错乱问题。

4. **制作简单**

从图标调整到平台上传，再到发布参数设置，只需几个简单的步骤即可完成。合理的版本管理和发布参数设置，可以让后续更新和交付开发变得更加快捷。

5. **注意事项**

要留意 SVG 填充模式（nonzero 和 evenodd）在不同工具间的差异。

制作 Icon 字体时，推荐使用如 Icomoon 这样的工具，并妥善保管项目文件（`selection.json`）以便后续更新。



通过以上方法，你的团队可以轻松实现高效的图标管理和交付，提升整体设计和开发协作效率。

> 参考文章：
>
> [Icon Fonts: How To Create Your Own with IcoMoon](https://medium.com/@jessdelisio/icon-fonts-how-to-create-your-own-with-icomoon-a1c92976b9c2)
>
> [Icon Fonts: Benefits and Why You Should Use Them](https://www.theedigital.com/blog/icon-fonts-benefits)
>
> [Icon Fonts Explained: Benefits and Pitfalls](https://cubicleninjas.com/icon-fonts-explained-benefits-pitfalls/)
