---
title: 炜哥的AI学习笔记——SuperMerger插件学习
date: '2023-06-28T10:11:33.000Z'
author: Aaron Xu
tags:
  - Stable Diffusion
  - WebUI
  - SuperMerger
  - 模型融合
  - Checkpoint
  - LoRA
  - MBW
  - 插件
categories:
  - 教程
excerpt: >-
  接下来学习的插件名字叫做 SuperMerger，它的作用正如其名，可以融合大模型或者 LoRA，一般来说会结合之前的插件 LoRA Block
  Weight 使用，在调整完成 LoRA 模型的权重后使用改插件进行重新打包。
minutes: 18
---
接下来学习的插件名字叫做 SuperMerger，它的作用正如其名，可以融合大模型或者 LoRA，一般来说会结合之前的插件 LoRA Block Weight 使用，在调整完成 LoRA 模型的权重后使用改插件进行重新打包。



除了 LoRA ，Checkpoint 也可以通过这个插件进行融合合并。实际上，目前市面上存在大量的 Checkpoint 模型都是经由合并这种方式得来，这类模型一般名字中都带有 Mix，如国内比较知名的作者[GhostInShell](https://www.zhihu.com/people/2e1f8efa42269a5e22d7f84e34c03468)发布的模型 GhostMix 也是在自己的模型的基础上和别人的模型融合而来。这本身就是一种模型制作的方式。

与 LoRA 相同，Checkpoint 内部也存在分层，这是模型融合的基础，Checkpoint 内部存在 26 层分层内容，分别是BASE,IN00,IN01,IN02,IN03,IN04,IN05,IN06,IN07,IN08,IN09,IN10,IN11,M00,OUT00,OUT01,OUT02,OUT03,OUT04,OUT05,OUT06,OUT07,OUT08,OUT09,OUT10,OUT11。同样需要不断地测试以确定不同层对于概念学习的作用

## 官方说明

This extension allows merged models to be loaded as models for image generation without saving them. This extension can prevent the use of HDD and SSD.

### 界面介绍

#### Merge 标签

这个 Tab 下主要是针对 Checkpoint 融合的一些设置。

1. Model A\B\C。这个就是选择需要融合的几个模型。 
2. Merge Mode。模型的融合方式，这里涉及到两个变量，alpha 和 beta，计算方式直接见图。

![image-20230620143623548](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230620143623548.png)

如 Weight sum ，当 alpha 等于 0.4 时，就是 0.6 的 A 模型融合上 0.4 的 B 模型。

3. Calcutation Mode。决定了模型融合的计算方式，设计到一些数学函数所以略微有些复杂，新手使用可以直接选 normal ，如果实在想要了解几个选项的不同可以查看 https://github.com/recoilme/losslessmix

4. use MBW。使用分层的方式对模型进行融合。至于 MBW 代表的意思，还需要说到另一个插件 [Merge Block Weighted](https://github.com/bbc-mc/sdweb-merge-block-weighted-gui#merge-block-weighted---gui) 。严格来说这个插件才是用来精确调整分层效果的，这里使用这个插件的缩写 MBW 代表需要分层调节。不过也不用单独去下载这个插件，因为 SuperMerger 中已经集成了，就在页面底部。

   需要注意的是，在勾选了使用 MBW 后，会使用页面底部设置的每一项的 alpha 值，而最上面设置的 alpha 和 beta 值就没有用了。

![image-20230626215211625](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626215211625.png)

两个输入框，第一个是分层的 alpha 权重，第二个是分层的 beta 权重。

比如如图所示的话，MBW alpha = 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1。而之前我们模式选择的是 Weight sum:A×(1-alpha)+B×alpha，所以这边就是模型 A 按 "1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0" 分层权重和模型 B 按"0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1" 的分层权重进行融合了。最后得出一个新的模型，这个是比单纯的整体权重设置更加精准的融合控制。

当然如果麻烦的话可以使用后面一个 Tab 的"Weights Presets"中的字母进行替代，比如说我可以使用 "OUT07" 来替代掉上面的一长串数字。这个也是支持自己自定义的，和 LoRA-Block-Weight 一样。

![image-20230626215617370](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626215617370.png)

5. Merge、Gen、Stop。控制按钮三人组，Merge 就是开始融合，Gen 是 generation 的缩写，会根据 txt2img 中的设置生成图片（使用当前的模型，可以看右侧 Current Model 中是哪个模型）如果指点击 Gen 按钮的话，就是用上一次 Merge 的模型，只有用 Merge&Gen 才会在融合之后用融合后的模型生成图片看效果。Stop 即停止。

5. save settings

![image-20230620172646141](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230620172646141.png)

这里的设置项……虽然不是很难，不过非常的直接，不是很“用户友好”，我还是快速说一遍。

**save model**，需要在预览完成之后保存一个模型的话，就要勾选。不然按了 Merge 之后，虽然融合了模型，但是也没有输出，等于白用功了。模型保存在`\stable-diffusion-webui\models\Stable-diffusion`下，就是平常放 Checkpoint 的地方

**overwrite** 是覆盖已存在的模型，如果不勾选，并且存在同名模型的话，会提示模型已存在没有保存，比如我刚才故意没勾，就提示我`tdi_v1.1-000007x0.3+chilloutmix_NiPrunedFp32Fixx0.7.safetensors) existed and was not saved]`。

**safetensors** 勾选了保存的格式就是.safetensors ，不勾选就是 ckpt。两者的区别自行上网搜索。

**fp16** 勾选了保存的精度就是 fp16，不勾选应该是 fp32（未实测）。两者的区别同样自行搜索。

**save metadata** 的作用是唯一在官方文档中有说明的，是将这次 merge 的条件保存到导出的文件里，这样后面可以回过来查阅。

所以其实不勾 **save model** 的话后面的选项是完全没用的，这就是“用户不友好”的地方。

6. write merged model ID to

这边先要讲清楚 model ID 是什么， 这就需要先把 History 标签拿上来讲。

每次 Merge 一个模型，History 标签中都会有记录这次操作的详细信息，包括模型名称、权重等。这些都被记录下来，那么 model ID 就是对应的记录 ID 了。

![img](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/tmp50rgf1jj.png)

勾选了 image 的，生成的图片左上角就会出现对应的 ID 信息，方便后续查询记录。而 PNG info 就是将这个信息写入到图片文件内，就和 txt2img 中的 Prompt 等其他设置一样。

不过很奇怪的是，我勾了 PNG info 之后，图片的信息没有变化，而且在同时勾了 image 和 PNG info 后，图片的信息完全都没了（图片左上角的数字还在）。可能是 bug 吧，目前版本是[e161008b](https://github.com/hako-mikan/sd-webui-supermerger/commit/e161008b71facc6cb6cb6974e7b18bf0095a7a58)。

7. Custom Name(Optional)。保存模型的名称，不填的话会使用每个模型+对应权重合起来的命名方式进行命名。
8. merge from ID。保存的 ID 记录派上用场了，可以从历史记录中拷贝之前配置（-1 代表最近的记录）。
9. Restore faces, Tiling, Hires. fix, Batch size。和 txt2img\img2img 一样的调参，猜测插件作者把这个放在这里只是为了方便。
10. Elemental Merge。搞不懂，不过 LoRA-block-weight 这个插件一样也有这个设置项，后续可以对比着然后看看效果。

---

接下来到了 XYZ 图部分了，还是和 txt2img 中的 XYZ Plot ，是通过交叉改变一些参数，来找出最合适的参数组合。

XYZ 的具体用法就不介绍了，主要说一下每个参数的意义。

![image-20230626205745098](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626205745098.png)

1. alpha。即上面的 alpha 值，这边设置之后会代替上面设置的 alpha 值进多次生成图片。比如这边设置“0.25,0.5,0.75”，效果等同于将上面的 alpha 分别设置成三个值进行图片生成。
2. beta。同 alpha。
3. alpha and beta。顾名思义是同时更改 alpha 和 beta，所以逗号分隔开的值需要提供两个数字，分别代表 alpha 和 beta，不过两个数字间不能用逗号了，需要使用空格。如果只有一个数字的话代表 alpha 和 beta 同时使用这个值。比如“0.5 0.1, 0.3 0.4, 0.5”，代表3组值，alpha=0.5&beta=0.1，alpha=0.3&beta=0.4，alpha=0.5&alpha=0.5。
4. seed。生成时的种子数，可以用-1代表随机生成。

这里单独提一下右侧的那个 number of -1 。

![image-20230626210316727](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626210316727.png)

插件开发者做了这个应该是用来方便快速输入指定个数的-1的，用在 seed 值这里倒是很方便。

5. mbw alpha, mbw beta, mbw alpha and beta。这三个放一起介绍，因为和之前的三个差不多，只是改成了 mbw 的形式，也就是说需要输入完整的分层权重值，比如"0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1"，然后这边的分隔符也改成了换行符，也就是每一组占一行（如果是mbw alpha and beta ，会自动把两行当成一组）。

​	同样这边也是支持 Weights Presets 中的变量名替换的。

6. model_A, model_B, model_C。替换融合模型的名字，会忽视掉之前设置的模型名。

7. pinpoint blocks。可以的单独去控制某几个层的权重，比如我在 X 轴选了这个选项，然后在参数框里输入"IN01,IN02,IN03"，然后 y 轴必须选择 alpha 和 beta (不带 mbw 的那两个)，这样就会单独更改这三项的 alpha 值。

8. elemental 相关的不了解。

9. calcmode。Calcutation Mode 的缩写，对应着上面的这个选项。

![image-20230626212757854](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626212757854.png)

10. prompt。图片生成默认会使用 txt2img 中的 Prompt，但是也可以在这里进行多组的设置，然后也需要改成使用换行符做分隔符。

然后是控制区。XYZ 的图片生成不能使用上面的 Merge、Gen 按钮。

![image-20230626213326085](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626213326085.png)

介绍完列表项后，还有 XY plot settings ，都比较直接，也不介绍了。

下方的三个按钮，可以用来控制图片的生成。第一个就是开始生成 XY 图片，第二个是停止，第三个是”预订“，就是当前如果有正在执行的任务，你可以继续设置参数，设置完成后通过这个按钮”排队“一个任务，这个任务会在前一个任务完成后继续。（很适合睡前使用）

可以在最下方的 Reservation 里查看预约的列表，也可以用来删除已预约的任务。

![image-20230626220123957](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626220123957.png)

然后还有个区域，也不知道该叫什么。

![image-20230626215855533](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230626215855533.png)

它严格来说也是 XYZ 的一部分，会列出所有的 Block ID 和识别到的 checkpoint，这样需要输入的时候不需要再单独一个个名称输入了，可以直接勾选然后会出现在上面的选框里，点击 Add to Sequence X/Y 就可以发送到上面的 X 或 Y 的参数框里了。

#### LoRA 标签

主要的 Merge 标签讲完，后续的标签就快多了。

这个标签就比较简单，所以我换一种方式讲解，即使用任务导向。

![image-20230628122431980](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230628122431980.png)

##### 任务一 将 LoRA 融合进大模型

LoRA 本身是需要搭配大模型使用的，但这个插件也提供了将 LoRA 融合进大模型的功能，更加方便后续调用。

需要融合模型的话，需要先在 Checkpoint A 处选择大模型，然后再在下面的 "LoRAname1:ratio1:Blocks1,LoRAname2:ratio2:Blocks2,...(":blocks" is option, not necessary)" 这一长串下方的输入框中输入要融合的 LoRA 名称，可以选择多个，但是需要 LoRA 的维度都保持一样，也就是在训练 LoRA 选择的 Network Rank(Dimension)。

![image-20230628122747160](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230628122747160.png)

如果不知道 LoRA 的维度的话，可以通过左下方的按钮 calculate dimension of LoRAs，计算出所有 LoRA 模型的维度。

同时，LoRA 名称也是支持分层权重的，比如可以填写 my_lora:0.5:ALL0.5 来将 LoRA 模型以制定好的整体权重(0.5)和分层权重(ALL0.5) 融合进大模型中。

> 这里的确有一个地方我还没搞明白，我如果直接使用一系列数字当成分层权重输入，比如 my_lora:0.5:0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5。会提示我数组超长，融合出错，只有我将权重信息替换成了字母变量，才融合成功。
>
> 倒是不影响使用，不过目前没有找到直接输入分层权重来进行模型融合的方法。

选择好了大模型，并输入要融合的 LoRA 后，就可以进行模型的融合了，还可以通过在 filename(option) 中添加自定义的文件名，如果不写的话插件会自动把大模型的名称和 LoRA 的名称合并作为新模型的名称。完成所有操作后点击 Merge to Checkpoint 按钮，就会开始融合，融合后的模型存放在平常存放大模型的目录下。

##### 任务二 将 LoRA 从大模型中拆分

是任务一的逆向操作，如果想要将融合后的模型重新还原 Lora 出来，就可以使用这个功能。比如我在 Checkpoint A 中选择任务一融合后的模型，再在 Checkpoint B 中选择之前融合用的底模。然后点击 Make LoRA，就得到了最开始的那个 LoRA 模型。

也可以自由的改变两个模型的权重，比如我将 Checkpoint A 的模型权重 alpha 从默认的 1 调高一点，那么生成的 LoRA 就会更多带有一点 Checkpoint A 的特征，可以理解成“没减干净“。

##### 任务三 融合 LoRA 模型

顾名思义是将多个 LoRA 模型融合成一个 LoRA 模型，但是不融合进大模型中。步骤和任务一类似，不过不需要再选择 Checkpoint A。点击 Merge LoRAs 后，同样会生成新的一个 LoRAs 模型，也是默认放在原 LoRA 的文件夹目录下。

##### 其他元素

其他是一些无关紧要的选项

![image-20230628141544432](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/image-20230628141544432.png)

1. same to Strength

这个选项目前的确是看不懂，我先直接将英文原文搬过来。

If the same to Strength option is not used, the result is the same as the merge in the script created by kohya-ss. In this case, the result is different from the case where LoRA is applied on Web-ui as shown in the figure below. The reason for this is related to the mathematical formula used to adopt LoRA into U-net. kohya-ss's script multiplies the ratio as it is, but the formula used to apply LoRA squares the ratio, so if the ratio is set to a number other than 1, or to a negative value, the result will differ from Strength (strength when applied). Using the SAME TO STRENGTH option, the square root of the ratio is driven at merge time, so that Strength and the ratio are calculated to have the same meaning at apply time. It is also calculated so that a negative value will have the same effect. If you are not doing additional learning, for example, you may be fine using the SAME TO STRENGTH option, but if you are doing additional learning on the merged LoRA, you may not want to use anyone else's option.
The following figures show the generated images for each case of normal image generation/same to Strength option/normal merge, using merged LoRAs of figmization and ukiyoE. You can see that in the case of normal merge, even in the negative direction, the image is squared and positive.

![xyz_grid-0014-1534704891](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage@main/img/218322034-b7171298-5159-4619-be1d-ac684da92ed9.jpg)

我大致的理解是，如果勾选了 same to Strength（第二行），效果将会和在 Prompt 中同时使用两个 LoRA 效果差不多（第一行），不勾选的时候，则是结合两个 Lora 学习到的内容。不过从图片来看似乎也只有在最终 LoRA 强度为负数时才有明显差别。这个后续有机会再搞懂吧。

2. overwrite

是否覆盖。不勾选的话在保存文件目录下如果有同名文件，会保存失败。

3. save precision

模型的保存精度。要讲清楚比较复杂，建议保持默认。

4. remake dimension

如果出现模型维度不一样，那么需要在这里选择重新打包后的模型精度，选择 auto 的话会自动选择维度较大的那一个值。不过在 LoRA 更改维度的过程中，难免会存在一些效果的更改，所以尽量要选择维度一样的模型。

#### History 标签

在 Merge 标签中提到过，这里记录了所有合成的历史。

#### Elements 标签

猜测是和之前 Merge 标签，甚至 LoRA-Blocks-Weight 中的 Elemental Merge 有关联的功能。在上传一个模型之后，Elements 中给出了这个模型中每个 Blocks 中更细致的分层。因此猜测是相比分层权重更加精细的权重控制。这个单独开一篇文章进行学习吧。

#### Metadeta 标签

也是在 Merge 标签中提到过，有一个选项是 save metadata ，就是将这次融合的信息保存到模型文件中，那么通过这个 Metadeta 标签就可以进行读取。

顺便一提作者应该是拼错了名字，把 Metadata 拼成了 Metadeta ，我还是保留下来。

## 待了解

- [ ] Elemental Merge

- [ ] same to Strength

## 参考资料

[GitHub - hako-mikan/sd-webui-supermerger: model merge extention for stable diffusion web ui](https://github.com/hako-mikan/sd-webui-supermerger)

[【AI绘画进阶教程】SuperMerger插件详解 提取Lora模型✓ 合并Lora模型✓ Lora模型降维✓Lora模型融入大模型✓_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV1pV4y1Q7Bi/?spm_id_from=333.337.search-card.all.click&vd_source=e314ec3dcf0347671e7a3824767fa640)
