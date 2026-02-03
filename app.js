// Minimal chat UI logic with streaming-friendly request handling.
// Expected backend endpoints:
// POST /api/chat  -> Accepts JSON { message: "..." }
// Responds with either:
//  - streaming text (chunked) in response.body (UTF-8 chunks) OR
//  - non-streaming JSON { reply: "..." }

(() => {
  const messagesEl = document.getElementById('messages');
  const input = document.getElementById('messageInput');
  const form = document.getElementById('inputForm');
  const sendBtn = document.getElementById('sendBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const clearBtn = document.getElementById('clearBtn');

  let isStreaming = false;

  function scrollToBottom() {
    messagesEl.parentElement.scrollTop = messagesEl.parentElement.scrollHeight;
  }

  function createMessageElement({ role, text, time }) {
    const li = document.createElement('li');
    li.className = 'message-row';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? '🙂' : '🤖';
    avatar.style.width = '36px';
    avatar.style.height = '36px';

    const wrapper = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.className = `message ${role}`;
    bubble.textContent = text || '';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = time ? new Date(time).toLocaleTimeString() : '';

    wrapper.appendChild(bubble);
    wrapper.appendChild(meta);

    if (role === 'user') {
      li.appendChild(wrapper);
      li.appendChild(avatar);
    } else {
      li.appendChild(avatar);
      li.appendChild(wrapper);
    }

    return { li, bubble };
  }

  function showTyping(show = true) {
    typingIndicator.hidden = !show;
  }

  function appendMessage(role, text) {
    const { li } = createMessageElement({ role, text, time: Date.now() });
    messagesEl.appendChild(li);
    scrollToBottom();
  }

  function addBotPlaceholder() {
    const { li, bubble } = createMessageElement({ role: 'bot', text: '' });
    bubble.classList.add('streaming');
    messagesEl.appendChild(li);
    scrollToBottom();
    return bubble;
  }

  async function sendToServer(message) {
    showTyping(true);
    isStreaming = true;

    // Add placeholder bot message and capture bubble to append streaming text
    const bubble = addBotPlaceholder();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      // If response has a readable stream, append chunks as they arrive
      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let textSoFar = '';
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            textSoFar += chunk;
            // Update bubble text progressively
            bubble.textContent = textSoFar;
            scrollToBottom();
          }
        }
      } else {
        // Fallback: non-streaming JSON
        const data = await res.json();
        const reply = data?.reply ?? String(data);
        bubble.textContent = reply;
      }
    } catch (err) {
      console.error(err);
      bubble.textContent = 'Error: ' + (err.message || 'Unexpected error');
      bubble.style.color = '#ffb4b4';
    } finally {
      showTyping(false);
      isStreaming = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    appendMessage('user', val);
    input.value = '';
    // Fire and forget streaming send
    sendToServer(val);
  });

  // Enter to send, Shift+Enter newline
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  clearBtn.addEventListener('click', () => {
    messagesEl.innerHTML = '';
  });

  // Simple sample welcome message
  appendMessage('bot', 'Hi — I am your assistant. Ask me anything.');
})();
