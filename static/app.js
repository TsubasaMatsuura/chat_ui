/* ─── app.js ─────────────────────────────────────────── */

let isLoading = false;

/* ---------- Utilities ---------- */
function now() {
    return new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escAttr(str) { return esc(str).replace(/\n/g, '&#10;'); }

function scrollBottom() {
    const el = document.getElementById('chatArea');
    el.scrollTop = el.scrollHeight;
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

/* ---------- Typing indicator ---------- */
function setTyping(on) {
    document.getElementById('typingWrap').classList.toggle('show', on);
    if (on) scrollBottom();
}

/* ---------- Input lock ---------- */
function setInputEnabled(on) {
    const inp = document.getElementById('msgInput');
    const btn = document.getElementById('sendBtn');
    inp.disabled = !on;
    btn.disabled = !on;
    if (!on) inp.placeholder = '会話が完了しました';
}

/* ---------- Add user bubble ---------- */
function addUserMsg(text) {
    const area = document.getElementById('chatArea');
    const g = document.createElement('div');
    g.className = 'message-group user';
    g.innerHTML = `
    <div class="avatar user-avatar">You</div>
    <div class="msg-content">
      <div class="bubble user-bubble">${esc(text).replace(/\n/g, '<br>')}</div>
      <div class="msg-time">${now()}</div>
    </div>`;
    area.appendChild(g);
    scrollBottom();
}

/* ---------- Add AI bubble ---------- */
function addAIMsg(data) {
    const area = document.getElementById('chatArea');
    const g = document.createElement('div');
    g.className = 'message-group ai';

    const text = (data.text || '').replace(/\n/g, '<br>');
    const buttons = Array.isArray(data.button) ? data.button : [];
    const uid = 'opts-' + Date.now();

    /* buttons */
    const btnsHtml = buttons.length ? `
    <div class="options" id="${uid}">
      ${buttons.map(b => `
        <button class="option-btn"
          onclick="pickOption(this,'${uid}','${escAttr(b)}')">${esc(b)}
        </button>`).join('')}
    </div>` : '';

    /* status chips */
    let chips = '';
    if (data.complete_flag) chips += `<span class="chip chip-complete">✅ 受付完了</span>`;
    if (data.attachment_flag) chips += `<span class="chip chip-attach">📎 写真・動画の添付をお願いします</span>`;
    if (data.type === 'error') chips += `<span class="chip chip-error">⚠️ エラーが発生しました</span>`;

    g.innerHTML = `
    <div class="avatar ai-avatar">AI</div>
    <div class="msg-content">
      <div class="bubble ai-bubble">${text}</div>
      ${btnsHtml}
      ${chips}
      <div class="msg-time">${now()}</div>
    </div>`;

    area.appendChild(g);
    scrollBottom();

    if (data.complete_flag) {
        setInputEnabled(false);
        addSystemMsg('会話が完了しました。リセットボタンで新しい会話を開始できます。');
    }
}

/* ---------- System message ---------- */
function addSystemMsg(text) {
    const area = document.getElementById('chatArea');
    const d = document.createElement('div');
    d.className = 'system-msg';
    d.textContent = text;
    area.appendChild(d);
    scrollBottom();
}

/* ---------- Option button click ---------- */
function pickOption(btn, uid, value) {
    /* lock all buttons in this group */
    document.querySelectorAll(`#${uid} .option-btn`).forEach(b => {
        b.disabled = true;
        b.classList.remove('selected');
    });
    btn.classList.add('selected');
    btn.disabled = false; /* keep visible */

    /* fire as user message */
    sendMessage(value);
}

/* ---------- Main send ---------- */
async function sendMessage(override) {
    if (isLoading) return;

    const inp = document.getElementById('msgInput');
    const text = (override !== undefined ? override : inp.value).trim();
    if (!text) return;

    /* clear input */
    if (override === undefined) { inp.value = ''; autoResize(inp); }

    addUserMsg(text);
    isLoading = true;
    setTyping(true);

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        const data = await res.json();
        setTyping(false);

        if (!res.ok) {
            addAIMsg({ text: data.error || 'エラーが発生しました', button: [], type: 'error' });
        } else {
            addAIMsg(data);
        }

    } catch (err) {
        setTyping(false);
        addAIMsg({ text: `通信エラー: ${err.message}`, button: [], type: 'error' });
    } finally {
        isLoading = false;
        if (!document.getElementById('msgInput').disabled) {
            document.getElementById('msgInput').focus();
        }
    }
}

/* ---------- Reset ---------- */
async function resetChat() {
    if (isLoading) return;
    try {
        await fetch('/api/reset', { method: 'POST' });
    } catch (_) { }

    const area = document.getElementById('chatArea');
    area.innerHTML = '';

    /* Restore welcome message */
    const g = document.createElement('div');
    g.className = 'message-group ai';
    g.innerHTML = `
    <div class="avatar ai-avatar">AI</div>
    <div class="msg-content">
      <div class="bubble ai-bubble">
        こんにちは！入居者サポートAIです。<br>
        お部屋や設備に関するお困りごとをお気軽にご相談ください。
      </div>
      <div class="msg-time">${now()}</div>
    </div>`;
    area.appendChild(g);

    setInputEnabled(true);
    document.getElementById('msgInput').focus();
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
    /* set welcome time */
    const wt = document.getElementById('welcomeTime');
    if (wt) wt.textContent = now();

    document.getElementById('msgInput').focus();

    /* verify server status */
    fetch('/api/status')
        .then(r => r.json())
        .then(d => {
            if (d.status !== 'ready') {
                addSystemMsg('⚠️  main.py が見つかりません。demo_ui/ に配置してください。');
                setInputEnabled(false);
            }
        })
        .catch(() => {
            addSystemMsg('⚠️  サーバーに接続できません。');
        });
});
