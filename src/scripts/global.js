// 全站微交互:主题切换 / 头部滚动态 / 滚动显现 / scrollspy / 复制按钮

// ---- 主题切换 ----
const toggle = document.getElementById('theme-toggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
  });
}

// ---- 头部滚动态(IO 哨兵,避免 scroll 监听) ----
const header = document.querySelector('.site-header');
const sentinel = document.querySelector('.scroll-sentinel');
if (header && sentinel) {
  new IntersectionObserver(([e]) =>
    header.classList.toggle('scrolled', !e.isIntersecting)
  ).observe(sentinel);
}

// ---- 移动端导航:单次点按开关,不依赖 hover / 横向拖动 ----
const mobileNavToggle = document.getElementById('mobile-nav-toggle');
const mobileNav = document.getElementById('mobile-nav');
if (header && mobileNavToggle && mobileNav) {
  const backgroundContent = [
    document.querySelector('main'),
    document.querySelector('.site-footer'),
    document.querySelector('.skip-link'),
  ].filter(Boolean);

  const setMobileNav = (open, restoreFocus = true) => {
    mobileNavToggle.setAttribute('aria-expanded', String(open));
    mobileNavToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    mobileNav.setAttribute('aria-hidden', String(!open));
    mobileNav.classList.toggle('open', open);
    mobileNav.toggleAttribute('inert', !open);
    header.classList.toggle('menu-open', open);
    document.documentElement.classList.toggle('mobile-nav-open', open);
    backgroundContent.forEach((element) => element.toggleAttribute('inert', open));

    if (open) {
      requestAnimationFrame(() => mobileNav.querySelector('a')?.focus());
    } else if (restoreFocus) {
      mobileNavToggle.focus();
    }
  };

  mobileNav.setAttribute('inert', '');
  mobileNavToggle.addEventListener('click', () => {
    setMobileNav(mobileNavToggle.getAttribute('aria-expanded') !== 'true');
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMobileNav(false, false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileNavToggle.getAttribute('aria-expanded') === 'true') {
      setMobileNav(false);
    }
  });

  matchMedia('(max-width: 720px), (hover: none) and (pointer: coarse)').addEventListener(
    'change',
    (event) => {
      if (!event.matches) setMobileNav(false, false);
    }
  );

  header.addEventListener('dragstart', (event) => {
    if (event.target instanceof Element && event.target.closest('a, button')) {
      event.preventDefault();
    }
  });
}

// ---- 滚动显现(交错延迟通过 --d 控制) ----
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  revealEls.forEach((el) => io.observe(el));
}

// ---- 首页 scrollspy:高亮当前所在区块的导航项 ----
if (header?.dataset.scrollspy) {
  const links = new Map();
  header.querySelectorAll('nav a[data-nav]').forEach((link) => {
    const group = links.get(link.dataset.nav) ?? [];
    group.push(link);
    links.set(link.dataset.nav, group);
  });
  const mobileCurrent = header.querySelector('[data-mobile-current]');
  const sections = [...document.querySelectorAll('section[data-spy]')];
  if (sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          links.forEach((group) => group.forEach((link) => link.classList.remove('active')));
          const activeLinks = links.get(e.target.dataset.spy) ?? [];
          activeLinks.forEach((link) => link.classList.add('active'));
          if (mobileCurrent) {
            mobileCurrent.textContent = activeLinks.find((link) => link.dataset.mobileLabel)
              ?.dataset.mobileLabel ?? '首页';
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sections.forEach((s) => spy.observe(s));
  }
}

// ---- 失效外链图片降级(老博客图床部分已失效) ----
document.querySelectorAll('.prose img').forEach((img) => {
  const mark = () => img.classList.add('broken');
  if (img.complete && img.naturalWidth === 0) mark();
  else img.addEventListener('error', mark, { once: true });
});

// ---- 复制按钮(联系方式) ----
document.querySelectorAll('[data-copy]').forEach((btn) => {
  let resetTimer;
  const status = btn.querySelector('.copy-status');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add('copied');
      if (status) status.textContent = '已复制';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        btn.classList.remove('copied');
        if (status) status.textContent = '';
      }, 2000);
    } catch {
      /* clipboard 不可用时静默 */
    }
  });
});
