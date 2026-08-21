import { createServer } from 'node:http';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initDb,
  dashboard,
  createSourceInput,
  createTimelineEntry,
  createMoment,
  updateMoment,
  deleteMoment,
  createPerson,
  updatePerson,
  ingestOpenClaw,
  createGoal,
  updateGoal,
  updateTimeline,
  createTask,
  updateTask,
  restoreTask,
  setTaskDayPlan,
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
const momentImageDir = path.join(rootDir, 'data', 'moment-images');
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

    if (url.pathname === '/api/moment-images' && req.method === 'POST') {
      const body = await readJson(req);
      return json(res, await saveMomentImage(body));
    }

    const momentMatch = url.pathname.match(/^\/api\/moments\/([^/]+)$/);
    if (momentMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      const result = updateMoment(momentMatch[1], body);
      await Promise.all((result.removedImageUrls || []).map(removeMomentImage));
      return json(res, result);
    }

    if (momentMatch && req.method === 'DELETE') {
      const result = deleteMoment(momentMatch[1]);
      await Promise.all((result.deleted?.imageUrls || []).map(removeMomentImage));
      return json(res, result);
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

    const taskRestoreMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/restore$/);
    if (taskRestoreMatch && req.method === 'POST') {
      return json(res, restoreTask(taskRestoreMatch[1]));
    }

    const taskDayPlanMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/day-plan$/);
    if (taskDayPlanMatch && req.method === 'PUT') {
      const body = await readJson(req);
      return json(res, setTaskDayPlan(taskDayPlanMatch[1], body));
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

    if (url.pathname.startsWith('/moment-images/') && req.method === 'GET') {
      return serveMomentImage(url.pathname, res);
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
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

async function saveMomentImage(payload = {}) {
  const extensionByType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const mimeType = String(payload.mimeType || payload.mime_type || '');
  const extension = extensionByType[mimeType];
  const base64 = String(payload.data || '').replace(/^data:[^;]+;base64,/, '');
  if (!extension || !base64) throw new Error('只支持 JPG、PNG、WebP 或 GIF 图片');
  const file = Buffer.from(base64, 'base64');
  if (!file.length || file.length > 8 * 1024 * 1024) throw new Error('照片大小必须在 8MB 以内');
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  await mkdir(momentImageDir, { recursive: true });
  await writeFile(path.join(momentImageDir, fileName), file);
  return { imageUrl: `/moment-images/${fileName}` };
}

async function removeMomentImage(imageUrl) {
  if (!String(imageUrl || '').startsWith('/moment-images/')) return;
  const fileName = path.basename(imageUrl);
  try {
    await unlink(path.join(momentImageDir, fileName));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function serveMomentImage(urlPath, res) {
  const fileName = path.basename(decodeURIComponent(urlPath));
  const filePath = path.join(momentImageDir, fileName);
  if (!fileName || !existsSync(filePath)) {
    res.writeHead(404);
    return res.end();
  }
  return sendFile(filePath, res);
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
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }[ext] || 'application/octet-stream';

  const file = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(file);
}
