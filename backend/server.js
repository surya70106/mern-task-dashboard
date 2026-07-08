/**
 * NOTE: This server is NOT used in Vercel deployment.
 * For Vercel, only the /api/ai.js serverless function is used.
 * This file is only for local development of the Claude AI endpoint.
 *
 * Run locally with: node server.js
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS — allow the Vite dev server
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ─── AI routes only (everything else is handled client-side) ───
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/ai', async (req, res) => {
  const { action, mood, genre, language, referenceMovie, actor, message, history } = req.body;

  try {
    if (action === 'recommend') {
      const prompt = `You are a TV show recommendation expert. Based on these preferences, recommend exactly 8 shows.

User Preferences:
- Mood: ${mood || 'Any'}
- Genre: ${genre || 'Any'}
- Language: ${language || 'Any'}
- Reference Show: ${referenceMovie || 'None'}
- Favorite Actor: ${actor || 'None'}

Return ONLY a valid JSON array with exactly 8 objects. Each must have:
- "title": string
- "year": number
- "reason": 2 sentences why it fits
- "genres": array of strings
- "rating": number out of 10
- "mood_match": percentage string like "92%"

Return ONLY the JSON array, no markdown.`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text.trim();
      let results;
      try {
        results = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        results = match ? JSON.parse(match[0]) : [];
      }
      return res.json({ success: true, results, data: results });
    }

    if (action === 'chat') {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are CineMind AI, a friendly TV show and movie recommendation assistant.',
        messages: [
          ...(history || []).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      });
      return res.json({ success: true, response: response.content[0].text });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('AI error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`🚀 Local dev server on http://localhost:${PORT}`));