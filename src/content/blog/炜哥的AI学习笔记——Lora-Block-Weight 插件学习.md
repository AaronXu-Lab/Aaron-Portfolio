---
title: 炜哥的AI学习笔记——Lora-Block-Weight 插件学习
date: '2023-06-13T04:51:00.000Z'
author: Aaron Xu
tags:
  - Stable Diffusion
  - LoRA
  - LyCORIS
  - WebUI插件
  - Lora-Block-Weight
  - 权重调参
  - XYZ Plot
categories:
  - 教程
excerpt: 在实际业务过程中，经常会用到一些 SD 的插件，这里做一个收集记录。 会持续更新，首发 xuweinan.com 和 bilibili。
minutes: 9
---
在实际业务过程中，经常会用到一些 SD 的插件，这里做一个收集记录。

会持续更新，首发 xuweinan.com 和 bilibili。



## Lora-Block-Weight

### 简介

这个插件可以调节 Lora 中每一个 Block （可以理解成 Lora 的不同组成部分）的权重，在某种程度上来说可以精确控制 LoRA 的效果。

不过在使用这个插件之前，需要先了解一些前置知识：

1. LoRA 模型的分类，例如 LyCORIS 与传统 LoRA 的区别。
2. XYZ 脚本的使用。

### 官方说明

Lora is a powerful tool, but it is sometimes difficult to use and can affect areas that you do not want it to affect. This script allows you to set the weights block-by-block. Using this script, you may be able to get the image you want.

### 工作原理

如果深入剖析模型的组成，LoRA 可以细分为 17 个 Blocks，每一个 Blocks 都有它的一些作用，例如可能某一个 Block 是控制脸部，另一个 Block 是控制姿态的等等。

不过，目前我只有在一个三方的插件中找到关于 LoRA Blocks 信息的描述，暂时不知道这个分层是 Lora 就有的还是这个插件作者人为划分的。

![17层的具体划分](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230616130306123.png)

而所有的 Blocks 的权重都可以在这个插件中进行调节，从而达到进一步调整 Lora 效果的目的。

具体的使用方式，则是在原本的 LoRA 调用的 Prompt 上，继续增加权重信息，例如原 Prompt 是`<lora:"lora name":1>`，那么增加权重信息后就是`<lora:"lora name":1:0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0>`，这代表着除了 IN02 这一个属性的权重设置为 1 以外，其他的全都都设置为 0。

当然这样的设置方式既不方便也不优雅，所以插件设置中也可以将一系列数字保存成一个变量，比如 `IN02:0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0`，这样后面直接输入`<lora:"lora name":1:IN02>`即可，与上面的一长串 Prompt 效果是等同的。

插件还支持特殊值，使用 R 而不是具体的数字可以让权重在 0～1 的小数数之间随机选择，使用 U 则是 -1.5～1.5。这两个值只有在 OUT Blocks 才生效。

然后还有一个特殊的值，变量 X。这个是结合了保存变量与特殊值两个功能的一个用法。如刚才所说，插件支持将一系列数字保存为一个变量，比如将 0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0 设置为 IN02，那么我如果将一部分值用 X 替代，比如 X,X,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0，我在调用 IN02 变量的时候就可以快速设置对应的值，例如我设置 `<lora:my_lore:0.5:IN02:0.7>`，就等同于 `<lora:my_lore:0.5:0.7,0.7,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0>`。有些类似于传统编程中，全局变量的一个功能。

参数设置说明之后，就要说每个 Block 对应的作用了。

![image-20230616134805231](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230616134805231.png)

作者给出了上图的例子，不过遗憾的是，并未明确的说明每一个 Block 所对应的效果如何。实际上很有可能也无法明确的将图片的“部分概念”和具体的 Block 对应起来，因为在官方文档随后的一个章节中，作者重点介绍了一个用于对比的工具 XYZ Plot。

如果在 Lora 模型训练的过程中使用过 XYZ 进行过效果对比的话，那对这个 XYZ 脚本应该不陌生。通过对于参数的交叉改变，可以验证不同参数组合下模型的效果。

### 界面介绍

![image-20230616163123587](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230616163123587.png)

勾选 Active 后启用这个脚本。

右边的输入框一会再讲。

#### XYZ plot

刚才提到过的 XYZ 工具，可以交叉改变参数来验证模型效果。和 SD 自带的 XYZ 脚本非常相似。

![image-20230616164606620](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230616164606620.png)

首先需要在 Active 中选择 XYZ plot 来启用这个工具。同时，在需要生效的 LoRA 脚本中，加上 XYZ 作为特殊标记，例如`<lora:"lora name":1:XYZ>`。

**这里还有一个额外用法**，LoRA 模型本身是支持两个模型融合的，所以可以将第二个 LoRA 模型的 Prompt 也放上来，并将 XYZ 换成 ZYX，这样两个模型的参数就会互补，方便在模型融合前看到效果。不过这里也不展开，具体还是看下

然后就是选择每一个轴的类型和参数，这里先对每个类型进行一下说明。

1. none。不启用这个轴。

2. BlockID。只对于输入的 Block ID 值进行改变，可以使用空格或连接符输入一组 IDs。例如 IN01-IN08，指的是只改变这两个值。

3. values。要改变的具体数值。

4. seed。生成图片的种子值。有一种用法是在 Z 轴用不同的种子值，这样会一次生成多组不同 Seed 的图片，更容易对比观察效果。

5. Original Weights。初始值，可以理解成除了要改变的 IDs 以外其他 IDs 的默认值。

6. elements。这个与 Elemental 中的标签对应，不过遗憾的是，截止到目前关于这部分的介绍都只有日语说明，因此暂时无法搞懂这一块的作用。

这里提供一个例子：

例如我将 X 轴设置为 values 类型，并设置具体的值为 [0.5,0.8]；然后将 Y 轴设置为 Block ID ，具体的值 [IN01-IN08,IN05-OUT05]；Z 轴 seed，值[-1,-1]。

那么点击生成后，会生成两组不同 seed 的图，每一组图有四张图，分别是 IN01 和 IN08 被设置为 0.5、 IN01 和 IN08 被设置为 0.8、 IN05 和 OUT05 被设置为 0.5、 IN05 和 OUT05 被设置为 0.8。

![tmpq9w2y6y3](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/tmpq9w2y6y3.png)

![tmp3xpn22ic](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/tmp3xpn22ic.png)

当然在实际应用中应该会更加复杂，每个轴都会设置更多的值，来找出最合适的效果。

#### Effective Block Analyzer

这个功能有有些像简化版本的 XYZ Plot ，主要是用于部分参数改变后快速对比，默认生成结果是三列，第二列是修改权重后的图片，第三列是默认权重的图片，第一列则是两者之间的差异（会使用黑底或白底图片标出不同部分）。

![image-20230616211249194](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230616211249194.png)

还是先解释参数：

1. diff image color。决定第一列对比图片是黑底还是白底。
2. change X-Y。可以把 X 轴 Y 轴交换，简单来说就是把生成的图片表格转90°。
3. difference threshold。在两张图对比的时候，这个值决定了误差程度。值如果调小，那更细微的差别也可能被现实在第一列的对比图上。作者建议默认值即可。
4. Range。第一个值是第二列的权重，第二个值是第三列的权重，一般来说第二个值会调成 1，用来对比默认效果。
5. Blocks。要参与这次对比的 Block IDs。
6. number of seed。种子数量，一个种子对应一张图，所以也就是生成多少组图片，默认为 1。

还是举个例子。

我希望看一下 COOLKIDS_MERGE 这个模型的不同 Block 的作用，所以我将部分 Blocks 的权重分别设置为了 0.2 ，看下在弱化某个 Block 的情况下图片会如何变化。

![file-2](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/file-2.png)

可以看到，在弱化 IN01 时，男生的姿态衣服和女生的姿态衣服都有所变化；而弱化 IN02 时，女生变化不明显，男生的衣物有所变化。

所以可以从这个图片推测，IN01 主要控制衣服与姿态，IN02则是控制衣物但效果没有 IN01 强烈。

当然这这是一次简单的举例，实际调参过程中还需要加入更多的 Blocks ，以及尝试不同 seed 的生成，才能判断出每个 Block

 对应的内容，然后更精准的去使用这个模型。

*这里特别穿插一个小细节，这里 IN03 值的改变毫无作用，是因为 IN03 在传统 Lora 模型中并不存在。当然这个一会再提。*

#### Weights setting

这个设置项就简单许多，就是设置刚才提到过的全局变量的。默认是已经设置好了 10 条变量，也可以自己直接在文本框中添加。包括其他的一些选项，“Reload Presets”、“Save Presets”、“Open TextEditor”都是针对于输入内容的功能，很容易理解，不过多解释了。

“Reload Tags”这个稍微解释下，还记得一开始提到的 Active 旁边的输入框吗？点了这个按钮之后，设置的变量的变量名都会快速复制到 Active 旁边的输入框里，我猜测是作者为了快速复制到 Prompt 方便吧。

#### Elemental

这个我目前的确没搞懂，先记成待办事项。

### 另外：对于 LyCORIS 的不同

如果是 LyCORIS 模型，会有一些不一样的地方，因为相比于 LoRA 的17层结构，LyCORIS 有 26 层，所以在调整的过程中也会复杂一些，起码 Prompt 需要 26 个数字了，当然最好是用变量保存常用的组合。

还有，因为 LyCORIS 的参数设置是需要参数名称的，所以不能直接在权重后面跟 26 个数字，需要加上参数名lbw（就是插件名缩写）。样式一般是以下两种：

`<lyco:"lora name":1:1:lbw=1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0>`

`<lyco:"lora name":1:1:lbw=IN02>`

### 权重组合参考

网上找了一些常见的权重组合，也许有用，仅做保存。

![截屏2023-06-16 22.08.34](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/%E6%88%AA%E5%B1%8F2023-06-16%2022.08.34.png)

![截屏2023-06-16 22.17.41](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/%E6%88%AA%E5%B1%8F2023-06-16%2022.17.41.png)

### 参考资料

[sd-webui-lora-block-weight](https://github.com/hako-mikan/sd-webui-lora-block-weight/blob/main/README.md)

[LoRA,LyCORIS,LoCon使い方、種類について解説（プリセット生成補助テンプレあり）](https://sp8999.com/stable-diffusion/2023/04/30/1227/)

### 待解决的问题

- [ ] Elemental 这一整块的作用。
