import { Router } from 'express';
import { db } from '../db/database';
import { generatePreVisitSummary, generatePostVisitSummary } from '../services/aiService';

const router = Router();

// Live Email Outbox & Notification Inspector (Crucial for evaluation without external SMTP)
router.get('/outbox', (_req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT id, recipient_email, recipient_name, recipient_role,
             notification_type, subject, body_text, body_html,
             status, attempts, max_attempts, next_retry_at, error_message,
             created_at, sent_at
      FROM notifications
      ORDER BY created_at DESC
      LIMIT 100
    `).all();

    return res.json({ notifications });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch outbox notifications.' });
  }
});

// System Health Diagnostics
router.get('/health', (_req, res) => {
  try {
    const dbCheck = db.prepare('SELECT 1 as live').get() as any;
    return res.json({
      status: 'healthy',
      database: dbCheck?.live === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
      features: {
        geminiLLM: !!process.env.GEMINI_API_KEY,
        openaiLLM: !!process.env.OPENAI_API_KEY,
        customSMTP: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
        googleCalendarOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// LLM Prompt Testing Playground Endpoint
router.post('/ai-test', async (req, res) => {
  try {
    const { type = 'pre-visit', input, prescription } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required for AI evaluation.' });
    }

    if (type === 'pre-visit') {
      const result = await generatePreVisitSummary(input);
      return res.json({ type: 'pre-visit', result });
    } else {
      const result = await generatePostVisitSummary(input, prescription);
      return res.json({ type: 'post-visit', result });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'AI generation failed.' });
  }
});

export default router;
