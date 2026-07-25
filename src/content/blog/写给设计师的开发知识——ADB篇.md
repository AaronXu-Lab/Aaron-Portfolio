---
title: 写给设计师的开发知识 —— ADB篇
date: '2021-12-31T08:47:10.000Z'
author: Aaron Xu
tags:
  - 写给设计师的开发知识
  - 全栈设计师
categories:
  - 教程
excerpt: >-
  一、ADB 简介 adb，全称 Android Debug Bridge ，直译是安卓调试桥，可以简单理解成 Android
  开发中用来调试的工具，用这个工具就可以直接通过电脑对手机进行一系列的操作，比如常用的安装应用、重启手机等操作。当然部分开发也会使用它进行安卓设备监听、抓 
minutes: 8
---
## 一、ADB 简介

　　adb，全称 Android Debug Bridge ，直译是安卓调试桥，可以简单理解成 Android 开发中用来调试的工具，用这个工具就可以直接通过电脑对手机进行一系列的操作，比如常用的安装应用、重启手机等操作。当然部分开发也会使用它进行安卓设备监听、抓 log 等调试操作。



## 二、ADB 安装
　　首先要说明的是，adb 既然是安卓的调试工具，也就意味着你如果安装了 Google 的开发工具 Android Studio，应该就在安装过程中应该已经完成了 adb 的下载。如果对 Android 开发有兴趣的设计师，可以通过上述方式直接一步到位。

　　但是，Android Studio 有将近 2G 的软件大小，只是为了几个 adb 命令去安装实在是大材小用。所以这里会介绍给大家只安装 adb 工具的方式。 

### Mac 安装

　　mac 电脑安装 adb 稍微有一些繁琐，adb 需要使用 Homebrew 安装，而 Homebrew 又需要先主动安装命令行工具。

#### 1. 安装命令行工具

　　macOS 并没有打算呈现给用户太过复杂的界面，所以你可能看到在一些影视作品中，一些电脑高手会使用命令行工具完成一些电脑的操作。

![DOS Subsystem for Linux | Diit.cz](https://diit.cz/sites/default/files/styles/custom/public/dsl_qemu_0.png?itok=ntTDDT-Q&c=2d255a5b6cc21b279be9066834adadd1)

　　而这部分的能力，在 macOS 中是被隐藏的，所以需要先去激活。激活的方式页很简单，在 macOS 的 Launcher 中，找到终端这个应用。

![image-20211216145512334](https://tva1.sinaimg.cn/large/008i3skNgy1gxfvkooxm8j3074074a9x.jpg)

　　打开后直接输入：`xcode-select --install`

　　如果之前没有安装过命令行工具， 会直接出现弹窗提示，这个时候直接点击安装就可以了。
　　![命令行提示](https://upload-images.jianshu.io/upload_images/1101711-008ebde2ea2441f5.png?imageMogr2/auto-orient/strip|imageView2/2/w/1000)

　　如果出现一些问题（例如系统限制、网络不佳），你也可以使用其他设备下载好离线安装包（可以在[苹果官网](https://developer.apple.com/xcode/resources/)进行选择 Command Line Tools）然后进行安装。 
#### 2. 安装 Homebrew
　　Homebrew 官方说法是一个**软件包管理工具**，通俗一点可以理解成一个各种工具的“管家”。因为并非所有软件的开发者都会给自己的工具开发好看的 UI 界面，做一个好看的网站展示自己的工具。很多人都只是写出一段代码，直接上传至网上供大家使用，所以这是就需要一个东西来对这些巨量的小工具进行一个管理，Homebrew 就是这个东西，要先下载它，然后再通过它去下载 adb 工具。

　　还是那个终端，输入`ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"`

　　这个时候不出意外应该会让你输入你的电脑密码，就是下面这坨：

![image-20211216152644657](https://tva1.sinaimg.cn/large/008i3skNgy1gxfpfd4cwvj304m00yt8h.jpg)

　　在输入过程中界面是不会出现什么反馈的，直接输入，输入完成敲回车就可以。

　　后续安装命令行给的提示继续完成安装。

![image-20211216153049799](https://tva1.sinaimg.cn/large/008i3skNgy1gxfvko282ij30r4080my5.jpg)

　　（这个时候记得敲下回车）

　　等到界面上出现`==> Installation successful!`就意味着安装已经正式完成了。

#### 3. 使用 Homebrew 安装 adb

　　直接输入

`brew install --cask android-platform-tools`

　　等界面安静下来就说明安装完成了，可以输入命令`adb version`查看是否安装成功。

![image-20211216154806477](https://tva1.sinaimg.cn/large/008i3skNgy1gxfvkp1cixj30ve0dcjuh.jpg)

　　如果能正常显示版本，就说明安装成功了。

### Windows 安装

　　Windows 相对来说更加“工程师友好”一些，不需要安装命令行工具也不需要安装 Homebrew ，下载 adb 并配置完成后就可以直接使用。

　　先去官网下载一下，adb 被官方打包进了一个工具包中，名称叫做 [SDK Platform Tools](https://developer.android.com/studio/releases/platform-tools)（访问不了外网的可以在[国内网站](https://www.androiddevtools.cn/)下载镜像）。

　　下载完成后解压：

【补图，windows 的安装目录】

　　然后，移动到合适的目录里（推荐放Ｃ盘，不会乱动），之后要把这个目录记下来。比如如果将 platform 放到了“C:/windows”这下面，就把“C:/windows/platform-tools”这个记下来，后面有大用处。

　　然后，按 windows + r ，输入 sysdm.cpl 回车，依次点击 高级-环境变量-系统变量-path。将adb的存放路径添加进path中。

【补图，增加环境变量】

　　连续确定后，adb 就安装完成了。

　　还是 windows + r ，输入 cmd 回车，打开命令行工具（如果之前开了的话需要关闭再打开），还是输入 adb version ，如果出现版本信息就安装成功了。

## 三、ADB 用法

　　正式使用 adb 之前需要打开手机的 USB 调试，具体方法每个手机都不一样，自行搜索吧。打开之后记得连接到电脑。

**安装 apk**

　　使用`adb install <apk 目录>`

　　例如 `adb install C:\\Users\\iw\\Desktop\\cod.apk`

　　不过，安装 apk 的过程中会有一些特殊情况，这个时候就需要增加一些特别的参数来保证安装成功。

　　比如有时候安装提示[INSTALL_FAILED_TEST_ONLY]，说明这个 apk 并不是正式的版本，所以不能直接被安装在手机上，这个时候需要使用 `adb install -t <apk 目录>`来完成安装

　　如果提示[INSTALL_FAILED_ALREADY_EXISTS]，说明已经有同样的应用被安装了，需要使用`adb install -r <apk 目录>`完成覆盖安装.

　　如果提示[INSTALL_FAILED_VERSION_DOWNGRADE]，说明你要装的 apk 版本还没有手机里的高，使用`adb install -d <apk 目录>`完成降级安装。

　　需要说一下这些命令也是可以混用的，比如你想装一个低版本测试专用应用，可以直接使用`adb install -r -t <apk 目录>`

**发送文件到手机/从手机拿文件**

　　如果只是简单的发送一些文件到手机，之前需要下载一些专用的软件，但其实可以直接通过 adb 的命令在不安装任何应用的前提下发送文件。使用`adb push <电脑文件路径> <手机路径>`

　　比如我想把桌面上的一个 apk 发送到手机的 根目录，那就直接使用`adb push /Users/username/desktop/cod.apk \sdcard\ `

　　会出现一个百分比，等到百分比达到 100% 后，就发送成功了。

　　和 push 相对应的是 pull ，可以直接理解成从手机里拿文件。使用 `adb pull <手机文件路径> <电脑路径>`即可。

**重启**

`adb shell reboot`

　　重启还有一些比较有趣用法，在后面加上 recovery 可以直接进入 recovery 模式进行卡刷，如果是高通芯片的手机还可以通过加上 edl 进入高通的刷机模式进行线刷。

**截图录屏**

先`adb shell screencap -p /sdcard/screenshot.png`截图（使用 screenrecord 可以录屏）

然后`adb pull /sdcard/screenshot.png /Users/username/downloads`把图片从手机拿到电脑

***

上面是比较常用的，下面是一些比较好玩的 adb 用法：

**调戏电量**

`adb shell dumpsys battery unplug`设置手机为断开充电状态

`adb shell dumpsys battery set wireless 2`设置手机为无线充电

`adb shell dumpsys battery set level 100`设置手机电量百分比

玩够了记得使用`adb shell dumpsys battery reset`复位

**模拟点击**

`adb shell input tap [x坐标] [y坐标]`在坐标 x,y 点击一下

`adb shell input swipe [起始x坐标] [起始y坐标] [目标x坐标] [目标y坐标] [耗时]` 在手机上模拟滑动

`adb shell input text [字符串]` 模拟输入字符串

**永不锁屏**

`adb shell settings put system screen_off_timeout 2147483647`（严格来说是设置了一个超长的息屏时间）

## 四、其他

**不用数据线也能连接的方法**

　　adb 是支持无线连接的，具体方法可以去 USB 调试下面，可以看到一个无线调试。

![QtScrcpy_20211216_184745_521](https://tva1.sinaimg.cn/large/008i3skNgy1gxfvkq59b3j30w50u0413.jpg)

　　打开然后点进去

![QtScrcpy_20211216_184802_572](https://tva1.sinaimg.cn/large/008i3skNgy1gxfvkpi9r8j30w50u0abn.jpg)

　　有个 IP 地址，记下来，然后在电脑上使用命令`adb connect <IP 地址>`，就可以直接连上了。不用了记得使用`adb disconnect <IP 地址>`断开连接。

**适合懒人的 adb 使用方法**

　　去 github 上下载一个别人封装好的 adb 工具 [QtScrcpy](https://github.com/barry-ran/QtScrcpy/blob/master/README_zh.md)，然后直接打开使用。

![截屏2021-12-16 下午6.52.40](https://tva1.sinaimg.cn/large/008i3skNgy1gxfvknj8skj30u0180tca.jpg)

　　这里基本把所有的常用命令都以按钮的方式列出了，可以直接一键操作。更重要的是，这个工具应该内置了 adb 工具，所以不需要前面下载并安装 adb 也能够直接使用。

　　虽然 QtScrcpy 这个工具非常的简单好用，但是使用上没有直接敲命令行来的帅气，所以我建议还是用上述的方式一步一步进行安装。
