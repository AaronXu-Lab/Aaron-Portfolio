import Vditor from 'vditor';

const get = (id) => document.getElementById(id);
const loginForm = get('login');
const manage = get('manage');
const editForm = get('article-editor');
const signOut = get('sign-out');
const viewPost = get('view-post');
const status = get('admin-status');
const publish = get('publish');
const deletePost = get('delete-post');
const deleteDialog = get('delete-dialog');
const draft = editForm.querySelector('[value="draft"]');
const fields = editForm.elements;
let editor;
let editorReady;
let activePost;
let baseline;
let uploading = false;

function notice(message = '', error = false) {
  status.textContent = message;
  status.toggleAttribute('data-error', error);
}

class RequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, method = 'GET', input) {
  const headers = {};
  let body;
  if (input instanceof Blob) {
    headers['Content-Type'] = input.type;
    body = input;
  } else if (input !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(input);
  }
  const response = await fetch('/api/blog/' + path, { method, headers, body });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) throw new RequestError(data?.error ?? '连接失败，请稍后再试。', response.status);
  return data;
}

function show(view) {
  loginForm.hidden = view !== 'login';
  manage.hidden = view !== 'list';
  editForm.hidden = view !== 'editor';
  signOut.hidden = view === 'login';
}

async function action(handler) {
  try {
    notice();
    await handler();
  } catch (error) {
    notice(error.message || '操作失败，请稍后再试。', true);
    if (error.status === 401 && loginForm.hidden) {
      show('login');
      loginForm.elements.accessKey.focus();
    }
  }
}

async function showPosts() {
  const posts = await request('posts');
  const list = get('admin-posts');
  list.replaceChildren();
  get('admin-empty').hidden = posts.length !== 0;
  for (const post of posts) {
    const row = document.createElement('li');
    const button = document.createElement('button');
    const title = document.createElement('span');
    const info = document.createElement('span');
    button.type = 'button';
    title.textContent = post.title;
    info.className = 'mono-sm';
    info.textContent = post.status === 'published' ? '已发布' : '草稿';
    button.append(title, info);
    row.append(button);
    list.append(row);
    button.addEventListener('click', () => action(async () => openEditor(await request('posts/' + post.id))));
  }
  baseline = undefined;
  show('list');
}

function updateEditButtons() {
  const blocked = uploading || editForm.hasAttribute('aria-busy');
  draft.disabled = blocked;
  publish.disabled = blocked;
  deletePost.disabled = blocked;
}

async function uploadImages(files) {
  if (uploading || !files.length) return null;
  uploading = true;
  updateEditButtons();
  notice('正在上传图片…');
  try {
    for (const file of files) {
      const image = await request('media', 'POST', file);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]\\\n\r]/g, '');
      editor.insertValue(`\n![${alt}](${image.url})\n`);
    }
    notice();
  } catch (error) {
    notice(error.message, true);
  } finally {
    uploading = false;
    updateEditButtons();
  }
  return null;
}

function getEditor() {
  if (editorReady) return editorReady;
  const dark = () => document.documentElement.dataset.theme === 'dark';
  editorReady = new Promise((resolve) => {
    editor = new Vditor('vditor', {
      mode: 'ir',
      lang: 'zh_CN',
      cdn: '/vendor/vditor',
      theme: dark() ? 'dark' : 'classic',
      cache: { enable: false },
      minHeight: 480,
      placeholder: '在这里写正文，支持 Markdown 和粘贴图片',
      toolbar: ['headings', 'bold', 'italic', 'strike', '|', 'quote', 'list', 'ordered-list', 'check', '|',
        'code', 'inline-code', 'link', 'table', 'upload', '|', 'undo', 'redo', 'fullscreen'],
      preview: {
        theme: { current: '' },
        hljs: { enable: false },
        markdown: { sanitize: true, codeBlockPreview: false, mathBlockPreview: false },
      },
      upload: {
        accept: 'image/jpeg,image/png,image/webp',
        max: 5 * 1024 * 1024,
        handler: uploadImages,
      },
      after() {
        const input = get('vditor').querySelector('.vditor-ir [contenteditable="true"]');
        input?.setAttribute('role', 'textbox');
        input?.setAttribute('aria-label', '正文');
        input?.setAttribute('aria-multiline', 'true');
        new MutationObserver(() => {
          editor.setTheme(dark() ? 'dark' : 'classic');
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        resolve(editor);
      },
    });
  });
  return editorReady;
}

function snapshot() {
  return {
    title: fields.title.value,
    body: editor.getValue(),
    category: fields.category.value,
    tags: fields.tags.value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean),
  };
}

function updatePostControls() {
  const published = activePost?.status === 'published';
  draft.hidden = published;
  deletePost.hidden = !activePost;
  publish.textContent = published ? '更新文章' : '发布文章';
  viewPost.hidden = !published;
  if (published) viewPost.href = '/blog/' + encodeURIComponent(activePost.slug) + '/';
}

async function openEditor(post) {
  activePost = post;
  fields.title.value = post?.title ?? '';
  fields.category.value = post?.category ?? '';
  fields.tags.value = post ? JSON.parse(post.tags).join('，') : '';
  updatePostControls();
  show('editor');
  editForm.setAttribute('aria-busy', 'true');
  updateEditButtons();
  try {
    await getEditor();
    editor.setValue(post?.body ?? '', true);
    baseline = JSON.stringify(snapshot());
    fields.title.focus();
  } finally {
    editForm.removeAttribute('aria-busy');
    updateEditButtons();
  }
}

function isDirty() {
  return baseline !== undefined && baseline !== JSON.stringify(snapshot());
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const submit = event.submitter;
  if (submit.disabled) return;
  submit.disabled = true;
  const input = Object.fromEntries(new FormData(loginForm));
  action(async () => {
    await request('login', 'POST', input);
    loginForm.reset();
    if (baseline !== undefined) show('editor');
    else await showPosts();
  }).finally(() => { submit.disabled = false; });
});

get('new-post').addEventListener('click', () => action(() => openEditor(null)));
get('back-to-posts').addEventListener('click', () => {
  if (!isDirty() || window.confirm('离开编辑器将丢失未保存的修改。')) action(showPosts);
});
signOut.addEventListener('click', () => {
  if (isDirty() && !window.confirm('退出登录将丢失未保存的修改。')) return;
  action(async () => {
    await request('logout', 'POST');
    baseline = undefined;
    editor?.setValue('', true);
    show('login');
  });
});

editForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (uploading || editForm.hasAttribute('aria-busy')) return;
  const state = activePost?.status === 'published' || event.submitter?.value === 'published' ? 'published' : 'draft';
  const current = snapshot();
  editForm.setAttribute('aria-busy', 'true');
  updateEditButtons();
  action(async () => {
    activePost = await request(activePost ? 'posts/' + activePost.id : 'posts',
      activePost ? 'PUT' : 'POST', { ...current, status: state, revision: activePost?.revision });
    baseline = JSON.stringify(current);
    updatePostControls();
    notice(state === 'published' ? '文章已发布。' : '草稿已保存。');
  }).finally(() => {
    editForm.removeAttribute('aria-busy');
    updateEditButtons();
  });
});

deletePost.addEventListener('click', () => {
  if (!activePost || deletePost.disabled) return;
  get('delete-description').textContent = `确定删除《${activePost.title}》？删除后无法恢复。`;
  deleteDialog.returnValue = '';
  deleteDialog.showModal();
});

deleteDialog.addEventListener('close', () => {
  if (deleteDialog.returnValue !== 'delete' || !activePost || deletePost.disabled) return;
  const { id, revision } = activePost;
  editForm.setAttribute('aria-busy', 'true');
  updateEditButtons();
  action(async () => {
    await request('posts/' + id, 'DELETE', { revision });
    activePost = undefined;
    baseline = undefined;
    updatePostControls();
    await showPosts();
    notice('文章已删除。');
    get('new-post').focus();
  }).finally(() => {
    editForm.removeAttribute('aria-busy');
    updateEditButtons();
  });
});

window.addEventListener('beforeunload', (event) => {
  if (isDirty()) event.preventDefault();
});

action(async () => {
  try {
    await request('session');
    await showPosts();
  } catch (error) {
    show('login');
    if (error.status !== 401) throw error;
  }
});
