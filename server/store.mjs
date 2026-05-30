import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let db;

export function initDb(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  createTables();
  seed();
}

export function dashboard() {
  const timeline = all(
    `SELECT timeline_entries.*, tasks.title AS task_title, tasks.task_code
     FROM timeline_entries
     LEFT JOIN tasks ON tasks.task_id = timeline_entries.task_id
     ORDER BY start_at DESC
     LIMIT 20`,
  ).map((entry) => ({
    ...entry,
    tags: tagNamesFor(entry.timeline_id),
    tagIds: tagIdsFor(entry.timeline_id),
    tagKeys: tagKeysFor(entry.timeline_id),
  }));

  const goals = all('SELECT * FROM goals ORDER BY period_start DESC, priority ASC, created_at DESC LIMIT 200').map((goal) => ({
    ...goal,
    tags: tagNamesFor(goal.goal_id),
    tagIds: tagIdsFor(goal.goal_id),
    tagKeys: tagKeysFor(goal.goal_id),
    progress: goalProgress(goal),
  }));
  const tasks = all(
    `SELECT tasks.*, goals.title AS goal_title
     FROM tasks
     LEFT JOIN goals ON goals.goal_id = tasks.goal_id
     ORDER BY
       CASE tasks.status
         WHEN 'doing' THEN 1
         WHEN 'todo' THEN 2
         WHEN 'blocked' THEN 3
         WHEN 'done' THEN 4
         WHEN 'abandoned' THEN 5
         WHEN 'deleted' THEN 6
         ELSE 7
       END,
       tasks.priority ASC,
       COALESCE(tasks.due_at, tasks.created_at) ASC
     LIMIT 200`,
  ).map((task) => ({
    ...task,
    tags: tagNamesFor(task.task_id),
    tagIds: tagIdsFor(task.task_id),
    tagKeys: tagKeysFor(task.task_id),
  }));
  const reports = all('SELECT * FROM reports ORDER BY generated_at DESC LIMIT 6');
  const reminders = all('SELECT * FROM reminders WHERE status = ? ORDER BY priority ASC, created_at DESC LIMIT 4', ['pending']);
  const habits = all('SELECT * FROM habits WHERE status = ? ORDER BY priority ASC, created_at ASC', ['active']).map((habit) => ({
    ...habit,
    tags: tagNamesFor(habit.habit_id),
    tagIds: tagIdsFor(habit.habit_id),
    tagKeys: tagKeysFor(habit.habit_id),
    todayLog: get('SELECT * FROM habit_logs WHERE habit_id = ? AND local_date = ?', [habit.habit_id, today()]) || null,
    weekCount: get(
      'SELECT COUNT(*) AS count FROM habit_logs WHERE habit_id = ? AND local_date >= ? AND status = ?',
      [habit.habit_id, daysAgo(6), 'done'],
    ).count,
  }));
  const schedule = all('SELECT * FROM schedule_events ORDER BY start_at ASC LIMIT 20').map((event) => ({
    ...event,
    tags: tagNamesFor(event.event_id),
    tagIds: tagIdsFor(event.event_id),
    tagKeys: tagKeysFor(event.event_id),
  }));
  const tags = all(
    `SELECT tags.*,
       (SELECT COUNT(*) FROM record_tags WHERE record_tags.tag_id = tags.tag_id) AS usage_count,
       (SELECT COUNT(*) FROM tags child WHERE child.parent_tag_id = tags.tag_id) AS child_count
     FROM tags
     WHERE is_active = 1
     ORDER BY
       category,
       CASE
         WHEN parent_tag_id IS NULL THEN sort_order
         ELSE COALESCE((SELECT parent.sort_order FROM tags parent WHERE parent.tag_id = tags.parent_tag_id), sort_order)
       END,
       parent_tag_id IS NOT NULL,
       sort_order,
       name`,
  );
  const allTags = all(
    `SELECT tags.*,
       (SELECT COUNT(*) FROM record_tags WHERE record_tags.tag_id = tags.tag_id) AS usage_count,
       (SELECT COUNT(*) FROM tags child WHERE child.parent_tag_id = tags.tag_id) AS child_count
     FROM tags
     ORDER BY
       category,
       CASE
         WHEN parent_tag_id IS NULL THEN sort_order
         ELSE COALESCE((SELECT parent.sort_order FROM tags parent WHERE parent.tag_id = tags.parent_tag_id), sort_order)
       END,
       parent_tag_id IS NOT NULL,
       sort_order,
       name`,
  );
  const people = all('SELECT * FROM people WHERE is_active = 1 ORDER BY display_name').map((person) => ({
    ...person,
    aliases: all('SELECT alias_text FROM person_aliases WHERE person_id = ? ORDER BY is_primary DESC, alias_text', [person.person_id]).map((row) => row.alias_text),
  }));

  return {
    todayLabel: new Date().toLocaleDateString('zh-CN', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    timeline,
    goals,
    tasks,
    reports,
    reminders,
    habits,
    schedule,
    tags,
    allTags,
    people,
    aiSuggestion: suggestion(timeline, goals),
    metrics: metrics(timeline),
  };
}

export function handleChat(text) {
  const trimmed = text.trim();
  if (!trimmed) return dashboard();

  const inputId = id('input');
  run(
    'INSERT INTO source_inputs (input_id, happened_at, channel, raw_text, author) VALUES (?, ?, ?, ?, ?)',
    [inputId, now(), 'chat', trimmed, 'user'],
  );

  const action = detectAction(trimmed);
  if (action.type === 'finish') {
    closeOpenTimeline(action.title || trimmed, inputId);
  } else if (action.type === 'switch') {
    closeOpenTimeline('切换任务', inputId);
    createTimeline(action.title, inputId, ['work']);
  } else if (action.type === 'rest') {
    closeOpenTimeline('休息', inputId);
    createTimeline(action.title || '休息', inputId, ['rest']);
  } else if (action.type === 'historic') {
    createTimeline(action.title, inputId, ['work'], action.startAt, action.endAt, 0);
  } else {
    createTimeline(action.title, inputId, action.tags);
  }

  if (/高光|值得记|记成/.test(trimmed)) {
    createMoment(trimmed, inputId);
  }

  return dashboard();
}

export function createGoal(payload) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const level = ['year', 'month', 'week'].includes(payload.level) ? payload.level : 'month';
  const today = new Date();
  const period = periodBounds(level, today);
  const goalId = id('goal');

  run(
    `INSERT INTO goals
      (goal_id, title, level, period_start, period_end, status, priority, success_criteria, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [goalId, title, level, period.start, period.end, payload.status || 'active', 3, payload.successCriteria || '', now()],
  );

  replaceTags(goalId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);

  return dashboard();
}

export function updateGoal(goalId, payload) {
  const existing = get('SELECT * FROM goals WHERE goal_id = ?', [goalId]);
  if (!existing) return dashboard();

  run(
    `UPDATE goals
     SET title = ?, level = ?, status = ?, priority = ?, success_criteria = ?
     WHERE goal_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      payload.level || existing.level,
      payload.status || existing.status,
      Number(payload.priority || existing.priority),
      payload.successCriteria ?? payload.success_criteria ?? existing.success_criteria ?? '',
      goalId,
    ],
  );

  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(goalId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  return dashboard();
}

export function updateTimeline(timelineId, payload) {
  const existing = get('SELECT * FROM timeline_entries WHERE timeline_id = ?', [timelineId]);
  if (!existing) return dashboard();

  run(
    `UPDATE timeline_entries
     SET title = ?, description = ?, quality = ?, kind = ?, task_id = ?
     WHERE timeline_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      payload.description ?? existing.description ?? '',
      payload.quality === '' || payload.quality == null ? null : Number(payload.quality),
      payload.kind || existing.kind,
      payload.taskId ?? payload.task_id ?? existing.task_id ?? null,
      timelineId,
    ],
  );

  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(timelineId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  return dashboard();
}

export function createTask(payload) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const taskId = id('task');
  const status = normalizeTaskStatus(payload.status || 'todo');
  const timestamp = now();
  run(
    `INSERT INTO tasks
      (task_id, task_code, title, description, status, goal_id, project_id, parent_task_id, priority, due_at, created_at, status_updated_at, completed_at, outcome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      taskId,
      nextTaskCode(),
      title,
      payload.description || '',
      status,
      payload.goalId || payload.goal_id || null,
      payload.projectId || payload.project_id || null,
      payload.parentTaskId || payload.parent_task_id || null,
      Number(payload.priority || 3),
      payload.dueAt || payload.due_at || null,
      timestamp,
      timestamp,
      status === 'done' ? timestamp : null,
      payload.outcome || '',
    ],
  );
  replaceTags(taskId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  recordTaskEvent(taskId, 'created', null, status, payload.note || '');
  return dashboard();
}

export function updateTask(taskId, payload) {
  const existing = get('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
  if (!existing) return dashboard();

  const status = normalizeTaskStatus(payload.status || existing.status);
  const statusChanged = status !== existing.status;
  const timestamp = now();
  const completedAt = status === 'done'
    ? (existing.completed_at || timestamp)
    : null;

  run(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, goal_id = ?, project_id = ?, parent_task_id = ?,
         priority = ?, due_at = ?, status_updated_at = ?, completed_at = ?, outcome = ?
     WHERE task_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      payload.description ?? existing.description ?? '',
      status,
      payload.goalId ?? payload.goal_id ?? existing.goal_id ?? null,
      payload.projectId ?? payload.project_id ?? existing.project_id ?? null,
      payload.parentTaskId ?? payload.parent_task_id ?? existing.parent_task_id ?? null,
      Number(payload.priority || existing.priority || 3),
      payload.dueAt ?? payload.due_at ?? existing.due_at ?? null,
      statusChanged ? timestamp : (existing.status_updated_at || timestamp),
      completedAt,
      payload.outcome ?? existing.outcome ?? '',
      taskId,
    ],
  );

  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(taskId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  if (statusChanged) recordTaskEvent(taskId, 'status_changed', existing.status, status, payload.note || '');
  return dashboard();
}

export function createTag(payload) {
  const name = String(payload.name || '').trim();
  const tagKey = normalizeTagKey(payload.tagKey || payload.tag_key || name);
  if (!name || !tagKey) return dashboard();

  const tagId = id('tag');
  const parent = normalizeParentTag(parentRefFromPayload(payload), tagId);
  run(
    `INSERT OR IGNORE INTO tags
      (tag_id, tag_key, name, category, parent_tag_id, parent_tag_key, description, color, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tagId,
      tagKey,
      name,
      normalizeTagCategory(payload.category || 'activity_type'),
      parent?.tag_id || null,
      parent?.tag_key || null,
      payload.description || '',
      payload.color || '',
      Number(payload.sortOrder || payload.sort_order || 100),
      payload.isActive === false || payload.is_active === 0 ? 0 : 1,
    ],
  );
  return dashboard();
}

export function updateTag(tagRef, payload) {
  const existing = tagByRef(tagRef);
  if (!existing) return dashboard();

  const requestedParent = parentRefFromPayload(payload, existing.parent_tag_id ?? null);
  const parent = hasChildTags(existing.tag_id) ? null : normalizeParentTag(requestedParent, existing.tag_id);
  run(
    `UPDATE tags
     SET name = ?, category = ?, parent_tag_id = ?, parent_tag_key = ?, description = ?, color = ?, sort_order = ?, is_active = ?
     WHERE tag_id = ?`,
    [
      String(payload.name || existing.name).trim(),
      normalizeTagCategory(payload.category || existing.category),
      parent?.tag_id || null,
      parent?.tag_key || null,
      payload.description ?? existing.description ?? '',
      payload.color ?? existing.color ?? '',
      Number(payload.sortOrder ?? payload.sort_order ?? existing.sort_order ?? 100),
      payload.isActive === false || payload.is_active === 0 ? 0 : 1,
      existing.tag_id,
    ],
  );
  return dashboard();
}

export function deleteTag(tagRef) {
  const existing = tagByRef(tagRef);
  if (!existing) return dashboard();

  const tagIds = [
    existing.tag_id,
    ...all('SELECT tag_id FROM tags WHERE parent_tag_id = ? ORDER BY sort_order, name', [existing.tag_id]).map((tag) => tag.tag_id),
  ];
  const placeholders = tagIds.map(() => '?').join(', ');

  run(`DELETE FROM record_tags WHERE tag_id IN (${placeholders})`, tagIds);
  run(`DELETE FROM tags WHERE tag_id IN (${placeholders})`, tagIds);
  return dashboard();
}

export function createHabit(payload) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const habitId = id('habit');
  run(
    `INSERT INTO habits
      (habit_id, title, cadence, target_count, status, priority, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      habitId,
      title,
      payload.cadence || 'daily',
      Number(payload.targetCount || payload.target_count || 1),
      payload.status || 'active',
      Number(payload.priority || 3),
      payload.note || '',
      now(),
    ],
  );
  replaceTags(habitId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  return dashboard();
}

export function logHabit(habitId, payload = {}) {
  const habit = get('SELECT * FROM habits WHERE habit_id = ?', [habitId]);
  if (!habit) return dashboard();

  run(
    `INSERT OR REPLACE INTO habit_logs
      (habit_id, local_date, status, quality, note, logged_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      habitId,
      payload.localDate || today(),
      payload.status || 'done',
      payload.quality === '' || payload.quality == null ? null : Number(payload.quality),
      payload.note || '',
      now(),
    ],
  );
  return dashboard();
}

export function createScheduleEvent(payload) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const eventId = id('schedule');
  const startAt = payload.startAt || payload.start_at || now();
  const endAt = normalizeScheduleEnd(startAt, payload.endAt || payload.end_at);
  const tagRefs = payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? [];
  const linkedTimelineId = payload.timelineId || payload.timeline_id || createTimelineFromSchedule({
    title,
    startAt,
    endAt,
    location: payload.location || '',
    note: payload.note || '',
    taskId: payload.taskId || payload.task_id || null,
    tagRefs,
  });

  run(
    `INSERT INTO schedule_events
      (event_id, title, start_at, end_at, status, goal_id, task_id, timeline_id, location, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      title,
      startAt,
      endAt,
      payload.status || 'planned',
      payload.goalId || payload.goal_id || null,
      payload.taskId || payload.task_id || null,
      linkedTimelineId,
      payload.location || '',
      payload.note || '',
      now(),
    ],
  );
  replaceTags(eventId, tagRefs);
  return dashboard();
}

export function updateScheduleEvent(eventId, payload) {
  const existing = get('SELECT * FROM schedule_events WHERE event_id = ?', [eventId]);
  if (!existing) return dashboard();

  run(
    `UPDATE schedule_events
     SET title = ?, start_at = ?, end_at = ?, status = ?, goal_id = ?, task_id = ?, timeline_id = ?, location = ?, note = ?
     WHERE event_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      payload.startAt || payload.start_at || existing.start_at,
      payload.endAt ?? payload.end_at ?? existing.end_at,
      payload.status || existing.status,
      payload.goalId ?? payload.goal_id ?? existing.goal_id ?? null,
      payload.taskId ?? payload.task_id ?? existing.task_id ?? null,
      payload.timelineId ?? payload.timeline_id ?? existing.timeline_id ?? null,
      payload.location ?? existing.location ?? '',
      payload.note ?? existing.note ?? '',
      eventId,
    ],
  );
  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(eventId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  return dashboard();
}

export function generateReport(periodType) {
  const type = ['day', 'week', 'month'].includes(periodType) ? periodType : 'day';
  const timeline = all('SELECT * FROM timeline_entries ORDER BY start_at ASC');
  const goals = all('SELECT * FROM goals WHERE status = ? ORDER BY created_at DESC LIMIT 4', ['active']);
  const doneTasks = get('SELECT COUNT(*) AS count FROM tasks WHERE status = ?', ['done']).count;
  const moments = get('SELECT COUNT(*) AS count FROM moments').count;
  const trackedHours = metrics(timeline).trackedHours;

  const title = {
    day: '今日简报',
    week: '本周回顾',
    month: '本月目标检查',
  }[type];

  const summary = [
    `已记录 ${trackedHours} 小时，完成 ${doneTasks} 个任务，沉淀 ${moments} 个高光。`,
    goals.length ? `当前目标聚焦在：${goals.map((goal) => goal.title).join('、')}。` : '还没有明确目标，可以先写一个月度目标。',
    timeline[0] ? `最近一段时间线是“${timeline.at(-1).title}”。` : '可以从聊天框开始记录第一条 timeline。',
  ].join(' ');

  run(
    `INSERT INTO reports
      (report_id, period_type, period_start, period_end, title, summary, generated_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id('report'), type, today(), today(), title, summary, now(), 'final'],
  );

  return dashboard();
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_inputs (
      input_id TEXT PRIMARY KEY,
      happened_at TEXT NOT NULL,
      channel TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      author TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timeline_entries (
      timeline_id TEXT PRIMARY KEY,
      source_input_id TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT,
      local_date TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      kind TEXT NOT NULL,
      project_id TEXT,
      task_id TEXT,
      quality INTEGER,
      is_estimated INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      task_code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      goal_id TEXT,
      project_id TEXT,
      parent_task_id TEXT,
      priority INTEGER NOT NULL,
      due_at TEXT,
      created_at TEXT NOT NULL,
      status_updated_at TEXT,
      completed_at TEXT,
      outcome TEXT
    );

    CREATE TABLE IF NOT EXISTS task_events (
      event_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      happened_at TEXT NOT NULL,
      note TEXT,
      input_id TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      goal_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      level TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL,
      success_criteria TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      report_id TEXT PRIMARY KEY,
      period_type TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS moments (
      moment_id TEXT PRIMARY KEY,
      source_input_id TEXT,
      happened_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      title TEXT NOT NULL,
      story TEXT,
      importance INTEGER NOT NULL,
      project_id TEXT,
      task_id TEXT,
      timeline_id TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      tag_id TEXT PRIMARY KEY,
      tag_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      parent_tag_id TEXT,
      parent_tag_key TEXT,
      description TEXT,
      color TEXT,
      sort_order INTEGER NOT NULL DEFAULT 100,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS record_tags (
      record_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (record_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS people (
      person_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT,
      relationship_type TEXT,
      note TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS person_aliases (
      alias_id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      alias_text TEXT NOT NULL,
      alias_type TEXT NOT NULL,
      is_primary INTEGER NOT NULL,
      confidence REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      reminder_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      reminder_type TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL,
      reason TEXT NOT NULL,
      suggested_action TEXT,
      goal_id TEXT,
      task_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      habit_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cadence TEXT NOT NULL,
      target_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      habit_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      status TEXT NOT NULL,
      quality INTEGER,
      note TEXT,
      logged_at TEXT NOT NULL,
      PRIMARY KEY (habit_id, local_date)
    );

    CREATE TABLE IF NOT EXISTS schedule_events (
      event_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT,
      status TEXT NOT NULL,
      goal_id TEXT,
      task_id TEXT,
      timeline_id TEXT,
      location TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );
  `);
  migrateTables();
}

function migrateTables() {
  ensureColumn('tasks', 'description', 'TEXT');
  ensureColumn('tasks', 'goal_id', 'TEXT');
  ensureColumn('tasks', 'parent_task_id', 'TEXT');
  ensureColumn('tasks', 'due_at', 'TEXT');
  ensureColumn('tasks', 'status_updated_at', 'TEXT');
  ensureColumn('tasks', 'completed_at', 'TEXT');
  ensureColumn('tasks', 'outcome', 'TEXT');
  ensureColumn('task_events', 'from_status', 'TEXT');
  ensureColumn('task_events', 'to_status', 'TEXT');
  ensureColumn('task_events', 'input_id', 'TEXT');
  ensureColumn('tags', 'parent_tag_id', 'TEXT');
  ensureColumn('tags', 'parent_tag_key', 'TEXT');
  ensureColumn('tags', 'sort_order', 'INTEGER NOT NULL DEFAULT 100');
  migrateRecordTags();
  ensureColumn('schedule_events', 'goal_id', 'TEXT');
  ensureColumn('schedule_events', 'task_id', 'TEXT');
  ensureColumn('schedule_events', 'timeline_id', 'TEXT');
  run('UPDATE tasks SET status_updated_at = created_at WHERE status_updated_at IS NULL');
}

function ensureColumn(table, column, definition) {
  const columns = all(`PRAGMA table_info(${table})`).map((row) => row.name);
  if (!columns.includes(column)) run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateRecordTags() {
  const columns = all('PRAGMA table_info(record_tags)').map((row) => row.name);
  if (columns.includes('tag_id') && !columns.includes('tag_key')) return;

  run('ALTER TABLE record_tags RENAME TO record_tags_old');
  run(`
    CREATE TABLE record_tags (
      record_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (record_id, tag_id)
    )
  `);

  if (columns.includes('tag_id')) {
    run(`
      INSERT OR IGNORE INTO record_tags (record_id, tag_id)
      SELECT record_id, tag_id
      FROM record_tags_old
      WHERE tag_id IS NOT NULL AND tag_id <> ''
    `);
  }

  if (columns.includes('tag_key')) {
    run(`
      INSERT OR IGNORE INTO record_tags (record_id, tag_id)
      SELECT record_tags_old.record_id, tags.tag_id
      FROM record_tags_old
      JOIN tags ON tags.tag_key = record_tags_old.tag_key
    `);
  }

  run('DROP TABLE record_tags_old');
}

function upsertTag(tagId, tagKey, name, category, parentTagKey, sortOrder) {
  const parent = parentTagKey ? get('SELECT tag_id, tag_key FROM tags WHERE tag_key = ?', [parentTagKey]) : null;
  run(
    `INSERT OR IGNORE INTO tags
      (tag_id, tag_key, name, category, parent_tag_id, parent_tag_key, description, color, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tagId, tagKey, name, category, parent?.tag_id || null, parent?.tag_key || null, '', '', sortOrder, 1],
  );
  run(
    `UPDATE tags
     SET tag_key = ?, name = ?, category = ?, parent_tag_id = ?, parent_tag_key = ?, sort_order = ?, is_active = 1
     WHERE tag_id = ?`,
    [tagKey, name, category, parent?.tag_id || null, parent?.tag_key || null, sortOrder, tagId],
  );
}

function seed() {
  const defaultTags = [
    ['tag_work', 'work', '工作', 'activity_type', null, 10],
    ['tag_study', 'study', '学习', 'activity_type', null, 20],
    ['tag_meeting', 'meeting', '沟通', 'activity_type', null, 30],
    ['tag_rest', 'rest', '休息', 'activity_type', null, 40],
    ['tag_exercise', 'exercise', '运动', 'activity_type', null, 50],
    ['tag_hobby', 'hobby', '爱好', 'activity_type', null, 60],
    ['tag_admin', 'admin', '事务', 'activity_type', null, 70],
    ['tag_writing', 'writing', '写作', 'activity_type', 'work', 11],
    ['tag_code', 'code', '代码', 'activity_type', 'work', 12],
    ['tag_design', 'design', '设计', 'activity_type', 'work', 13],
    ['tag_docs', 'docs', '文档', 'activity_type', 'work', 14],
    ['tag_research', 'research', '调研', 'activity_type', 'work', 15],
    ['tag_debug', 'debug', 'Debug', 'activity_type', 'work', 16],
    ['tag_review', 'review', '复盘', 'activity_type', 'work', 17],
    ['tag_project_progress', 'project_progress', '项目推进', 'activity_type', 'work', 18],
    ['tag_reading', 'reading', '看书', 'activity_type', 'study', 21],
    ['tag_papers', 'papers', '论文', 'activity_type', 'study', 22],
    ['tag_courses', 'courses', '课程', 'activity_type', 'study', 23],
    ['tag_tech_learning', 'tech_learning', '技术学习', 'activity_type', 'study', 24],
    ['tag_english', 'english', '英语', 'activity_type', 'study', 25],
    ['tag_notes', 'notes', '笔记', 'activity_type', 'study', 26],
    ['tag_meeting_session', 'meeting_session', '会议', 'activity_type', 'meeting', 31],
    ['tag_ask_help', 'ask_help', '请教', 'activity_type', 'meeting', 32],
    ['tag_reporting', 'reporting', '汇报', 'activity_type', 'meeting', 33],
    ['tag_collaboration', 'collaboration', '协作讨论', 'activity_type', 'meeting', 34],
    ['tag_client_communication', 'client_communication', '客户沟通', 'activity_type', 'meeting', 35],
    ['tag_personal_communication', 'personal_communication', '私人沟通', 'activity_type', 'meeting', 36],
    ['tag_sleep', 'sleep', '睡觉', 'activity_type', 'rest', 41],
    ['tag_meals', 'meals', '吃饭', 'activity_type', 'rest', 42],
    ['tag_walk', 'walk', '散步', 'activity_type', 'rest', 43],
    ['tag_downtime', 'downtime', '放空', 'activity_type', 'rest', 44],
    ['tag_videos', 'videos', '看视频', 'activity_type', 'rest', 45],
    ['tag_movie', 'movie', '看电影', 'activity_type', 'rest', 46],
    ['tag_travel', 'travel', '旅行', 'activity_type', 'rest', 47],
    ['tag_workout', 'workout', '健身', 'activity_type', 'exercise', 51],
    ['tag_running', 'running', '跑步', 'activity_type', 'exercise', 52],
    ['tag_swimming', 'swimming', '游泳', 'activity_type', 'exercise', 53],
    ['tag_stretching', 'stretching', '拉伸', 'activity_type', 'exercise', 54],
    ['tag_ball_sports', 'ball_sports', '球类', 'activity_type', 'exercise', 55],
    ['tag_dance', 'dance', '跳舞', 'activity_type', 'hobby', 61],
    ['tag_music', 'instruments', '乐器', 'activity_type', 'hobby', 62],
    ['tag_reimbursement', 'reimbursement', '报销', 'activity_type', 'admin', 71],
    ['tag_organize', 'organize', '整理', 'activity_type', 'admin', 72],
    ['tag_purchase', 'purchase', '采购', 'activity_type', 'admin', 73],
    ['tag_appointment', 'appointment', '预约', 'activity_type', 'admin', 74],
    ['tag_payment', 'payment', '缴费', 'activity_type', 'admin', 75],
    ['tag_admin_process', 'admin_process', '行政', 'activity_type', 'admin', 76],
    ['tag_commute', 'commute', '通勤', 'activity_type', 'admin', 77],
    ['tag_high', 'high_value', '高价值', 'value_signal', null, 10],
    ['tag_maintenance', 'maintenance', '维护', 'value_signal', null, 20],
    ['tag_low_value', 'low_value', '低价值', 'value_signal', null, 30],
    ['tag_focused', 'focused', '专注', 'state_signal', null, 10],
    ['tag_tired', 'tired', '疲惫', 'state_signal', null, 20],
    ['tag_interrupted', 'interrupted', '被打断', 'state_signal', null, 30],
    ['tag_blocked', 'blocked', '卡住', 'state_signal', null, 40],
    ['tag_low', 'low_quality', '低质量', 'state_signal', null, 50],
    ['tag_health', 'health', '健康', 'life_area', null, 10],
    ['tag_growth', 'growth', '成长', 'life_area', null, 20],
    ['tag_relationship', 'relationship', '关系', 'life_area', null, 30],
    ['tag_finance', 'finance', '财务', 'life_area', null, 40],
    ['tag_life', 'life', '生活', 'life_area', null, 50],
  ];

  if (get('SELECT COUNT(*) AS count FROM tags').count === 0) {
    defaultTags.forEach(([tagId, key, name, category, parentTagKey, sortOrder]) => {
      upsertTag(tagId, key, name, category, parentTagKey, sortOrder);
    });
  }
  syncOpenTagSet(defaultTags);
  normalizeTagHierarchy();

  if (get('SELECT COUNT(*) AS count FROM people').count === 0) {
    run('INSERT INTO people (person_id, display_name, role, relationship_type, note) VALUES (?, ?, ?, ?, ?)', [
      'person_you_zhengxin',
      '游正新',
      '老师',
      'mentor',
      '示例人物，可用多个称呼归一。',
    ]);
    [
      ['alias_you_1', '游正新', 'real_name', 1],
      ['alias_you_2', '游老师', 'title', 0],
      ['alias_you_3', '正新', 'short_name', 0],
    ].forEach(([aliasId, alias, type, primary]) => {
      run('INSERT INTO person_aliases (alias_id, person_id, alias_text, alias_type, is_primary, confidence) VALUES (?, ?, ?, ?, ?, ?)', [
        aliasId,
        'person_you_zhengxin',
        alias,
        type,
        primary,
        1,
      ]);
    });
  }

  if (get('SELECT COUNT(*) AS count FROM goals').count === 0) {
    const month = periodBounds('month', new Date());
    const year = periodBounds('year', new Date());
    run(
      'INSERT INTO goals (goal_id, title, level, period_start, period_end, status, priority, success_criteria, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['goal_year_001', '把个人数字化系统跑起来', 'year', year.start, year.end, 'active', 1, '持续记录、复盘，并让 AI 能主动提醒下一步。', now()],
    );
    run(
      'INSERT INTO goals (goal_id, title, level, period_start, period_end, status, priority, success_criteria, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['goal_month_001', '稳定记录 20 天', 'month', month.start, month.end, 'active', 2, '每天至少有一条 timeline，周末生成周报。', now()],
    );
  }

  if (get('SELECT COUNT(*) AS count FROM tasks').count === 0) {
    [
      ['task_mock_1', 'T-20260528-001', '完成任务模块的交互', '新增任务页、状态切换和目标关联。', 'doing', 'goal_year_001', 1, addHours(8), ['work', 'code']],
      ['task_mock_2', 'T-20260528-002', '同步 schema 文档', '把任务字段、状态历史和关系更新到文档里。', 'todo', 'goal_month_001', 2, addHours(30), ['writing', 'high_value']],
      ['task_mock_3', 'T-20260528-003', '确认提醒规则', '决定哪些任务状态需要 AI 主动提醒。', 'blocked', 'goal_year_001', 3, addHours(54), ['meeting', 'high_value']],
      ['task_mock_4', 'T-20260528-004', '整理 24h timeline 视图', '已完成首版日视图排版。', 'done', 'goal_month_001', 2, addHours(-6), ['work', 'code']],
    ].forEach(([taskId, taskCode, title, description, status, goalId, priority, dueAt, tagKeys]) => {
      run(
        `INSERT INTO tasks
          (task_id, task_code, title, description, status, goal_id, priority, due_at, created_at, status_updated_at, completed_at, outcome)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          taskCode,
          title,
          description,
          status,
          goalId,
          priority,
          dueAt,
          now(),
          now(),
          status === 'done' ? now() : null,
          status === 'done' ? '首版可用。' : '',
        ],
      );
      tagKeys.forEach((tagKey) => attachTag(taskId, tagKey));
      recordTaskEvent(taskId, 'created', null, status, '初始化示例任务');
    });
  }

  if (get('SELECT task_id FROM tasks WHERE task_id = ?', ['task_mock_1'])) {
    run('UPDATE timeline_entries SET task_id = ? WHERE timeline_id = ? AND task_id IS NULL', ['task_mock_1', 'timeline_mock_4']);
  }

  if (get('SELECT COUNT(*) AS count FROM reminders').count === 0) {
    run(
      'INSERT INTO reminders (reminder_id, title, reminder_type, status, priority, reason, suggested_action, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['reminder_001', '今晚生成日报', 'review', 'pending', 2, '日报可以把今天的 timeline 汇总成事实回顾。', '生成今日简报', now()],
    );
  }

  if (get('SELECT COUNT(*) AS count FROM habits').count === 0) {
    [
      ['habit_mock_1', '每天记录一句 timeline', 'daily', 1, 1, '保持低负担，只要一句话。', ['writing', 'review']],
      ['habit_mock_2', '每周三次运动', 'weekly', 3, 2, '运动可以是健身、散步或跳舞。', ['exercise', 'high_value']],
      ['habit_mock_3', '每晚 5 分钟复盘', 'daily', 1, 3, '睡前生成或阅读日报。', ['high_value']],
    ].forEach(([habitIdValue, title, cadence, targetCount, priority, note, tagKeys]) => {
      run(
        'INSERT INTO habits (habit_id, title, cadence, target_count, status, priority, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [habitIdValue, title, cadence, targetCount, 'active', priority, note, now()],
      );
      tagKeys.forEach((tagKey) => attachTag(habitIdValue, tagKey));
    });

    run(
      'INSERT INTO habit_logs (habit_id, local_date, status, quality, note, logged_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['habit_mock_1', today(), 'done', 4, '今天已经记录了系统架构 timeline。', now()],
    );
  }

  if (get('SELECT COUNT(*) AS count FROM schedule_events').count === 0) {
    [
      ['schedule_mock_1', '和游老师复盘目标系统', addHours(26), addHours(27), 'planned', '线上', '确认目标 tag 和提醒规则。', ['meeting', 'high_value']],
      ['schedule_mock_2', '周末跳舞', addHours(72), addHours(74), 'planned', '练习室', '作为爱好和运动习惯的一次记录。', ['dance', 'rest']],
      ['schedule_mock_3', '生成本周周报', addHours(96), null, 'planned', '', '看目标、timeline、习惯是否对齐。', ['high_value']],
    ].forEach(([eventId, title, startAt, endAt, status, location, note, tagKeys]) => {
      run(
        'INSERT INTO schedule_events (event_id, title, start_at, end_at, status, location, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [eventId, title, startAt, endAt, status, location, note, now()],
      );
      tagKeys.forEach((tagKey) => attachTag(eventId, tagKey));
    });
  }

  seedMockRecords();

  if (get('SELECT COUNT(*) AS count FROM reports').count === 0) {
    generateReport('day');
  }
}

function syncOpenTagSet(defaultTags) {
  defaultTags.forEach(([tagId, key, name, category, parentTagKey, sortOrder]) => {
    upsertTag(tagId, key, name, category, parentTagKey, sortOrder);
  });

  ['tag_deep', 'tag_golf'].forEach((tagId) => {
    run('UPDATE tags SET is_active = 0 WHERE tag_id = ?', [tagId]);
  });
}

function createTimeline(title, inputId, tagKeys = ['work'], startAt = now(), endAt = null, isEstimated = 0) {
  const timelineId = id('timeline');
  run(
    `INSERT INTO timeline_entries
      (timeline_id, source_input_id, start_at, end_at, local_date, title, description, kind, quality, is_estimated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [timelineId, inputId, startAt, endAt, today(startAt), cleanTitle(title), title, title.includes('休息') ? 'activity_block' : 'activity_block', null, isEstimated],
  );
  tagKeys.forEach((tagKey) => attachTag(timelineId, tagKey));
  return timelineId;
}

function createTimelineFromSchedule({ title, startAt, endAt, location = '', note = '', taskId = null, tagRefs = [] }) {
  if (!endAt || hasTimelineOverlap(startAt, endAt)) return null;

  const timelineId = id('timeline');
  run(
    `INSERT INTO timeline_entries
      (timeline_id, source_input_id, start_at, end_at, local_date, title, description, kind, task_id, quality, is_estimated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      timelineId,
      null,
      startAt,
      endAt,
      today(startAt),
      title,
      [location, note].filter(Boolean).join(' · ') || title,
      'schedule_event',
      taskId,
      null,
      0,
    ],
  );
  replaceTags(timelineId, tagRefs);
  return timelineId;
}

function normalizeScheduleEnd(startAt, endAt) {
  if (!endAt) return null;
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return end > start ? endAt : null;
}

function hasTimelineOverlap(startAt, endAt) {
  return get(
    `SELECT COUNT(*) AS count
     FROM timeline_entries
     WHERE start_at < ?
       AND (end_at IS NULL OR end_at > ?)`,
    [endAt, startAt],
  ).count > 0;
}

function closeOpenTimeline(note, inputId) {
  const open = get('SELECT * FROM timeline_entries WHERE end_at IS NULL ORDER BY start_at DESC LIMIT 1');
  if (!open) {
    createTimeline(`完成：${cleanTitle(note)}`, inputId, ['work'], now(), now(), 1);
    return;
  }
  run('UPDATE timeline_entries SET end_at = ?, description = ? WHERE timeline_id = ?', [
    now(),
    `${open.description || open.title}。${note}`,
    open.timeline_id,
  ]);
}

function createMoment(text, inputId) {
  run(
    `INSERT INTO moments
      (moment_id, source_input_id, happened_at, local_date, title, story, importance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id('moment'), inputId, now(), today(), cleanTitle(text), text, 4],
  );
}

function detectAction(text) {
  const historic = text.match(/(\d{1,2})\s*[点:]\s*(?:到|-)\s*(\d{1,2})\s*[点:]?\s*(.+)/);
  if (historic) {
    const startAt = atHour(Number(historic[1]));
    const endAt = atHour(Number(historic[2]));
    return { type: 'historic', title: historic[3], startAt, endAt };
  }

  if (/休息|吃饭|睡觉|路上/.test(text)) return { type: 'rest', title: cleanTitle(text) };
  if (/做完|写完|结束|先到这里|完成/.test(text)) return { type: 'finish', title: cleanTitle(text) };
  if (/切到|接下来|换成/.test(text)) return { type: 'switch', title: cleanTitle(text) };

  const tags = [];
  if (/音乐|乐器|吉他|钢琴|唱/.test(text)) tags.push('instruments');
  if (/跳舞|舞蹈/.test(text)) tags.push('dance');
  if (/高尔夫|golf/i.test(text)) tags.push('hobby');
  if (/写|文档|schema|方案/.test(text)) tags.push('writing', 'docs');
  if (!tags.length) tags.push('work');

  return { type: 'start', title: cleanTitle(text), tags };
}

function cleanTitle(text) {
  return text
    .replace(/我开始|开始|我先|先|现在|接下来|切到|换成|做完了|写完了|做完|写完|休息一下|记成高光|高光/g, '')
    .replace(/[。,.，]/g, ' ')
    .trim()
    .slice(0, 42) || '未命名记录';
}

function attachTag(recordId, tagRef) {
  const tag = tagByRef(tagRef);
  if (!tag) return;
  run('INSERT OR IGNORE INTO record_tags (record_id, tag_id) VALUES (?, ?)', [recordId, tag.tag_id]);
}

function replaceTags(recordId, tagRefs) {
  run('DELETE FROM record_tags WHERE record_id = ?', [recordId]);
  tagRefs.forEach((tagRef) => attachTag(recordId, tagRef));
}

function normalizeTaskStatus(status) {
  return ['todo', 'doing', 'blocked', 'done', 'abandoned', 'deleted'].includes(status) ? status : 'todo';
}

function recordTaskEvent(taskId, eventType, fromStatus, toStatus, note = '', inputId = null) {
  run(
    `INSERT INTO task_events
      (event_id, task_id, event_type, from_status, to_status, happened_at, note, input_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id('task_event'), taskId, eventType, fromStatus, toStatus, now(), note, inputId],
  );
}

function nextTaskCode() {
  const dateKey = today().replaceAll('-', '');
  const prefix = `T-${dateKey}`;
  const row = get('SELECT COUNT(*) AS count FROM tasks WHERE task_code LIKE ?', [`${prefix}-%`]);
  return `${prefix}-${String(row.count + 1).padStart(3, '0')}`;
}

function normalizeTagKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/[\s-]+/g, '_')
    .slice(0, 40);
}

function normalizeTagCategory(value) {
  const category = String(value || '').trim();
  if (['hobby', 'hobbies', 'interest', 'interests', '爱好', '兴趣爱好'].includes(category)) return 'activity_type';
  if (['activity_type', 'work_mode', 'value_signal', 'state_signal', 'life_area'].includes(category)) return category;
  return 'activity_type';
}

function tagByRef(tagRef) {
  if (!tagRef) return null;
  return get('SELECT * FROM tags WHERE tag_id = ? OR tag_key = ?', [tagRef, tagRef]) || null;
}

function parentRefFromPayload(payload, fallback = null) {
  if (Object.hasOwn(payload, 'parentTagId')) return payload.parentTagId;
  if (Object.hasOwn(payload, 'parent_tag_id')) return payload.parent_tag_id;
  if (Object.hasOwn(payload, 'parentTagKey')) return payload.parentTagKey;
  if (Object.hasOwn(payload, 'parent_tag_key')) return payload.parent_tag_key;
  return fallback;
}

function normalizeParentTag(value, tagId = '') {
  const parent = tagByRef(value);
  if (!parent || parent.tag_id === tagId || parent.parent_tag_id) return null;
  return parent;
}

function hasChildTags(tagId) {
  return get('SELECT COUNT(*) AS count FROM tags WHERE parent_tag_id = ?', [tagId]).count > 0;
}

function normalizeTagHierarchy() {
  run(`
    UPDATE tags
    SET category = 'activity_type',
        parent_tag_key = CASE
          WHEN tag_key = 'hobby' THEN NULL
          WHEN parent_tag_key IS NULL THEN 'hobby'
          ELSE parent_tag_key
        END
    WHERE category IN ('hobby', 'hobbies', 'interest', 'interests', '爱好', '兴趣爱好')
  `);
  run("UPDATE tags SET category = 'activity_type', parent_tag_key = NULL WHERE tag_key = 'hobby'");
  run("UPDATE tags SET category = 'activity_type', parent_tag_key = 'work' WHERE tag_key = 'writing' AND parent_tag_key IS NULL");
  run("UPDATE tags SET parent_tag_key = 'work' WHERE category = 'work_mode' AND parent_tag_key IS NULL");
  run("UPDATE tags SET category = 'activity_type', parent_tag_key = 'hobby' WHERE tag_key IN ('music', 'dance', 'golf') AND parent_tag_key IS NULL");
  syncParentTagIds();
}

function syncParentTagIds() {
  run(`
    UPDATE tags
    SET parent_tag_id = (
      SELECT parent.tag_id
      FROM tags parent
      WHERE parent.tag_key = tags.parent_tag_key
    )
    WHERE parent_tag_key IS NOT NULL
  `);
  run(`
    UPDATE tags
    SET parent_tag_key = (
      SELECT parent.tag_key
      FROM tags parent
      WHERE parent.tag_id = tags.parent_tag_id
    )
    WHERE parent_tag_id IS NOT NULL
  `);
  run("UPDATE tags SET parent_tag_id = NULL, parent_tag_key = NULL WHERE parent_tag_id = tag_id OR parent_tag_id = ''");
}

function tagNamesFor(recordId) {
  return all(
    `SELECT tags.name FROM record_tags
     JOIN tags ON tags.tag_id = record_tags.tag_id
     WHERE record_tags.record_id = ?
     ORDER BY
       tags.category,
       CASE
         WHEN tags.parent_tag_id IS NULL THEN tags.sort_order
         ELSE COALESCE((SELECT parent.sort_order FROM tags parent WHERE parent.tag_id = tags.parent_tag_id), tags.sort_order)
       END,
       tags.parent_tag_id IS NOT NULL,
       tags.sort_order,
       tags.name`,
    [recordId],
  ).map((row) => row.name);
}

function tagIdsFor(recordId) {
  return all('SELECT tag_id FROM record_tags WHERE record_id = ? ORDER BY tag_id', [recordId]).map((row) => row.tag_id);
}

function tagKeysFor(recordId) {
  return all(
    `SELECT tags.tag_key
     FROM record_tags
     JOIN tags ON tags.tag_id = record_tags.tag_id
     WHERE record_tags.record_id = ?
     ORDER BY tags.tag_key`,
    [recordId],
  ).map((row) => row.tag_key);
}

function goalProgress(goal) {
  const taggedTimeline = all(
    `SELECT COUNT(*) AS count
     FROM timeline_entries
     JOIN record_tags timeline_tags ON timeline_tags.record_id = timeline_entries.timeline_id
     JOIN record_tags goal_tags ON goal_tags.record_id = ?
     WHERE timeline_tags.tag_id = goal_tags.tag_id`,
    [goal.goal_id],
  )[0]?.count || 0;

  return Math.min(100, Math.max(8, taggedTimeline * 18 + (goal.level === 'year' ? 24 : 12)));
}

function seedMockRecords() {
  attachTag('goal_year_001', 'high_value');
  attachTag('goal_year_001', 'code');
  attachTag('goal_month_001', 'writing');
  attachTag('goal_month_001', 'review');

  if (!get('SELECT goal_id FROM goals WHERE goal_id = ?', ['goal_health_001'])) {
    const month = periodBounds('month', new Date());
    run(
      'INSERT INTO goals (goal_id, title, level, period_start, period_end, status, priority, success_criteria, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['goal_health_001', '把身体状态拉回稳定区间', 'month', month.start, month.end, 'active', 3, '每周 3 次运动，至少一次户外活动。', now()],
    );
    attachTag('goal_health_001', 'exercise');
    attachTag('goal_health_001', 'high_value');
  }

  if (get('SELECT COUNT(*) AS count FROM timeline_entries').count > 0) return;

  const inputId = 'input_mock_today';
  run(
    'INSERT OR IGNORE INTO source_inputs (input_id, happened_at, channel, raw_text, author) VALUES (?, ?, ?, ?, ?)',
    [inputId, atHour(9), 'chat', '今天上午先写个人数字化系统的信息架构，然后和游老师聊了一下目标。下午跳舞放松。', 'user'],
  );

  const samples = [
    ['timeline_mock_1', atHour(9), atHour(10.5), '梳理个人数字化系统架构', '确定目标、timeline、报告和提醒的关系。', 4, ['writing', 'docs', 'high_value']],
    ['timeline_mock_2', atHour(10.75), atHour(11.5), '和游老师讨论目标系统', '确认目标可以有 tag，人物用 alias 归一。', 5, ['meeting', 'high_value']],
    ['timeline_mock_3', atHour(14), atHour(15.25), '跳舞', '休息和身体活动，不挂任务，只作为 hobby timeline。', 4, ['dance', 'rest']],
    ['timeline_mock_4', atHour(16), null, '改 React 工作台交互', '减少首页元素，做目标和 timeline 编辑入口。', null, ['work', 'code']],
  ];

  samples.forEach(([timelineId, startAt, endAt, title, description, quality, tagKeys]) => {
    run(
      `INSERT INTO timeline_entries
        (timeline_id, source_input_id, start_at, end_at, local_date, title, description, kind, task_id, quality, is_estimated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [timelineId, inputId, startAt, endAt, today(startAt), title, description, 'activity_block', timelineId === 'timeline_mock_4' ? 'task_mock_1' : null, quality, 0],
    );
    tagKeys.forEach((tagKey) => attachTag(timelineId, tagKey));
  });

  run(
    `INSERT OR IGNORE INTO moments
      (moment_id, source_input_id, happened_at, local_date, title, story, importance, timeline_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['moment_mock_1', inputId, atHour(11.5), today(), '确认系统主线', '目标决定方向，timeline 证明真实投入。', 5, 'timeline_mock_2'],
  );
}

function suggestion(timeline, goals) {
  if (timeline.some((item) => !item.end_at)) return '当前 timeline 正在记录，结束或切换时直接在聊天框说明即可。';
  if (!goals.length) return '先写一个月度目标，再让 timeline 去证明它有没有推进。';
  return '从一句自然语言开始：我开始做 xxx。';
}

function metrics(timeline) {
  let trackedMs = 0;
  let qualityTotal = 0;
  let qualityCount = 0;

  for (const item of timeline) {
    if (item.end_at) trackedMs += new Date(item.end_at) - new Date(item.start_at);
    if (item.quality) {
      qualityTotal += item.quality;
      qualityCount += 1;
    }
  }

  return {
    trackedHours: Math.max(0, trackedMs / 3600000).toFixed(1),
    averageQuality: qualityCount ? (qualityTotal / qualityCount).toFixed(1) : '',
    qualityNote: qualityCount ? '来自 timeline 和 daily state 的单一质量指标。' : '还没有质量评分，保持低负担即可。',
    completedTasks: get('SELECT COUNT(*) AS count FROM tasks WHERE status = ?', ['done']).count,
    activeTasks: get('SELECT COUNT(*) AS count FROM tasks WHERE status IN (?, ?)', ['todo', 'doing']).count,
    blockedTasks: get('SELECT COUNT(*) AS count FROM tasks WHERE status = ?', ['blocked']).count,
    moments: get('SELECT COUNT(*) AS count FROM moments').count,
    habitsDoneToday: get('SELECT COUNT(*) AS count FROM habit_logs WHERE local_date = ? AND status = ?', [today(), 'done']).count,
    upcomingEvents: get('SELECT COUNT(*) AS count FROM schedule_events WHERE start_at >= ? AND status = ?', [now(), 'planned']).count,
  };
}

function periodBounds(level, date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (level === 'year') return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (level === 'week') {
    const start = new Date(date);
    start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: today(start), end: today(end) };
  }

  return {
    start: today(new Date(year, month, 1)),
    end: today(new Date(year, month + 1, 0)),
  };
}

function atHour(hour) {
  const date = new Date();
  const wholeHour = Math.floor(hour);
  const minutes = Math.round((hour - wholeHour) * 60);
  date.setHours(wholeHour, minutes, 0, 0);
  return date.toISOString();
}

function addHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return today(date);
}

function today(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}
