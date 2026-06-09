import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initDb,
  dashboard,
  createSourceInput,
  createTimelineEntry,
  createMoment,
  updateMoment,
  createPerson,
  updatePerson,
  ingestOpenClaw,
  createGoal,
  updateGoal,
  updateTimeline,
  createTask,
  updateTask,
  createTag,
  updateTag,
  deleteTag,
  createHabit,
  updateHabit,
  logHabit,
  createScheduleEvent,
  updateScheduleEvent,
  createReminder,
  updateReminder,
  generateReport,
  createReview,
  updateReview,
} from './store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 4173);

initDb(path.join(rootDir, 'data', 'self.sqlite'));

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/dashboard' && req.method === 'GET') {
      return json(res, dashboard());
    }

    if (url.pathname === '/api/ingest' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, ingestOpenClaw(body));
    }

    if (url.pathname === '/api/source-inputs' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createSourceInput(body));
    }

    if (url.pathname === '/api/timeline' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createTimelineEntry(body));
    }

    if (url.pathname === '/api/moments' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createMoment(body));
    }

    const momentMatch = url.pathname.match(/^\/api\/moments\/([^/]+)$/);
    if (momentMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateMoment(momentMatch[1], body));
    }

    if (url.pathname === '/api/people' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createPerson(body));
    }

    const personMatch = url.pathname.match(/^\/api\/people\/([^/]+)$/);
    if (personMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updatePerson(personMatch[1], body));
    }

    if (url.pathname === '/api/goals' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createGoal(body));
    }

    const goalMatch = url.pathname.match(/^\/api\/goals\/([^/]+)$/);
    if (goalMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateGoal(goalMatch[1], body));
    }

    const timelineMatch = url.pathname.match(/^\/api\/timeline\/([^/]+)$/);
    if (timelineMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateTimeline(timelineMatch[1], body));
    }

    if (url.pathname === '/api/tasks' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createTask(body));
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateTask(taskMatch[1], body));
    }

    if (url.pathname === '/api/tags' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createTag(body));
    }

    const tagMatch = url.pathname.match(/^\/api\/tags\/([^/]+)$/);
    if (tagMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateTag(decodeURIComponent(tagMatch[1]), body));
    }

    if (tagMatch && req.method === 'DELETE') {
      return json(res, deleteTag(decodeURIComponent(tagMatch[1])));
    }

    if (url.pathname === '/api/habits' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createHabit(body));
    }

    const habitMatch = url.pathname.match(/^\/api\/habits\/([^/]+)$/);
    if (habitMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateHabit(habitMatch[1], body));
    }

    const habitLogMatch = url.pathname.match(/^\/api\/habits\/([^/]+)\/log$/);
    if (habitLogMatch && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, logHabit(habitLogMatch[1], body));
    }

    if (url.pathname === '/api/schedule' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createScheduleEvent(body));
    }

    const scheduleMatch = url.pathname.match(/^\/api\/schedule\/([^/]+)$/);
    if (scheduleMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateScheduleEvent(scheduleMatch[1], body));
    }

    if (url.pathname === '/api/reminders' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createReminder(body));
    }

    const reminderMatch = url.pathname.match(/^\/api\/reminders\/([^/]+)$/);
    if (reminderMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateReminder(reminderMatch[1], body));
    }

    if (url.pathname === '/api/reports/generate' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, generateReport(body.periodType || 'day'));
    }

    if (url.pathname === '/api/reviews' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, createReview(body));
    }

    const reviewMatch = url.pathname.match(/^\/api\/reviews\/([^/]+)$/);
    if (reviewMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      return json(res, updateReview(reviewMatch[1], body));
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Self Workbench running at http://127.0.0.1:${port}`);
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function json(res, payload) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function serveStatic(urlPath, res) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const requested = cleanPath === '/' ? '/index.html' : cleanPath;
  const filePath = path.normalize(path.join(distDir, requested));

  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    return sendFile(path.join(distDir, 'index.html'), res);
  }

  return sendFile(filePath, res);
}

async function sendFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
  }[ext] || 'application/octet-stream';

  const file = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(file);
}
