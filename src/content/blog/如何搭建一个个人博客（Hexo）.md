---
title: 如何搭建一个个人博客（Hexo）
date: '2017-08-29T16:00:00.000Z'
author: Aaron Xu
tags:
  - 随笔
  - 实习日志
  - 代码
  - 教程
categories:
  - 实习日志
excerpt: >-
  事前准备 学习并熟知Markdown语法 些许的命令行知识 些许的前端知识 些许的git知识 一个gayhub账号 一颗赤诚的心 具体步骤
  搭建个人博客主要分为这几个部分： 安装 git 与 Node.js 安装hexo 在命令行中输入 1 npm install g hexo 
minutes: 3
---
<h2 id="事前准备">
<a href="#%E4%BA%8B%E5%89%8D%E5%87%86%E5%A4%87" class="headerlink" title="事前准备"></a>事前准备</h2>
<ol>
<li>学习并熟知Markdown语法</li>
<li>些许的命令行知识</li>
<li>些许的前端知识</li>
<li>些许的git知识</li>
<li>一个gayhub账号</li>
<li>一颗赤诚的心</li>
</ol><h2 id="具体步骤">
<a href="#%E5%85%B7%E4%BD%93%E6%AD%A5%E9%AA%A4" class="headerlink" title="具体步骤"></a>具体步骤</h2>
<p>搭建个人博客主要分为这几个部分：</p><h3 id="安装git与Node-js">
<a href="#%E5%AE%89%E8%A3%85git%E4%B8%8ENode-js" class="headerlink" title="安装git与Node.js"></a>安装<a href="https://git-scm.com" target="_blank" rel="external">git</a>与<a href="http://nodejs.org" target="_blank" rel="external">Node.js</a>
</h3>
<h3 id="安装hexo">
<a href="#%E5%AE%89%E8%A3%85hexo" class="headerlink" title="安装hexo"></a>安装hexo</h3>
<p>在命令行中输入</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div></pre></td>
<td class="code"><pre><div class="line">npm install -g hexo-cli</div></pre></td>
</tr></table></figure><p>提示安装成功或者可以执行hexo指令即可。<br>安装完成后使用命令行（cd命令）进入合适的文件夹，使用以下命令初始化博客。</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div><div class="line">2</div><div class="line">3</div></pre></td>
<td class="code"><pre><div class="line">hexo init &lt;folder&gt;</div><div class="line">cd &lt;folder&gt;</div><div class="line">npm install</div></pre></td>
</tr></table></figure><p>然后会发现在相应的文件夹目录下出现了名为<folder>的文件夹（<folder>可以改成其他的名字比如xwnblog）文件夹里面会出现一些文件。</folder></folder></p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div><div class="line">2</div><div class="line">3</div><div class="line">4</div><div class="line">5</div><div class="line">6</div><div class="line">7</div></pre></td>
<td class="code"><pre><div class="line">├── _config.yml</div><div class="line">├── package.json</div><div class="line">├── scaffolds</div><div class="line">├── source</div><div class="line">|   ├── _drafts</div><div class="line">|   └── _posts</div><div class="line">└── themes</div></pre></td>
</tr></table></figure><p>hexo就新建完成了，你可以通过</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div></pre></td>
<td class="code"><pre><div class="line">hexo server</div></pre></td>
</tr></table></figure><p>来初始化本地网站，在浏览器里输入0.0.0.0:4000进行查看。<br>查看完了记得用Ctrl+C关掉。</p><h3 id="尝试写文章">
<a href="#%E5%B0%9D%E8%AF%95%E5%86%99%E6%96%87%E7%AB%A0" class="headerlink" title="尝试写文章"></a>尝试写文章</h3>
<p>文件夹中的_post文件夹里面就是那些文章了<br>默认会有一篇示范性的文章<br>你可以通过在命令行里输入</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div></pre></td>
<td class="code"><pre><div class="line">hexo new 文章的名字</div></pre></td>
</tr></table></figure><p>来新建文章，文章是使用Markdown语法书写的，所以要求能熟练使用Markdown语法</p><h3 id="部署本地网站到github">
<a href="#%E9%83%A8%E7%BD%B2%E6%9C%AC%E5%9C%B0%E7%BD%91%E7%AB%99%E5%88%B0github" class="headerlink" title="部署本地网站到github"></a>部署本地网站到github</h3>
<p>github提供了一种方式可以帮助用户用github的服务器存放自己的网站，虽然网速很慢，但是个人博客足够用了。<br>新建一个仓库，命名为：你的github用户名.github.io，例如xuweinan123.github.io。<br>这个仓库有一个HTTPS，复制这个网址到本地网站文件夹的_config.yml中（用记事本或者其他IDE打开）的deploy条目下，如：</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div><div class="line">2</div><div class="line">3</div><div class="line">4</div></pre></td>
<td class="code"><pre><div class="line">deploy:</div><div class="line">  type: git</div><div class="line">  repository: https://github.com/XuWeinan123/XuWeinan123.github.io.git</div><div class="line">  branch: master</div></pre></td>
</tr></table></figure><p>然后使用命令行命令</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div><div class="line">2</div></pre></td>
<td class="code"><pre><div class="line">hexo generate</div><div class="line">hexo deploy</div></pre></td>
</tr></table></figure><p>第一个命令是将你的文章生成静态网页以便上传<br>第二个命令是进行网页的部署，将网页上传到github，第一次上传会比较长。<br><em>PS：如果是第一次使用git工具，会要求你输入github的用户名和密码</em><br>上传完成之后，访问你的github仓库，确认部署成功。<br>访问 网址“你的github用户名.github.io“ 如果可以正常访问说明你的网站已经被部署成功。</p><h3 id="自定义域名">
<a href="#%E8%87%AA%E5%AE%9A%E4%B9%89%E5%9F%9F%E5%90%8D" class="headerlink" title="自定义域名"></a>自定义域名</h3>
<p>购买域名，比如www.xuweinan.com，然后后使域名指向 “你的github用户名.github.io“<br>如果你之前执行过</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div></pre></td>
<td class="code"><pre><div class="line">hexo generate</div></pre></td>
</tr></table></figure><p>的话，会有一个public文件夹，这个就是上传到github的部分。<br>新建一个文件，改名为CNAME（无后缀名），然后用记事本打开，在里面填上你的域名，比如www.xuweinan.com。<br>执行</p><figure class="highlight plain"><table><tr>
<td class="gutter"><pre><div class="line">1</div></pre></td>
<td class="code"><pre><div class="line">hexo deploy</div></pre></td>
</tr></table></figure><p>部署，然后等个十分钟左右，取决于DNS提供商的效率，然后就可以通过你的域名访问你的博客了。</p><h2 id="进阶教程">
<a href="#%E8%BF%9B%E9%98%B6%E6%95%99%E7%A8%8B" class="headerlink" title="进阶教程"></a>进阶教程</h2>
<p>过几天再写。</p>
