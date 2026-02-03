// server.js — Node 18+ (uses global fetch). Serves static frontend and proxies /api/chat to your AI provider.
// Place index.html, styles.css, app.js in ./public

const express = require('express');
const path = require('path');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const AI_API_URL = process.env.AI_API_URL; // e.g. https://api.example.com/v1/stream
const AI_API_KEY = process.env.AI_API_KEY;

if (!AI_API_URL || !AI_API_KEY) {
  console.error('Set AI_API_URL and AI_API_KEY environment variables');
  process.exit(1);
}

const app = express();

// If you want to use this server for frontend + api on same origin, you can skip wide-open CORS.
// Enable if your frontend is served from a different origin while developing.
app.use(cors());
app.use(express.json());

// Serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message' });

    // Forward to AI provider. Adjust body shape to what the provider expects.
    const aiRes = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        input: message,
        stream: true, // request streaming if provider supports it
      }),
    });

    // Forward status and headers (keep content-type so browser knows it's text/event-stream or text/plain)
    res.status(aiRes.status);
    aiRes.headers.forEach((value, key) => res.setHeader(key, value));

    // If the provider returns a stream we pipe it directly.
    if (aiRes.body && typeof aiRes.body.pipe === 'function') {
      aiRes.body.pipe(res);
    } else {
      // Fallback for non-streaming providers
      const text = await aiRes.text();
      res.send(text);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unexpected error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
