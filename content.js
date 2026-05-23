const AIHUB_PROVIDERS = [
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "claude", name: "Claude", url: "https://claude.ai/new" },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app" },
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com/" },
  { id: "kimi", name: "Kimi", url: "https://www.kimi.com/" },
  { id: "doubao", name: "豆包", url: "https://www.doubao.com/chat/" },
  { id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai/" },
  { id: "copilot", name: "Copilot", url: "https://copilot.microsoft.com/" }
];

const AIHUB_TEMPLATES = {
  summarize: {
    label: "总结网页",
    instruction: "请总结这个网页，输出：1. 一句话结论；2. 5 条重点；3. 适合继续追问的 3 个问题。"
  },
  todo: {
    label: "整理待办",
    instruction: "请基于这个网页内容提取我需要处理的事务，按优先级输出待办清单、截止风险和下一步动作。"
  },
  email: {
    label: "写邮件",
    instruction: "请基于这个网页内容帮我起草一封专业邮件，语气清晰、简洁，并列出需要我补充的信息。"
  },
  compare: {
    label: "分析决策",
    instruction: "请基于这个网页内容做决策分析，输出背景、关键事实、利弊、风险和建议结论。"
  }
};

let aihubState = {
  provider: "chatgpt",
  template: "summarize"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "AI_SIDEBAR_TOGGLE") {
    toggleSidebar();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "AI_SIDEBAR_COPY_CONTEXT") {
    copyText(buildPrompt());
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

function toggleSidebar() {
  const root = ensureSidebar();
  root.classList.toggle("ai-sidebar-hub-open");
  refreshSidebar();
}

function ensureSidebar() {
  let root = document.querySelector("#ai-sidebar-hub-root");
  if (root) return root;

  root = document.createElement("aside");
  root.id = "ai-sidebar-hub-root";
  root.innerHTML = renderSidebar();
  document.documentElement.appendChild(root);

  root.querySelector(".aihub-close").addEventListener("click", () => {
    root.classList.remove("ai-sidebar-hub-open");
  });
  root.querySelector(".aihub-copy").addEventListener("click", async () => {
    await copyText(root.querySelector(".aihub-prompt").value);
    setNote("提示词已复制，可粘贴到任意 AI 网页。");
  });
  root.querySelector(".aihub-open").addEventListener("click", async () => {
    const provider = AIHUB_PROVIDERS.find((item) => item.id === aihubState.provider);
    await copyText(root.querySelector(".aihub-prompt").value);
    window.open(provider.url, "_blank", "noopener,noreferrer");
    setNote(`已复制提示词，并打开 ${provider.name}。`);
  });

  root.querySelectorAll(".aihub-provider").forEach((button) => {
    button.addEventListener("click", () => {
      aihubState.provider = button.dataset.provider;
      refreshSidebar();
    });
  });

  root.querySelectorAll(".aihub-template").forEach((button) => {
    button.addEventListener("click", () => {
      aihubState.template = button.dataset.template;
      refreshSidebar();
    });
  });

  return root;
}

function renderSidebar() {
  return `
    <section class="aihub-panel" aria-label="AI 事务侧边栏">
      <header class="aihub-header">
        <div>
          <p class="aihub-title">AI 事务侧边栏</p>
          <p class="aihub-subtitle">复制网页上下文，交给常用 AI 网页处理</p>
        </div>
        <button class="aihub-close" type="button" aria-label="关闭">X</button>
      </header>

      <div class="aihub-body">
        <section class="aihub-section">
          <p class="aihub-label">当前网页</p>
          <p class="aihub-page-title"></p>
          <p class="aihub-page-url"></p>
        </section>

        <section class="aihub-section">
          <p class="aihub-label">选择 AI 网页</p>
          <div class="aihub-grid">
            ${AIHUB_PROVIDERS.map((provider) => `<button class="aihub-provider" data-provider="${provider.id}" type="button">${provider.name}</button>`).join("")}
          </div>
        </section>

        <section class="aihub-section">
          <p class="aihub-label">事务模板</p>
          <div class="aihub-grid">
            ${Object.entries(AIHUB_TEMPLATES).map(([id, template]) => `<button class="aihub-template" data-template="${id}" type="button">${template.label}</button>`).join("")}
          </div>
        </section>

        <section class="aihub-section">
          <p class="aihub-label">发送内容</p>
          <textarea class="aihub-prompt" spellcheck="false"></textarea>
          <div class="aihub-actions">
            <button class="aihub-secondary aihub-copy" type="button">复制提示词</button>
            <button class="aihub-primary aihub-open" type="button">复制并打开</button>
          </div>
          <p class="aihub-note">多数 AI 官网禁止 iframe 嵌入，所以这里采用更稳定的复制上下文 + 打开网页版流程。</p>
        </section>
      </div>
    </section>
  `;
}

function refreshSidebar() {
  const root = document.querySelector("#ai-sidebar-hub-root");
  if (!root) return;

  const page = extractPageContext();
  root.querySelector(".aihub-page-title").textContent = page.title;
  root.querySelector(".aihub-page-url").textContent = page.url;
  root.querySelector(".aihub-prompt").value = buildPrompt(page);

  root.querySelectorAll(".aihub-provider").forEach((button) => {
    button.classList.toggle("aihub-selected", button.dataset.provider === aihubState.provider);
  });
  root.querySelectorAll(".aihub-template").forEach((button) => {
    button.classList.toggle("aihub-selected", button.dataset.template === aihubState.template);
  });
}

function buildPrompt(page = extractPageContext()) {
  const template = AIHUB_TEMPLATES[aihubState.template];
  return [
    template.instruction,
    "",
    `网页标题：${page.title}`,
    `网页链接：${page.url}`,
    "",
    "网页正文摘录：",
    page.text
  ].join("\n");
}

function extractPageContext() {
  const title = document.title || document.querySelector("h1")?.innerText || "Untitled page";
  const text = collectReadableText();
  return {
    title: cleanText(title),
    url: location.href,
    text: text.slice(0, 7000)
  };
}

function collectReadableText() {
  const root = pickReadableRoot();
  const clone = root.cloneNode(true);
  clone.querySelectorAll("script, style, nav, footer, header, aside, form, noscript, svg, canvas, iframe").forEach((node) => {
    node.remove();
  });

  const blocks = [...clone.querySelectorAll("h1, h2, h3, p, li, blockquote")]
    .map((node) => cleanText(node.innerText || node.textContent))
    .filter((text) => text.length >= 24 && text.length <= 900);

  return [...new Set(blocks)].join("\n");
}

function pickReadableRoot() {
  const candidates = [...document.querySelectorAll("article, main, [role='main'], .post, .article, .content")];
  const best = candidates
    .map((node) => ({
      node,
      score: cleanText(node.innerText || node.textContent).length
    }))
    .sort((a, b) => b.score - a.score)[0];

  return best?.score > 200 ? best.node : document.body;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function setNote(message) {
  const note = document.querySelector("#ai-sidebar-hub-root .aihub-note");
  if (note) note.textContent = message;
}

function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim();
}
