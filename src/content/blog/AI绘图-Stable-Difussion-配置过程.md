---
title: AI绘图 Stable Difussion 配置过程
date: '2023-05-04T08:01:58.000Z'
author: Aaron Xu
tags:
  - Stable Diffusion
  - WebUI
  - AUTOMATIC1111
  - Mac
  - Python
  - Homebrew
  - Git
  - ClashX
  - 代理
  - 模型下载
  - AI绘画
categories:
  - 教程
excerpt: >-
  这里安装的是 Stable Diffution Webui 版本，也就是别人封装好的带有 UI
  界面的版本，无论是在用户体验还是使用效率的角度，都相比纯命令行版本更好。
minutes: 7
---
这里安装的是 Stable-Diffution-Webui 版本，也就是别人封装好的带有 UI 界面的版本，无论是在用户体验还是使用效率的角度，都相比纯命令行版本更好。



### 网络环境

首先在国内的环境下，所有的操作都需要突破防火墙，包括但不限于使用命令行安装依赖库、从 Github 下载文件等。

我的电脑是 Mac 环境，使用的是 ClashX 这个翻墙客户端，并开启全局翻墙。

但是对于 Mac 的终端工具来说全局翻墙还不够，流量仍旧没有通过代理。

可以通过在终端输入如下命令进行测试：

```
curl cip.cc
```

如果出现国内的 IP 地址和运营商，就说明终端没有翻墙成功，比如我的电脑上是：

```
IP    : 183.240.8.170
地址    : 中国  广东  广州
运营商    : 移动

数据二    : 广东省广州市 | 移动

数据三    : 中国广东省广州市 | 移动

URL    : http://www.cip.cc/183.240.8.170
```

可以看到 IP 还在国内，所以需要在终端进行一些设置，我这里使用的是临时方法，直接在终端输入：

```
export ALL_PROXY=socks5://127.0.0.1:****
```

其中末尾四个数字是 ClashX 配置的端口，因为不同电脑端口占用情况可能不同，所以需要在 ClashX 的配置文件中查看。

点击顶部 ClashX 图标，在弹出的菜单中选择“打开配置文件夹”。

![image-20230504133939428](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230504133939428.png)

找到 config.yaml 文件，打开后可以看到关于端口的数字

![image-20230504134045126](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230504134045126.png)

![image-20230504134335226](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230504134335226.png)

输入之后，现在终端流量都会通过 ClashX 进行代理，再次尝试使用 curl cip.cc 命令进行 IP 查看，提示：

```
IP    : 140.99.149.34
地址    : 美国  亚利桑那州  钱德勒
运营商    : deru.net

数据二    : 美国 | Datability

数据三    : 美国亚利桑那

URL    : http://www.cip.cc/140.99.149.34
```

可以看到流量代理成功，后续就可以绕开防火墙进行环境的搭建。

### 安装本体

#### 1. Python 环境配置

需要使用 Python 来运行 Stable Difussion（以下简称 SD），这里最好使用 3.10.6 版本，原因在《踩坑》章节中会详细描述。

如果之前安装过 Python 版本，可以通过在终端输入： `python3 -V` 查看 Python 版本。

如果没有安装过，则可以使用 homebrew 这个命令行工具进行安装。

> Homebrew是macOS的套件管理工具，是高效下载软件的一种方法，相当于Linux下的yum、apt-get神器，用于下载存在依赖关系的软件包。通俗地说，Homebrew是类似于Mac App Store的一个软件商店。

具体的安装方法可以通过使用 `ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"` 这个命令进行安装，提示 `==> Installation successful!` 后即代表成功。

之后，通过使用 `brew install python@3.10.6` 来安装 Python 3.10.6 版本。

如果你的版本非 3.10.6 版本，也不需要先卸载，可以使用一些办法安装并管理不同的版本，我这里使用的是 pyenv ，具体可以参考这篇文章 [Python版本管理神器-pyenv - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/36402791)

#### 2. 源码克隆并初始化

需要先安装 git 工具，也是通过 Homebrew 安装，使用 `brew install git`。

然后克隆源码

`git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui`

下载完成后进入文件夹

`cd stable-diffusion-webui`

运行一键配置的文件：

`./webui.sh`

初次运行因为需要下载大量依赖包，所以会花费较长时间，而且对网络环境要求较高，会烧掉很多流量，需要注意。我在一开始没注意，在梯子里默认选择了 3 倍流量，结果直接导致烧掉了几十个 G 的流量。

在下载完成后，会自动搭建本地的服务器，终端里会提示：

![](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230504143230067.png)

这样就说明是成功了，现在可以通过 <u>127.0.0.1:7860</u> 进行访问。

![](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230504143616882.png

只要终端还开着，就可以随时访问这个网页。而关闭终端或手动结束命令后，需要再使用 `./webui.sh` 再次进行配置。

如果网络环境比较稳定的话，安装与配置应该都不会出现太多的问题，如果出现问题，可以看《踩坑》章节。

### 模型下载

光有 SD 这个壳子还无法进行 AI 绘图，我们还需要一些数据模型，网上有很多别人训练好的模型我们可以直接使用。我经常使用的是 https://civitai.com/ 这个网站，会有网友分享自己训练好的模型以及一些优质的 Prompts。

![](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/download.jpg)

任意点进一个页面，在右侧点击 Download 进行下载。

![](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/download-1.jpg)

一般来说，模型使用 .ckpt 或 .safetensors 作为后缀名。

> 区别：
> 
> .ckpt 文件是用 pickle 序列化的，这意味着它们可能包含恶意代码，如果你不信任模型来源，加载 .ckpt 文件可能会危及你的安全。
> 
> .safetensors 文件是用 numpy 保存的，这意味着它们只包含张量数据，没有任何代码，加载 .safetensors 文件更安全和快速。

下载完成后将文件放置在 ./models/Stable-diffusion/ 目录下。

![](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230504145624695.png)

不同的模型有着不同的绘图风格，可以想象成是不同的画家。

然后，我们重新打开 <u>127.0.0.1:7860</u> 进行尝试，可以通过在第一个输入框简单的 Prompt 来验证是否配置成功，例如我输入 dog ，点击 Generate ，可以在右下角空白区域正常生成：

![](https://cdn.jsdelivr.net/gh/AaronXu-Lab/blogImage@main/img/image-20230504145904909.png)

如果生成图片就说明成功了，左下角还有一些详细的参数可以调整，不过这里不再继续介绍。

**需要注意的是，可能在点击 Generate 后出现如下提示：**

![](https://user-images.githubusercontent.com/4593678/228566952-6dfc1300-d8b8-4b2c-a123-ed09a466c7ae.png)

应该是因为开启了代理的原因，可以在关闭之后重新运行 `./webui.sh` 命令。（详见 [[Bug]: Something went wrong Expecting value: line 1 column 1 (char 0)](https://github.com/AUTOMATIC1111/stable-diffusion-webui/issues/9150)）

### 踩坑

1. Python 版本不对

如果不使用 3.10.6 版本，可能会出现一些包无法正常安装。例如 `RuntimeError: Couldn't Install Torch` ，是因为 Torch 这个包不支持更新版本的 Python。

需要特别注意的是，如果失败一次之后，最好将目录下的 venv 文件夹删除，文件夹会在重新配置的过程中再次生成。这样可以避免依赖包安装不完整带来的其他问题。

（详见 [[Bug]: RuntimeError: Couldn't Install Torch](https://github.com/AUTOMATIC1111/stable-diffusion-webui/issues/4299)）

2. 文件路径中带有空格

如果文件路径中带有空格，可能也会出现一些模块安装失败，例如 `Couldn't install requirements for CodeFormer` ，暂时不知道原因，但是网络上有人碰到过并成功解决了。

（详见 [RuntimeError: Couldn't install requirements for CodeFormer. (please help) ](https://github.com/AUTOMATIC1111/stable-diffusion-webui/discussions/8536)）

3. Python 不支持 socks5 代理

当我使用 `./webui.sh` 进行一键配置时，提示 `Missing dependencies for SOCKS support` ，这是因为 Python 并不支持 socks5 代理，但我在配置的某一步可能使用了 sock5 代理了一些流量，所以需要先在终端依次输入：

```
unset all_proxy
pip install pysocks
```

其中第一行是取消所有代理，第二行是安装 socks 程序，在输入完成后继续输入 `./webui.sh` 即可消除这个错误提示。

4. 下载安装依赖包始终失败

如果网络环境实在不行，可以通过换源或手动下载的方式，方法网上一大堆这里不再多做介绍。

不过并不推荐这两种方法，毕竟换源难以保证依赖包正常，而手动下载也需要翻墙否则速度非常慢。
