---
title: 炜哥的AI学习笔记——One Button Prompt 插件学习
date: '2023-06-16T04:51:00.000Z'
author: Aaron Xu
tags:
  - Stable Diffusion
  - A1111
  - 插件
  - Prompt
  - LoRA
  - One Button Prompt
categories:
  - 教程
excerpt: 在实际业务过程中，经常会用到一些 SD 的插件，这里做一个收集记录。 会持续更新，首发 xuweinan.com 和 bilibili。
minutes: 7
---
在实际业务过程中，经常会用到一些 SD 的插件，这里做一个收集记录。

会持续更新，首发 xuweinan.com 和 bilibili。



## One Button Prompt

### 简介

用于模型炼制收尾阶段，测试模型是否能在训练集之外的类型图片中获得较好的泛化效果。

### 官方说明

One Button Prompt is a tool/script for automatic1111 for beginners who have problems writing a good prompt, or advanced users who want to get inspired.

It generates an entire prompt from scratch. It is random, but controlled. You simply load up the script and press generate, and let it surprise you.

---

简单来说这就是一个随机 Prompt 生成工具，但是提供了一些精细化的选项方便用户去控制 Prompt 的生成。

### 界面介绍

通过底部的 Script 启用。

启用后界面效果如下：

![image-20230613132014421](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230613132014421.png)

#### Main 标签

Main 标签集成了主要功能

##### 基础部分

1. Prompt complexity

决定了生成的 Prompt 的复杂程度和随机程度，作者在他的例子中设置为了 5 。

2. Subject Types

生成物体的类型，比如 humanoid 就是指生成人类或人形的图片。

3. Artists

作者从 CivitAI 中选择了一系列受欢迎的艺术家风格，可以选择和生成图片目标相近的风格。

> 当然我这里因为需要验证我训练的画风 Lora ，不想 Prompt 对生成图像的画风污染，所以选择了 none

4. type of image

这里选择生成图片的类型，例如 Photograph、Digital Art、Painting。有助于生成的图像更接近于真实的效果。

> 同样的，我的画风 Lora 更接近于绘画效果，因此选择了 Painting

##### 覆写选项

作者在说明文档中也提到了这是 "是体验这个插件的最强大的方式"。

This will allow you to explore infinite variants of a subject of your own choice.

This also creates the option of adding a subject that requires a LoRA.

5. Overwrite Subject

最好先在之前的 Subject Types 中设置需要生成的物体类别，然后再在这里设置新的物体，这样根据 Subject Types 生成一系列 Prompts 时会优先生成设置好的物体。

6. Smart Subject

默认是勾选的，会尝试理解你刚才设置的 subject ，然后调整自动生成的其他 Prompt。

作者举了一个例子，比如将 subject 设置成“Obese man wearing a kimono”，那么在这个选项勾选后，比如对于 Obese 这个词语，插件理解它是一个体型相关的关键词，就不会再生成生成其他和体型相关的关键词了。所以作者推荐一定打开。

7. Overwrite type of image

和 Overwrite Subject 差不多，不过这次是为了覆写图片的类型。

> 官方文档中作者举了一些非常详尽的例子用于解释这几个选项的作用。这个功能设置可以用于和特定的 Lora 配合。如果看完此处的介绍仍然有困惑建议查询官方文档。

##### Prompt 字段处理

这块理解起来就更简单了，就是对于生成的 Prompt 的进一步处理。

8. Place this in front of generated prompt (prefix)

在生成的 Prompts 前面加上什么。

9. Place this in front of generated prompt (suffix)

在生成的 Prompts 后面加上什么。

10. Use this negative prompt

加上统一的负面提示词

> 后续在具体的使用中我有一些疑问，例如如果是 Lora 的触发词，应该写在 Overwrite Subject 中还是字段处理的 prefix 中。后来看到官方文档中有一个例子很好的解答了我的疑问。
>
> 官方例子是一个星际迷航的人物 Lora ，gul dukat。触发词是“sdn”，然后 Overwrite Subject 是 “gul dukat wearing cardassian uniform“ 。因为触发词是自己造的词语，因此插件无法理解，所以写在 Overwrite Subject 实际上没有意义。当然如果触发词包含一些常见的词语，比如我们假设触发词是 ”sdn a handsome man“，这样最好还是写在 Overwrite Subject 中，因为 Smart Subject 会自动排除掉 handsome\man 同类型的词语。
>
> 如果理解不了的话就老老实实照官方例子来，在 Overwrite Subject 中描述想要的特定画面内容，prefix 中写关键词，suffix 中写 lora 以及其他的一些东西.

##### 附加选项

11. 不想要的词语

在自动生成的 Prompt 中不希望出现的词语。可以在`\OneButtonPrompt\userfiles\`插件目录下新增一个 antilist.csv 文件来永久保存这些词语。

#### Workflow assist 标签

插件提供了一个 Workflow mode，通过这个标签启用。启用后停止自动 Prompt 生成图片的功能，转而使用 Wrrkflow prompt 输入框中的 Prompt 进行图片生成。

![image-20230614135329642](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230614135329642.png)

简单来说就是根据 Main 标签中设置的规则，自动生成五条 Prompt ，可以先看效果，适当调整，然后使用”Send prompt up“快速把 Prompt 发送到上面的 Workflow prompt 中进行生成。方便对比不同 Prompt 的效果。

#### Advanced 标签

一般来说是创建一组随机提示，通过调整 Prompt 数值，可以生成多组提示并合并在一起。

![image-20230614140824213](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230614140824213.png)

作者是建议可以试试 2。

同时还可以设置不同组之间的分隔方式，默认是逗号。

后面的 Prompt seperator mode 选项是搭配另一个插件 Latent Couple 用的，暂时不展开了，后面如果用到那个插件再深入讲。

#### One Button Run and Upscale 标签

![image-20230614141504559](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230614141504559.png)

先看官方介绍：

![image-20230614141552444](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230614141552444.png)

粗略看了一下，这个功能是在 WebUI API 启动的情况下才使用到的，用来提升现有图片的质量。因为暂时用不到就不详细了解了。

#### 参考资料

1. [My first generation](https://github.com/AIrjen/OneButtonPrompt/blob/main/user_guides/my_first_generation.md)
2. [Override subject and how to create infinite variations of a set subject](https://github.com/AIrjen/OneButtonPrompt/blob/main/user_guides/override_subject_and_infinite_variations.md)
3. [One Button Run and Upscale](https://github.com/AIrjen/OneButtonPrompt/blob/main/user_guides/one_button_run_and_upscale.md#one-button-run-and-upscale)
