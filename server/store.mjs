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
  archiveExpiredGoals();

  const timeline = all(
    `SELECT *
     FROM (
       SELECT timeline_entries.*, tasks.title AS task_title, tasks.task_code
       FROM timeline_entries
       LEFT JOIN tasks ON tasks.task_id = timeline_entries.task_id
       ORDER BY timeline_entries.start_at DESC
       LIMIT 200
     )
     ORDER BY start_at ASC`,
  ).map((entry) => ({
    ...entry,
    tags: tagNamesFor(entry.timeline_id),
    tagIds: tagIdsFor(entry.timeline_id),
    tagKeys: tagKeysFor(entry.timeline_id),
  }));

  const goals = all(`
    SELECT *
    FROM goals
    WHERE status <> 'deleted'
    ORDER BY period_start DESC, priority ASC, created_at DESC
    LIMIT 200
  `).map((goal) => ({
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
       CASE WHEN tasks.planned_date IS NULL THEN 1 ELSE 0 END,
       tasks.planned_date ASC,
       tasks.planned_order ASC,
       tasks.priority ASC,
       COALESCE(tasks.due_at, tasks.created_at) ASC
     LIMIT 200`,
  ).map((task) => ({
    ...task,
    plannedDates: all('SELECT local_date FROM task_day_plans WHERE task_id = ? ORDER BY local_date', [task.task_id]).map((row) => row.local_date),
    tags: tagNamesFor(task.task_id),
    tagIds: tagIdsFor(task.task_id),
    tagKeys: tagKeysFor(task.task_id),
  }));
  const reports = all('SELECT * FROM reports ORDER BY generated_at DESC LIMIT 6');
  const reviews = all('SELECT * FROM reviews ORDER BY is_pinned DESC, created_at DESC LIMIT 80').map((review) => ({
    ...review,
    tags: tagNamesFor(review.review_id),
    tagIds: tagIdsFor(review.review_id),
    tagKeys: tagKeysFor(review.review_id),
  }));
  const moments = all(
    `SELECT moments.*, timeline_entries.title AS timeline_title
     FROM moments
     LEFT JOIN timeline_entries ON timeline_entries.timeline_id = moments.timeline_id
     ORDER BY moments.happened_at DESC
     LIMIT 300`,
  ).map((moment) => ({
    ...moment,
    images: all('SELECT moment_image_id, image_url, sort_order FROM moment_images WHERE moment_id = ? ORDER BY sort_order, created_at', [moment.moment_id]),
    tags: tagNamesFor(moment.moment_id),
    tagIds: tagIdsFor(moment.moment_id),
    tagKeys: tagKeysFor(moment.moment_id),
  }));
  const reminders = all('SELECT * FROM reminders WHERE status = ? ORDER BY priority ASC, created_at DESC LIMIT 4', ['pending']);
  const habits = all(`
    SELECT *
    FROM habits
    WHERE status <> 'deleted'
    ORDER BY
      CASE status WHEN 'active' THEN 1 WHEN 'archived' THEN 2 ELSE 3 END,
      priority ASC,
      created_at ASC
  `).map((habit) => ({
    ...habit,
    tags: tagNamesFor(habit.habit_id),
    tagIds: tagIdsFor(habit.habit_id),
    tagKeys: tagKeysFor(habit.habit_id),
    todayLog: get('SELECT * FROM habit_logs WHERE habit_id = ? AND local_date = ?', [habit.habit_id, today()]) || null,
  }));
  const habitLogs = all(
    `SELECT habit_logs.*, habits.title, habits.cadence, habits.target_count
     FROM habit_logs
     JOIN habits ON habits.habit_id = habit_logs.habit_id
     WHERE habits.status <> ?
     ORDER BY habit_logs.local_date ASC, habits.priority ASC`,
    ['deleted'],
  );
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
    relatedRecords: personRelatedRecords(person.person_id),
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
    reviews,
    moments,
    reminders,
    habits,
    habitLogs,
    schedule,
    tags,
    allTags,
    people,
    metrics: metrics(timeline),
  };
}

export function createSourceInput(payload = {}) {
  const inputId = createSourceInputRecord(payload);
  return withCreated({ inputId });
}

export function createTimelineEntry(payload = {}) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const sourceInputId = payload.sourceInputId || payload.source_input_id || (
    payload.rawText || payload.raw_text
      ? createSourceInputRecord({
        rawText: payload.rawText || payload.raw_text,
        happenedAt: payload.happenedAt || payload.happened_at || payload.startAt || payload.start_at,
        channel: payload.channel || 'openclaw',
        author: payload.author || 'user',
      })
      : null
  );
  const startAt = payload.startAt || payload.start_at || now();
  const endAt = payload.endAt || payload.end_at || null;
  const timelineId = id('timeline');

  run(
    `INSERT INTO timeline_entries
      (timeline_id, source_input_id, start_at, end_at, local_date, title, description, kind, project_id, task_id, quality, is_estimated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      timelineId,
      sourceInputId,
      startAt,
      endAt,
      today(startAt),
      title,
      payload.description || '',
      normalizeTimelineKind(payload.kind || 'activity_block'),
      payload.projectId || payload.project_id || null,
      payload.taskId || payload.task_id || null,
      payload.quality === '' || payload.quality == null ? null : Number(payload.quality),
      payload.isEstimated || payload.is_estimated ? 1 : 0,
    ],
  );
  replaceTags(timelineId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  replacePersonLinks('timeline', timelineId, personRefsFromPayload(payload));

  return withCreated({ timelineId, sourceInputId });
}

export function createMoment(payload = {}) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const happenedAt = payload.happenedAt || payload.happened_at || now();
  const sourceInputId = payload.sourceInputId || payload.source_input_id || (
    payload.rawText || payload.raw_text
      ? createSourceInputRecord({
        rawText: payload.rawText || payload.raw_text,
        happenedAt,
        channel: payload.channel || 'openclaw',
        author: payload.author || 'user',
      })
      : null
  );
  const momentId = id('moment');
  const imageUrls = normalizeMomentImageUrls(
    payload.imageUrls ?? payload.image_urls ?? [payload.imageUrl || payload.image_url || ''],
  );

  run(
    `INSERT INTO moments
      (moment_id, source_input_id, happened_at, local_date, title, story, importance, image_url, project_id, task_id, timeline_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      momentId,
      sourceInputId,
      happenedAt,
      today(happenedAt),
      title,
      payload.story || payload.description || '',
      normalizeImportance(payload.importance),
      imageUrls[0] || '',
      payload.projectId || payload.project_id || null,
      payload.taskId || payload.task_id || null,
      payload.timelineId || payload.timeline_id || null,
    ],
  );
  replaceMomentImages(momentId, imageUrls);
  replaceTags(momentId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  replacePersonLinks('moment', momentId, personRefsFromPayload(payload));

  return withCreated({ momentId, sourceInputId });
}

export function updateMoment(momentId, payload = {}) {
  const existing = get('SELECT * FROM moments WHERE moment_id = ?', [momentId]);
  if (!existing) return dashboard();
  const happenedAt = payload.happenedAt || payload.happened_at || existing.happened_at;
  const existingImageUrls = momentImageUrlsFor(momentId);
  const hasImageUrls = Array.isArray(payload.imageUrls) || Array.isArray(payload.image_urls);
  const hasLegacyImageUrl = Object.hasOwn(payload, 'imageUrl') || Object.hasOwn(payload, 'image_url');
  const imageUrls = hasImageUrls
    ? normalizeMomentImageUrls(payload.imageUrls ?? payload.image_urls)
    : hasLegacyImageUrl
      ? normalizeMomentImageUrls([payload.imageUrl ?? payload.image_url ?? ''])
      : existingImageUrls;
  const imageUrl = imageUrls[0] || '';

  run(
    `UPDATE moments
     SET source_input_id = ?, happened_at = ?, local_date = ?, title = ?, story = ?, importance = ?,
         image_url = ?, project_id = ?, task_id = ?, timeline_id = ?
     WHERE moment_id = ?`,
    [
      payload.sourceInputId ?? payload.source_input_id ?? existing.source_input_id ?? null,
      happenedAt,
      today(happenedAt),
      String(payload.title || existing.title).trim(),
      payload.story ?? payload.description ?? existing.story ?? '',
      normalizeImportance(payload.importance ?? existing.importance),
      imageUrl,
      payload.projectId ?? payload.project_id ?? existing.project_id ?? null,
      payload.taskId ?? payload.task_id ?? existing.task_id ?? null,
      payload.timelineId ?? payload.timeline_id ?? existing.timeline_id ?? null,
      momentId,
    ],
  );
  if (hasImageUrls || hasLegacyImageUrl) replaceMomentImages(momentId, imageUrls);
  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(momentId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('moment', momentId, personRefsFromPayload(payload));
  }
  const result = dashboard();
  const removedImageUrls = existingImageUrls.filter((url) => !imageUrls.includes(url));
  return removedImageUrls.length
    ? { ...result, removedImageUrls }
    : result;
}

export function deleteMoment(momentId) {
  const existing = get('SELECT moment_id FROM moments WHERE moment_id = ?', [momentId]);
  if (!existing) return dashboard();
  const deletedImageUrls = momentImageUrlsFor(momentId);
  run('DELETE FROM record_tags WHERE record_id = ?', [momentId]);
  run("DELETE FROM person_record_links WHERE record_type = 'moment' AND record_id = ?", [momentId]);
  run('DELETE FROM moment_images WHERE moment_id = ?', [momentId]);
  run('DELETE FROM moments WHERE moment_id = ?', [momentId]);
  return {
    ...dashboard(),
    deleted: { momentId, imageUrls: deletedImageUrls },
  };
}

function momentImageUrlsFor(momentId) {
  return all(
    'SELECT image_url FROM moment_images WHERE moment_id = ? ORDER BY sort_order, created_at',
    [momentId],
  ).map((row) => row.image_url);
}

function normalizeMomentImageUrls(imageUrls) {
  return [...new Set((Array.isArray(imageUrls) ? imageUrls : [])
    .map((url) => String(url || '').trim())
    .filter(Boolean))].slice(0, 20);
}

function replaceMomentImages(momentId, imageUrls) {
  run('DELETE FROM moment_images WHERE moment_id = ?', [momentId]);
  imageUrls.forEach((imageUrl, index) => {
    run(
      `INSERT INTO moment_images (moment_image_id, moment_id, image_url, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id('moment_image'), momentId, imageUrl, index, now()],
    );
  });
}

export function createPerson(payload = {}) {
  const displayName = String(payload.displayName || payload.display_name || '').trim();
  if (!displayName) return dashboard();
  const personId = id('person');

  run(
    'INSERT INTO people (person_id, display_name, role, relationship_type, note, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [
      personId,
      displayName,
      payload.role || '',
      payload.relationshipType || payload.relationship_type || '',
      payload.note || '',
      payload.isActive === 0 || payload.is_active === 0 ? 0 : 1,
    ],
  );
  replacePersonAliases(personId, payload.aliases || [displayName]);
  return withCreated({ personId });
}

export function updatePerson(personId, payload = {}) {
  const existing = get('SELECT * FROM people WHERE person_id = ?', [personId]);
  if (!existing) return dashboard();

  run(
    'UPDATE people SET display_name = ?, role = ?, relationship_type = ?, note = ?, is_active = ? WHERE person_id = ?',
    [
      String(payload.displayName || payload.display_name || existing.display_name).trim(),
      payload.role ?? existing.role ?? '',
      payload.relationshipType ?? payload.relationship_type ?? existing.relationship_type ?? '',
      payload.note ?? existing.note ?? '',
      payload.isActive ?? payload.is_active ?? existing.is_active ?? 1,
      personId,
    ],
  );
  if (Array.isArray(payload.aliases)) {
    replacePersonAliases(personId, payload.aliases);
  }
  return dashboard();
}

export function ingestOpenClaw(payload = {}) {
  const operations = Array.isArray(payload.operations) ? payload.operations : [];
  const refs = new Map();
  const results = [];
  let sourceInputId = payload.sourceInputId || payload.source_input_id || null;

  db.exec('BEGIN');
  try {
    if (!sourceInputId && (payload.rawText || payload.raw_text || payload.text)) {
      sourceInputId = createSourceInputRecord({
        rawText: payload.rawText || payload.raw_text || payload.text,
        happenedAt: payload.happenedAt || payload.happened_at,
        channel: payload.channel || 'openclaw',
        author: payload.author || 'user',
      });
    }

    if (sourceInputId) {
      refs.set('source', sourceInputId);
      refs.set('$source', sourceInputId);
    }

    operations.forEach((operation, index) => {
      const result = applyOpenClawOperation(operation, refs, sourceInputId);
      results.push({ index, ...result });
      if (operation.ref && result.created) {
        addCreatedRefs(operation.ref, result.created, refs);
      }
    });

    db.exec('COMMIT');
    return {
      ...dashboard(),
      ingest: {
        sourceInputId,
        results,
      },
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createGoal(payload) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const level = normalizeGoalLevel(payload.level);
  const today = new Date();
  const period = periodBounds(level, today);
  const goalId = id('goal');

  run(
    `INSERT INTO goals
      (goal_id, title, level, period_start, period_end, status, priority, success_criteria, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goalId,
      title,
      level,
      period.start,
      period.end,
      normalizeGoalStatus(payload.status || 'active'),
      Number(payload.priority ?? 3),
      payload.successCriteria || payload.success_criteria || '',
      now(),
    ],
  );

  replaceTags(goalId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  replacePersonLinks('goal', goalId, personRefsFromPayload(payload));

  return withCreated({ goalId });
}

export function updateGoal(goalId, payload) {
  const existing = get('SELECT * FROM goals WHERE goal_id = ?', [goalId]);
  if (!existing) return dashboard();
  const level = normalizeGoalLevel(payload.level || existing.level);
  const status = normalizeGoalStatus(payload.status || existing.status);
  let period = level === existing.level
    ? { start: existing.period_start, end: existing.period_end }
    : periodBounds(level, new Date());
  if (status === 'active' && period.end < today()) {
    period = periodBounds(level, new Date());
  }

  run(
    `UPDATE goals
     SET title = ?, level = ?, period_start = ?, period_end = ?, status = ?, priority = ?, success_criteria = ?
     WHERE goal_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      level,
      period.start,
      period.end,
      status,
      Number(payload.priority ?? existing.priority),
      payload.successCriteria ?? payload.success_criteria ?? existing.success_criteria ?? '',
      goalId,
    ],
  );

  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(goalId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('goal', goalId, personRefsFromPayload(payload));
  }
  return dashboard();
}

export function updateTimeline(timelineId, payload) {
  const existing = get('SELECT * FROM timeline_entries WHERE timeline_id = ?', [timelineId]);
  if (!existing) return dashboard();
  const startAt = payload.startAt || payload.start_at || existing.start_at;
  const hasEndAt = Object.hasOwn(payload, 'endAt') || Object.hasOwn(payload, 'end_at');
  const endAt = hasEndAt ? (payload.endAt ?? payload.end_at ?? null) : existing.end_at;

  run(
    `UPDATE timeline_entries
     SET start_at = ?, end_at = ?, local_date = ?, title = ?, description = ?, quality = ?, kind = ?, task_id = ?
     WHERE timeline_id = ?`,
    [
      startAt,
      endAt,
      today(startAt),
      String(payload.title || existing.title).trim(),
      payload.description ?? existing.description ?? '',
      payload.quality === '' || payload.quality == null ? null : Number(payload.quality),
      normalizeTimelineKind(payload.kind || existing.kind),
      payload.taskId ?? payload.task_id ?? existing.task_id ?? null,
      timelineId,
    ],
  );

  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(timelineId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('timeline', timelineId, personRefsFromPayload(payload));
  }
  return dashboard();
}

export function createTask(payload) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();

  const taskId = id('task');
  const taskCode = nextTaskCode();
  const status = normalizeTaskStatus(payload.status || 'todo');
  const timestamp = now();
  const plannedDate = payload.plannedDate || payload.planned_date || null;
  run(
    `INSERT INTO tasks
      (task_id, task_code, title, description, status, goal_id, project_id, parent_task_id, priority,
       planned_date, planned_order, due_at, created_at, status_updated_at, completed_at, outcome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      taskId,
      taskCode,
      title,
      payload.description || '',
      status,
      payload.goalId || payload.goal_id || null,
      payload.projectId || payload.project_id || null,
      payload.parentTaskId || payload.parent_task_id || null,
      Number(payload.priority || 3),
      plannedDate,
      Number(payload.plannedOrder ?? payload.planned_order ?? 0),
      payload.dueAt || payload.due_at || null,
      timestamp,
      timestamp,
      status === 'done' ? timestamp : null,
      payload.outcome || '',
    ],
  );
  if (plannedDate) {
    run('INSERT OR IGNORE INTO task_day_plans (task_id, local_date, created_at) VALUES (?, ?, ?)', [taskId, plannedDate, timestamp]);
  }
  replaceTags(taskId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  replacePersonLinks('task', taskId, personRefsFromPayload(payload));
  recordTaskEvent(taskId, 'created', null, status, payload.note || '');
  return withCreated({ taskId, taskCode });
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
  const hasPlannedDate = Object.hasOwn(payload, 'plannedDate') || Object.hasOwn(payload, 'planned_date');
  const plannedDate = hasPlannedDate
    ? (payload.plannedDate || payload.planned_date || null)
    : (existing.planned_date || null);

  run(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, goal_id = ?, project_id = ?, parent_task_id = ?,
         priority = ?, planned_date = ?, planned_order = ?, due_at = ?, status_updated_at = ?, completed_at = ?, outcome = ?
     WHERE task_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      payload.description ?? existing.description ?? '',
      status,
      payload.goalId ?? payload.goal_id ?? existing.goal_id ?? null,
      payload.projectId ?? payload.project_id ?? existing.project_id ?? null,
      payload.parentTaskId ?? payload.parent_task_id ?? existing.parent_task_id ?? null,
      Number(payload.priority || existing.priority || 3),
      plannedDate,
      Number(payload.plannedOrder ?? payload.planned_order ?? existing.planned_order ?? 0),
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
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('task', taskId, personRefsFromPayload(payload));
  }
  if (statusChanged) recordTaskEvent(taskId, 'status_changed', existing.status, status, payload.note || '');
  return dashboard();
}

export function restoreTask(taskId) {
  const task = get('SELECT status FROM tasks WHERE task_id = ?', [taskId]);
  if (!task || task.status !== 'abandoned') return dashboard();
  const abandonedEvent = get(
    `SELECT from_status
     FROM task_events
     WHERE task_id = ? AND to_status = 'abandoned'
     ORDER BY happened_at DESC, rowid DESC
     LIMIT 1`,
    [taskId],
  );
  const restoreStatus = ['todo', 'doing', 'blocked'].includes(abandonedEvent?.from_status)
    ? abandonedEvent.from_status
    : 'todo';
  return updateTask(taskId, { status: restoreStatus, note: '从放弃状态恢复' });
}

export function setTaskDayPlan(taskId, payload = {}) {
  const task = get('SELECT task_id FROM tasks WHERE task_id = ?', [taskId]);
  const localDate = String(payload.localDate || payload.local_date || '').trim();
  if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return dashboard();
  const planned = payload.planned !== false;

  if (planned) {
    run(
      'INSERT OR IGNORE INTO task_day_plans (task_id, local_date, created_at) VALUES (?, ?, ?)',
      [taskId, localDate, now()],
    );
  } else {
    run('DELETE FROM task_day_plans WHERE task_id = ? AND local_date = ?', [taskId, localDate]);
  }

  const firstPlan = get('SELECT MIN(local_date) AS local_date FROM task_day_plans WHERE task_id = ?', [taskId]);
  run('UPDATE tasks SET planned_date = ? WHERE task_id = ?', [firstPlan?.local_date || null, taskId]);
  recordTaskEvent(taskId, planned ? 'planned_for_day' : 'unplanned_for_day', null, null, localDate);
  return dashboard();
}

export function createTag(payload) {
  const name = String(payload.name || '').trim();
  const tagKey = normalizeTagKey(payload.tagKey || payload.tag_key || name);
  if (!name || !tagKey) return dashboard();

  const tagId = id('tag');
  const parent = normalizeParentTag(parentRefFromPayload(payload), tagId);
  const category = parent?.category || normalizeTagCategory(payload.category || 'activity_type');
  run(
    `INSERT OR IGNORE INTO tags
      (tag_id, tag_key, name, category, parent_tag_id, parent_tag_key, description, color, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tagId,
      tagKey,
      name,
      category,
      parent?.tag_id || null,
      parent?.tag_key || null,
      payload.description || '',
      payload.color || '',
      Number(payload.sortOrder || payload.sort_order || 100),
      payload.isActive === false || payload.is_active === 0 ? 0 : 1,
    ],
  );
  const savedTag = tagByRef(tagKey);
  return withCreated({ tagId: savedTag?.tag_id || tagId, tagKey });
}

export function updateTag(tagRef, payload) {
  const existing = tagByRef(tagRef);
  if (!existing) return dashboard();

  const requestedParent = parentRefFromPayload(payload, existing.parent_tag_id ?? null);
  const hasChildren = hasChildTags(existing.tag_id);
  const parent = hasChildren ? null : normalizeParentTag(requestedParent, existing.tag_id);
  const category = hasChildren ? existing.category : parent?.category || normalizeTagCategory(payload.category || existing.category);
  run(
    `UPDATE tags
     SET name = ?, category = ?, parent_tag_id = ?, parent_tag_key = ?, description = ?, color = ?, sort_order = ?, is_active = ?
     WHERE tag_id = ?`,
    [
      String(payload.name || existing.name).trim(),
      category,
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
      'daily',
      1,
      normalizeHabitStatus(payload.status || 'active'),
      Number(payload.priority || 3),
      payload.note || '',
      now(),
    ],
  );
  replaceTags(habitId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  replacePersonLinks('habit', habitId, personRefsFromPayload(payload));
  return withCreated({ habitId });
}

export function updateHabit(habitId, payload = {}) {
  const existing = get('SELECT * FROM habits WHERE habit_id = ?', [habitId]);
  if (!existing) return dashboard();

  run(
    `UPDATE habits
     SET title = ?, cadence = ?, target_count = ?, status = ?, priority = ?, note = ?
     WHERE habit_id = ?`,
    [
      String(payload.title ?? existing.title).trim(),
      'daily',
      1,
      normalizeHabitStatus(payload.status || existing.status),
      Number(payload.priority ?? existing.priority ?? 3),
      payload.note ?? existing.note ?? '',
      habitId,
    ],
  );
  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tag_ids) || Array.isArray(payload.tagKeys)) {
    replaceTags(habitId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('habit', habitId, personRefsFromPayload(payload));
  }
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
  return withCreated({ habitId, localDate: payload.localDate || today() });
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
  replacePersonLinks('schedule', eventId, personRefsFromPayload(payload));
  if (linkedTimelineId) {
    replacePersonLinks('timeline', linkedTimelineId, personRefsFromPayload(payload));
  }
  return withCreated({ eventId, timelineId: linkedTimelineId });
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
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('schedule', eventId, personRefsFromPayload(payload));
  }
  return dashboard();
}

export function createReminder(payload = {}) {
  const title = String(payload.title || '').trim();
  if (!title) return dashboard();
  const reminderId = id('reminder');

  run(
    `INSERT INTO reminders
      (reminder_id, title, reminder_type, status, priority, reason, suggested_action, goal_id, task_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reminderId,
      title,
      payload.reminderType || payload.reminder_type || 'follow_up',
      normalizeReminderStatus(payload.status || 'pending'),
      Number(payload.priority || 3),
      payload.reason || '',
      payload.suggestedAction || payload.suggested_action || '',
      payload.goalId || payload.goal_id || null,
      payload.taskId || payload.task_id || null,
      now(),
    ],
  );
  replacePersonLinks('reminder', reminderId, personRefsFromPayload(payload));
  return withCreated({ reminderId });
}

export function updateReminder(reminderId, payload = {}) {
  const existing = get('SELECT * FROM reminders WHERE reminder_id = ?', [reminderId]);
  if (!existing) return dashboard();

  run(
    `UPDATE reminders
     SET title = ?, reminder_type = ?, status = ?, priority = ?, reason = ?, suggested_action = ?, goal_id = ?, task_id = ?
     WHERE reminder_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      payload.reminderType || payload.reminder_type || existing.reminder_type,
      normalizeReminderStatus(payload.status || existing.status),
      Number(payload.priority || existing.priority || 3),
      payload.reason ?? existing.reason ?? '',
      payload.suggestedAction ?? payload.suggested_action ?? existing.suggested_action ?? '',
      payload.goalId ?? payload.goal_id ?? existing.goal_id ?? null,
      payload.taskId ?? payload.task_id ?? existing.task_id ?? null,
      reminderId,
    ],
  );
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('reminder', reminderId, personRefsFromPayload(payload));
  }
  return dashboard();
}

export function generateReport(periodType) {
  const type = ['day', 'week', 'month'].includes(periodType) ? periodType : 'day';
  const { start: periodStart, end: periodEnd } = completedReportPeriodBounds(type, new Date());
  const timeline = all(
    'SELECT * FROM timeline_entries WHERE local_date >= ? AND local_date <= ? ORDER BY start_at ASC',
    [periodStart, periodEnd],
  );
  const goals = all(
    `SELECT *
     FROM goals
     WHERE status <> ?
       AND period_start <= ?
       AND period_end >= ?
     ORDER BY priority ASC, created_at DESC
     LIMIT 4`,
    ['deleted', periodEnd, periodStart],
  );
  const activeHabits = get('SELECT COUNT(*) AS count FROM habits WHERE status = ?', ['active']).count;
  const doneHabits = get(
    'SELECT COUNT(*) AS count FROM habit_logs WHERE local_date >= ? AND local_date <= ? AND status = ?',
    [periodStart, periodEnd, 'done'],
  ).count;
  const periodEvents = get(
    'SELECT COUNT(*) AS count FROM schedule_events WHERE date(start_at) >= ? AND date(start_at) <= ? AND status = ?',
    [periodStart, periodEnd, 'planned'],
  ).count;
  const doneTasks = get(
    'SELECT COUNT(*) AS count FROM tasks WHERE status = ? AND date(COALESCE(completed_at, status_updated_at, created_at)) >= ? AND date(COALESCE(completed_at, status_updated_at, created_at)) <= ?',
    ['done', periodStart, periodEnd],
  ).count;
  const activeTasks = get('SELECT COUNT(*) AS count FROM tasks WHERE status IN (?, ?, ?)', ['todo', 'doing', 'blocked']).count;
  const moments = get(
    'SELECT COUNT(*) AS count FROM moments WHERE local_date >= ? AND local_date <= ?',
    [periodStart, periodEnd],
  ).count;
  const trackedHours = metrics(timeline).trackedHours;
  const activityFocus = topTagNames('activity_type');

  const title = {
    day: '昨日系统复盘',
    week: '上周系统复盘',
    month: '上月系统复盘',
  }[type];

  const summary = [
    `时间：已记录 ${trackedHours} 小时，最近一段时间线是“${timeline.at(-1)?.title || '暂无'}”。`,
    goals.length ? `目标：周期内关联 ${goals.map((goal) => goal.title).join('、')}。` : '目标：这个周期还没有关联目标。',
    `行动：当前任务 ${activeTasks} 个，已完成 ${doneTasks} 个，沉淀 ${moments} 个高光。`,
    `节律：习惯完成 ${doneHabits} 次，当前习惯 ${activeHabits} 个，周期内日程 ${periodEvents} 个。`,
    `活动重心：${activityFocus.length ? activityFocus.join('、') : '暂无'}。`,
  ].join('\n');

  const generatedAt = now();
  const existingReport = get(
    `SELECT *
     FROM reports
     WHERE period_type = ? AND period_start = ? AND period_end = ?
     ORDER BY generated_at DESC
     LIMIT 1`,
    [type, periodStart, periodEnd],
  );
  const reportId = existingReport?.report_id || id('report');

  if (existingReport) {
    run(
      `UPDATE reports
       SET title = ?, summary = ?, generated_at = ?, status = ?
       WHERE report_id = ?`,
      [title, summary, generatedAt, 'final', reportId],
    );
  } else {
    run(
      `INSERT INTO reports
        (report_id, period_type, period_start, period_end, title, summary, generated_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportId, type, periodStart, periodEnd, title, summary, generatedAt, 'final'],
    );
  }

  upsertGeneratedReview({
    title,
    reviewType: type,
    periodStart,
    periodEnd,
    summary,
    sourceReportId: reportId,
  });

  return dashboard();
}

function upsertGeneratedReview({ title, reviewType, periodStart, periodEnd, summary, sourceReportId }) {
  const existingReview = get(
    'SELECT * FROM reviews WHERE source_report_id = ? ORDER BY created_at DESC LIMIT 1',
    [sourceReportId],
  );

  if (!existingReview) {
    createReviewRecord({
      title,
      reviewType,
      periodStart,
      periodEnd,
      summary,
      body: summary,
      sourceReportId,
      tagRefs: ['review'],
    });
    return;
  }

  run(
    `UPDATE reviews
     SET title = ?, review_type = ?, period_start = ?, period_end = ?, summary = ?, body = ?, updated_at = ?
     WHERE review_id = ?`,
    [title, reviewType, periodStart, periodEnd, summary, summary, now(), existingReview.review_id],
  );
  replaceTags(existingReview.review_id, ['review']);
}

export function createReview(payload) {
  const sourceReport = payload.sourceReportId || payload.source_report_id
    ? get('SELECT * FROM reports WHERE report_id = ?', [payload.sourceReportId || payload.source_report_id])
    : null;
  const reviewType = normalizeReviewType(payload.reviewType || payload.review_type || sourceReport?.period_type || 'topic');
  const title = String(payload.title || sourceReport?.title || '未命名复盘').trim();
  if (!title) return dashboard();

  const reviewId = createReviewRecord({
    title,
    reviewType,
    periodStart: payload.periodStart || payload.period_start || sourceReport?.period_start || today(),
    periodEnd: payload.periodEnd || payload.period_end || sourceReport?.period_end || today(),
    summary: payload.summary ?? sourceReport?.summary ?? '',
    body: payload.body ?? sourceReport?.summary ?? '',
    learnings: payload.learnings || '',
    nextActions: payload.nextActions || payload.next_actions || '',
    sourceReportId: sourceReport?.report_id || payload.sourceReportId || payload.source_report_id || null,
    isPinned: payload.isPinned || payload.is_pinned ? 1 : 0,
    tagRefs: payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? [],
  });
  replacePersonLinks('review', reviewId, personRefsFromPayload(payload));
  return withCreated({ reviewId });
}

function createReviewRecord({
  title,
  reviewType,
  periodStart,
  periodEnd,
  summary = '',
  body = '',
  learnings = '',
  nextActions = '',
  sourceReportId = null,
  isPinned = 0,
  tagRefs = [],
}) {
  const timestamp = now();
  const reviewId = id('review');
  run(
    `INSERT INTO reviews
      (review_id, title, review_type, period_start, period_end, summary, body, learnings, next_actions, source_report_id, created_at, updated_at, is_pinned)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reviewId,
      title,
      reviewType,
      periodStart,
      periodEnd,
      summary,
      body,
      learnings,
      nextActions,
      sourceReportId,
      timestamp,
      timestamp,
      isPinned,
    ],
  );

  replaceTags(reviewId, tagRefs);
  return reviewId;
}

export function updateReview(reviewId, payload) {
  const existing = get('SELECT * FROM reviews WHERE review_id = ?', [reviewId]);
  if (!existing) return dashboard();

  run(
    `UPDATE reviews
     SET title = ?, review_type = ?, period_start = ?, period_end = ?, summary = ?, body = ?,
         learnings = ?, next_actions = ?, updated_at = ?, is_pinned = ?
     WHERE review_id = ?`,
    [
      String(payload.title || existing.title).trim(),
      normalizeReviewType(payload.reviewType || payload.review_type || existing.review_type),
      payload.periodStart ?? payload.period_start ?? existing.period_start,
      payload.periodEnd ?? payload.period_end ?? existing.period_end,
      payload.summary ?? existing.summary ?? '',
      payload.body ?? existing.body ?? '',
      payload.learnings ?? existing.learnings ?? '',
      payload.nextActions ?? payload.next_actions ?? existing.next_actions ?? '',
      now(),
      payload.isPinned ?? payload.is_pinned ?? existing.is_pinned ?? 0,
      reviewId,
    ],
  );

  if (Array.isArray(payload.tagIds) || Array.isArray(payload.tagKeys)) {
    replaceTags(reviewId, payload.tagIds ?? payload.tag_ids ?? payload.tagKeys ?? []);
  }
  if (hasPersonLinksPayload(payload)) {
    replacePersonLinks('review', reviewId, personRefsFromPayload(payload));
  }
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
      planned_date TEXT,
      planned_order INTEGER NOT NULL DEFAULT 0,
      due_at TEXT,
      created_at TEXT NOT NULL,
      status_updated_at TEXT,
      completed_at TEXT,
      outcome TEXT
    );

    CREATE TABLE IF NOT EXISTS task_day_plans (
      task_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (task_id, local_date),
      FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS reviews (
      review_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      review_type TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      summary TEXT,
      body TEXT,
      learnings TEXT,
      next_actions TEXT,
      source_report_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS moments (
      moment_id TEXT PRIMARY KEY,
      source_input_id TEXT,
      happened_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      title TEXT NOT NULL,
      story TEXT,
      importance INTEGER NOT NULL,
      image_url TEXT,
      project_id TEXT,
      task_id TEXT,
      timeline_id TEXT
    );

    CREATE TABLE IF NOT EXISTS moment_images (
      moment_image_id TEXT PRIMARY KEY,
      moment_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (moment_id) REFERENCES moments(moment_id) ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS person_record_links (
      person_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      role TEXT,
      mention_text TEXT,
      confidence REAL,
      note TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (person_id, record_type, record_id)
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
  ensureColumn('tasks', 'planned_date', 'TEXT');
  ensureColumn('tasks', 'planned_order', 'INTEGER NOT NULL DEFAULT 0');
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
  ensureColumn('reviews', 'summary', 'TEXT');
  ensureColumn('reviews', 'body', 'TEXT');
  ensureColumn('reviews', 'learnings', 'TEXT');
  ensureColumn('reviews', 'next_actions', 'TEXT');
  ensureColumn('reviews', 'source_report_id', 'TEXT');
  ensureColumn('reviews', 'updated_at', 'TEXT');
  ensureColumn('reviews', 'is_pinned', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('moments', 'image_url', 'TEXT');
  run(
    `INSERT OR IGNORE INTO moment_images (moment_image_id, moment_id, image_url, sort_order, created_at)
     SELECT 'moment_image_' || moment_id, moment_id, image_url, 0, happened_at
     FROM moments
     WHERE image_url IS NOT NULL AND image_url <> ''
       AND NOT EXISTS (SELECT 1 FROM moment_images WHERE moment_images.moment_id = moments.moment_id)`,
  );
  ensureColumn('person_record_links', 'mention_text', 'TEXT');
  ensureColumn('person_record_links', 'confidence', 'REAL');
  run("UPDATE reports SET title = REPLACE(title, '系统复盘草稿', '系统复盘') WHERE title IN ('今日系统复盘草稿', '本周系统复盘草稿', '本月系统复盘草稿')");
  run("UPDATE reviews SET title = REPLACE(title, '系统复盘草稿', '系统复盘') WHERE title IN ('今日系统复盘草稿', '本周系统复盘草稿', '本月系统复盘草稿')");
  run("UPDATE source_inputs SET raw_text = REPLACE(raw_text, '人物用 alias 归一', '人物关系用 personRefs 显式挂载') WHERE raw_text LIKE '%人物用 alias 归一%'");
  run("UPDATE timeline_entries SET description = REPLACE(description, '人物用 alias 归一', '人物关系用 personRefs 显式挂载') WHERE description LIKE '%人物用 alias 归一%'");
  run("UPDATE goals SET status = 'active' WHERE status = 'paused'");
  run("UPDATE goals SET status = 'not_done' WHERE status IN ('expired', 'missed')");
  run("UPDATE habits SET cadence = 'daily', target_count = 1 WHERE cadence <> 'daily' OR target_count <> 1");
  migrateRecordTags();
  ensureColumn('schedule_events', 'goal_id', 'TEXT');
  ensureColumn('schedule_events', 'task_id', 'TEXT');
  ensureColumn('schedule_events', 'timeline_id', 'TEXT');
  run('UPDATE tasks SET status_updated_at = created_at WHERE status_updated_at IS NULL');
  run(
    `INSERT OR IGNORE INTO task_day_plans (task_id, local_date, created_at)
     SELECT task_id, planned_date, COALESCE(status_updated_at, created_at)
     FROM tasks
     WHERE planned_date IS NOT NULL`,
  );
  normalizeTagHierarchy();
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
    ['tag_game', 'game', '游戏', 'activity_type', 'hobby', 63],
    ['tag_reimbursement', 'reimbursement', '报销', 'activity_type', 'admin', 71],
    ['tag_organize', 'organize', '整理', 'activity_type', 'admin', 72],
    ['tag_purchase', 'purchase', '采购', 'activity_type', 'admin', 73],
    ['tag_appointment', 'appointment', '预约', 'activity_type', 'admin', 74],
    ['tag_payment', 'payment', '缴费', 'activity_type', 'admin', 75],
    ['tag_admin_process', 'admin_process', '行政', 'activity_type', 'admin', 76],
    ['tag_commute', 'commute', '通勤', 'activity_type', 'admin', 77],
    ['tag_deep_work', 'deep_work', '深度工作', 'work_mode', null, 10],
    ['tag_shallow_work', 'shallow_work', '浅层处理', 'work_mode', null, 20],
    ['tag_creation', 'creation', '创造输出', 'work_mode', null, 30],
    ['tag_input', 'input', '输入吸收', 'work_mode', null, 40],
    ['tag_coordination', 'coordination', '协调推进', 'work_mode', null, 50],
    ['tag_high', 'high_value', '高价值', 'value_signal', null, 10],
    ['tag_maintenance', 'maintenance', '维护', 'value_signal', null, 20],
    ['tag_low_value', 'low_value', '低价值', 'value_signal', null, 30],
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
}

function syncOpenTagSet(defaultTags) {
  defaultTags.forEach(([tagId, key, name, category, parentTagKey, sortOrder]) => {
    upsertTag(tagId, key, name, category, parentTagKey, sortOrder);
  });

  ['tag_deep', 'tag_golf'].forEach((tagId) => {
    run('UPDATE tags SET is_active = 0 WHERE tag_id = ?', [tagId]);
  });
  run("UPDATE tags SET is_active = 0 WHERE category IN ('state_signal', 'energy_state', 'mood_state', 'environment')");
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

function attachTag(recordId, tagRef) {
  const tag = tagByRef(tagRef);
  if (!tag) return;
  run(
    `DELETE FROM record_tags
     WHERE record_id = ?
       AND tag_id IN (SELECT tag_id FROM tags WHERE category = ?)`,
    [recordId, tag.category],
  );
  run('INSERT OR IGNORE INTO record_tags (record_id, tag_id) VALUES (?, ?)', [recordId, tag.tag_id]);
}

function replaceTags(recordId, tagRefs) {
  run('DELETE FROM record_tags WHERE record_id = ?', [recordId]);
  tagRefs.forEach((tagRef) => attachTag(recordId, tagRef));
}

function replacePersonAliases(personId, aliases = []) {
  const normalizedAliases = [...new Set(aliases
    .map((alias) => (typeof alias === 'string' ? { text: alias } : alias))
    .map((alias) => ({
      text: String(alias.text || alias.alias || alias.alias_text || '').trim(),
      type: alias.type || alias.aliasType || alias.alias_type || 'alias',
      primary: alias.primary ?? alias.isPrimary ?? alias.is_primary ?? 0,
      confidence: Number(alias.confidence ?? 1),
    }))
    .filter((alias) => alias.text)
    .map((alias) => JSON.stringify(alias)))]
    .map((alias) => JSON.parse(alias));

  run('DELETE FROM person_aliases WHERE person_id = ?', [personId]);
  normalizedAliases.forEach((alias, index) => {
    run(
      'INSERT INTO person_aliases (alias_id, person_id, alias_text, alias_type, is_primary, confidence) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id('alias'),
        personId,
        alias.text,
        alias.type,
        alias.primary || index === 0 ? 1 : 0,
        alias.confidence,
      ],
    );
  });
}

function replacePersonLinks(recordType, recordId, personRefs = []) {
  run('DELETE FROM person_record_links WHERE record_type = ? AND record_id = ?', [recordType, recordId]);
  personRefs
    .map((ref) => normalizePersonLink(ref))
    .filter((link) => link.personId && get('SELECT person_id FROM people WHERE person_id = ?', [link.personId]))
    .forEach((link) => {
      run(
        `INSERT OR REPLACE INTO person_record_links
          (person_id, record_type, record_id, role, mention_text, confidence, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [link.personId, recordType, recordId, link.role, link.mentionText, link.confidence, link.note, now()],
      );
    });
}

function normalizePersonLink(ref) {
  if (typeof ref === 'string') {
    return { personId: ref, role: 'participant', mentionText: '', confidence: 1, note: '' };
  }
  return {
    personId: ref.personId || ref.person_id || ref.personRef || ref.person_ref || ref.id || '',
    role: ref.role || 'participant',
    mentionText: ref.mentionText || ref.mention_text || ref.alias || '',
    confidence: Number(ref.confidence ?? 1),
    note: ref.note || '',
  };
}

function personRefsFromPayload(payload = {}) {
  const refs = payload.personIds
    ?? payload.person_ids
    ?? payload.personRefs
    ?? payload.person_refs
    ?? payload.people
    ?? [];
  return Array.isArray(refs) ? refs : [refs];
}

function hasPersonLinksPayload(payload = {}) {
  return ['personIds', 'person_ids', 'personRefs', 'person_refs', 'people'].some((key) => key in payload);
}

function personRelatedRecords(personId) {
  return all(
    `SELECT *
     FROM person_record_links
     WHERE person_id = ?
     ORDER BY created_at DESC`,
    [personId],
  ).map((link) => personRelatedRecord(link)).filter(Boolean);
}

function personRelatedRecord(link) {
  const record = readLinkedRecord(link.record_type, link.record_id);
  if (!record) return null;
  return {
    ...record,
    relationRole: link.role || '',
    relationMention: link.mention_text || '',
    relationConfidence: link.confidence ?? null,
    relationNote: link.note || '',
  };
}

function readLinkedRecord(type, recordId) {
  if (type === 'timeline') {
    const item = get(
      `SELECT timeline_entries.*, tasks.title AS task_title, tasks.task_code
       FROM timeline_entries
       LEFT JOIN tasks ON tasks.task_id = timeline_entries.task_id
       WHERE timeline_entries.timeline_id = ?`,
      [recordId],
    );
    return item && {
      id: `timeline:${item.timeline_id}`,
      source: 'timeline',
      sourceLabel: '时间线',
      date: item.start_at || item.local_date,
      title: item.title,
      body: item.description,
      meta: [item.task_code, item.task_title].filter(Boolean).join(' · '),
    };
  }
  if (type === 'task') {
    const task = get(
      `SELECT tasks.*, goals.title AS goal_title
       FROM tasks
       LEFT JOIN goals ON goals.goal_id = tasks.goal_id
       WHERE tasks.task_id = ?`,
      [recordId],
    );
    return task && {
      id: `task:${task.task_id}`,
      source: 'task',
      sourceLabel: '任务',
      date: task.completed_at || task.status_updated_at || task.created_at,
      title: task.title,
      body: task.description,
      meta: [task.task_code, task.status, task.goal_title].filter(Boolean).join(' · '),
    };
  }
  if (type === 'schedule') {
    const event = get('SELECT * FROM schedule_events WHERE event_id = ?', [recordId]);
    return event && {
      id: `schedule:${event.event_id}`,
      source: 'schedule',
      sourceLabel: '日程',
      date: event.start_at,
      title: event.title,
      body: [event.location, event.note].filter(Boolean).join(' · '),
      meta: event.status,
    };
  }
  if (type === 'moment') {
    const moment = get(
      `SELECT moments.*, timeline_entries.title AS timeline_title
       FROM moments
       LEFT JOIN timeline_entries ON timeline_entries.timeline_id = moments.timeline_id
       WHERE moments.moment_id = ?`,
      [recordId],
    );
    return moment && {
      id: `moment:${moment.moment_id}`,
      source: 'moment',
      sourceLabel: '高光',
      date: moment.happened_at || moment.local_date,
      title: moment.title,
      body: moment.story,
      meta: moment.timeline_title ? `来自：${moment.timeline_title}` : '',
    };
  }
  if (type === 'review') {
    const review = get('SELECT * FROM reviews WHERE review_id = ?', [recordId]);
    return review && {
      id: `review:${review.review_id}`,
      source: 'review',
      sourceLabel: '复盘',
      date: review.created_at || review.period_end,
      title: review.title,
      body: review.summary,
      meta: review.review_type,
    };
  }
  if (type === 'goal') {
    const goal = get('SELECT * FROM goals WHERE goal_id = ?', [recordId]);
    return goal && {
      id: `goal:${goal.goal_id}`,
      source: 'goal',
      sourceLabel: '目标',
      date: goal.period_end || goal.created_at,
      title: goal.title,
      body: goal.success_criteria,
      meta: goal.level,
    };
  }
  if (type === 'habit') {
    const habit = get('SELECT * FROM habits WHERE habit_id = ?', [recordId]);
    return habit && {
      id: `habit:${habit.habit_id}`,
      source: 'habit',
      sourceLabel: '习惯',
      date: habit.created_at,
      title: habit.title,
      body: habit.note,
      meta: habit.status,
    };
  }
  if (type === 'reminder') {
    const reminder = get('SELECT * FROM reminders WHERE reminder_id = ?', [recordId]);
    return reminder && {
      id: `reminder:${reminder.reminder_id}`,
      source: 'reminder',
      sourceLabel: '提醒',
      date: reminder.created_at,
      title: reminder.title,
      body: reminder.reason,
      meta: reminder.status,
    };
  }
  return null;
}

function createSourceInputRecord(payload = {}) {
  const rawText = String(payload.rawText || payload.raw_text || payload.text || '').trim();
  if (!rawText) return null;
  const inputId = id('input');
  run(
    'INSERT INTO source_inputs (input_id, happened_at, channel, raw_text, author) VALUES (?, ?, ?, ?, ?)',
    [
      inputId,
      payload.happenedAt || payload.happened_at || now(),
      payload.channel || 'openclaw',
      rawText,
      payload.author || 'user',
    ],
  );
  return inputId;
}

function withCreated(created) {
  return {
    ...dashboard(),
    created,
  };
}

function applyOpenClawOperation(operation = {}, refs, sourceInputId) {
  const entity = normalizeOperationEntity(operation.entity || operation.type);
  const action = operation.action || (entity === 'habit_log' ? 'log' : 'create');
  const data = resolveOperationData(operation.data || operation.payload || {}, refs);

  if (sourceInputId && ['timeline', 'moment'].includes(entity) && !data.sourceInputId && !data.source_input_id) {
    data.sourceInputId = sourceInputId;
  }

  if (action === 'create') {
    const result = createByEntity(entity, data);
    return { action, entity, ref: operation.ref || '', created: result.created || null };
  }

  if (action === 'update') {
    updateByEntity(entity, resolveOperationTarget(operation, data, refs), data);
    return { action, entity, ref: operation.ref || '', targetId: resolveOperationTarget(operation, data, refs) };
  }

  if (action === 'log' && entity === 'habit_log') {
    const habitId = resolveOperationTarget(operation, data, refs) || data.habitId || data.habit_id;
    const result = logHabit(habitId, data);
    return { action, entity, ref: operation.ref || '', created: result.created || null };
  }

  throw new Error(`Unsupported OpenClaw operation: ${action} ${entity}`);
}

function createByEntity(entity, data) {
  if (entity === 'source_input') return createSourceInput(data);
  if (entity === 'timeline') return createTimelineEntry(data);
  if (entity === 'moment') return createMoment(data);
  if (entity === 'person') return createPerson(data);
  if (entity === 'goal') return createGoal(data);
  if (entity === 'task') return createTask(data);
  if (entity === 'tag') return createTag(data);
  if (entity === 'habit') return createHabit(data);
  if (entity === 'schedule') return createScheduleEvent(data);
  if (entity === 'reminder') return createReminder(data);
  if (entity === 'review') return createReview(data);
  throw new Error(`Unsupported OpenClaw create entity: ${entity}`);
}

function updateByEntity(entity, targetId, data) {
  if (!targetId) throw new Error(`Missing target id for ${entity} update`);
  if (entity === 'timeline') return updateTimeline(targetId, data);
  if (entity === 'moment') return updateMoment(targetId, data);
  if (entity === 'person') return updatePerson(targetId, data);
  if (entity === 'goal') return updateGoal(targetId, data);
  if (entity === 'task') return updateTask(targetId, data);
  if (entity === 'tag') return updateTag(targetId, data);
  if (entity === 'habit') return updateHabit(targetId, data);
  if (entity === 'schedule') return updateScheduleEvent(targetId, data);
  if (entity === 'reminder') return updateReminder(targetId, data);
  if (entity === 'review') return updateReview(targetId, data);
  throw new Error(`Unsupported OpenClaw update entity: ${entity}`);
}

function resolveOperationTarget(operation, data, refs) {
  return resolveRefValue(
    operation.targetId
      || operation.target_id
      || operation.id
      || data.targetId
      || data.target_id
      || data.id
      || data.goalId
      || data.goal_id
      || data.taskId
      || data.task_id
      || data.habitId
      || data.habit_id
      || data.timelineId
      || data.timeline_id
      || data.momentId
      || data.moment_id
      || data.personId
      || data.person_id
      || data.eventId
      || data.event_id
      || data.reminderId
      || data.reminder_id
      || data.reviewId
      || data.review_id,
    refs,
  );
}

function resolveOperationData(data, refs) {
  const resolved = resolveRefs(data, refs);
  const refFields = {
    sourceInputRef: 'sourceInputId',
    source_input_ref: 'source_input_id',
    timelineRef: 'timelineId',
    timeline_ref: 'timeline_id',
    taskRef: 'taskId',
    task_ref: 'task_id',
    goalRef: 'goalId',
    goal_ref: 'goal_id',
    habitRef: 'habitId',
    habit_ref: 'habit_id',
    momentRef: 'momentId',
    moment_ref: 'moment_id',
    personRef: 'personId',
    person_ref: 'person_id',
    eventRef: 'eventId',
    event_ref: 'event_id',
    reminderRef: 'reminderId',
    reminder_ref: 'reminder_id',
    reviewRef: 'reviewId',
    review_ref: 'review_id',
  };

  Object.entries(refFields).forEach(([from, to]) => {
    if (resolved[from]) {
      resolved[to] = resolveRefValue(resolved[from], refs);
      delete resolved[from];
    }
  });
  return resolved;
}

function resolveRefs(value, refs) {
  if (Array.isArray(value)) return value.map((item) => resolveRefs(item, refs));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveRefs(item, refs)]));
  }
  return resolveRefValue(value, refs);
}

function resolveRefValue(value, refs) {
  if (typeof value !== 'string') return value;
  if (refs.has(value)) return refs.get(value);
  if (value.startsWith('$') && refs.has(value.slice(1))) return refs.get(value.slice(1));
  return value;
}

function addCreatedRefs(ref, created, refs) {
  Object.entries(created).forEach(([key, value]) => {
    if (!value) return;
    refs.set(`${ref}.${key}`, value);
    refs.set(`$${ref}.${key}`, value);
  });

  const primary = created.timelineId
    || created.taskId
    || created.goalId
    || created.momentId
    || created.personId
    || created.habitId
    || created.eventId
    || created.reminderId
    || created.reviewId
    || created.tagId
    || created.inputId
    || created.sourceInputId;
  if (primary) {
    refs.set(ref, primary);
    refs.set(`$${ref}`, primary);
  }
}

function normalizeOperationEntity(entity) {
  const normalized = String(entity || '').trim();
  const aliases = {
    source: 'source_input',
    sourceInput: 'source_input',
    source_input: 'source_input',
    timeline_entry: 'timeline',
    schedule_event: 'schedule',
    event: 'schedule',
    habitLog: 'habit_log',
    habit_log: 'habit_log',
  };
  return aliases[normalized] || normalized;
}

function normalizeRecordTagCategories() {
  run(`
    DELETE FROM record_tags
    WHERE rowid NOT IN (
      SELECT rowid
      FROM (
        SELECT
          record_tags.rowid,
          ROW_NUMBER() OVER (
            PARTITION BY record_tags.record_id, tags.category
            ORDER BY
              tags.parent_tag_id IS NOT NULL DESC,
              tags.sort_order DESC,
              tags.name DESC
          ) AS rn
        FROM record_tags
        JOIN tags ON tags.tag_id = record_tags.tag_id
      )
      WHERE rn = 1
    )
  `);
}

function normalizeTaskStatus(status) {
  return ['todo', 'doing', 'blocked', 'done', 'abandoned', 'deleted'].includes(status) ? status : 'todo';
}

function normalizeGoalLevel(level) {
  return ['day', 'week', 'month', 'year'].includes(level) ? level : 'month';
}

function normalizeGoalStatus(status) {
  return ['active', 'done', 'not_done', 'abandoned', 'deleted'].includes(status) ? status : 'active';
}

function normalizeHabitStatus(status) {
  return ['active', 'archived', 'deleted'].includes(status) ? status : 'active';
}

function normalizeTimelineKind(kind) {
  return ['activity_block', 'state_event', 'gap', 'note', 'schedule_event'].includes(kind) ? kind : 'activity_block';
}

function normalizeImportance(value) {
  const number = Number(value ?? 3);
  if (Number.isNaN(number)) return 3;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function normalizeReminderStatus(status) {
  return ['pending', 'reminded', 'done', 'ignored', 'snoozed'].includes(status) ? status : 'pending';
}

function normalizeReviewType(type) {
  return ['day', 'week', 'month', 'topic'].includes(type) ? type : 'topic';
}

function archiveExpiredGoals() {
  run(
    "UPDATE goals SET status = 'not_done' WHERE status = 'active' AND period_end < ?",
    [today()],
  );
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
  if (['生活领域'].includes(category)) return 'life_area';
  if (['activity_type', 'work_mode', 'value_signal', 'life_area'].includes(category)) return category;
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
  run("UPDATE tags SET category = 'activity_type', parent_tag_key = 'hobby' WHERE tag_key IN ('music', 'dance', 'golf') AND parent_tag_key IS NULL");
  run("UPDATE tags SET category = 'life_area', parent_tag_key = NULL WHERE tag_key IN ('health', 'growth', 'relationship', 'finance', 'life')");
  run("UPDATE tags SET category = 'energy_state', parent_tag_key = NULL WHERE tag_key = 'tired'");
  run("UPDATE tags SET name = '顺畅' WHERE tag_key = 'state_good'");
  run("UPDATE tags SET name = '平稳推进' WHERE tag_key = 'state_normal'");
  run("UPDATE tags SET name = '分心' WHERE tag_key = 'state_bad'");
  run("UPDATE tags SET parent_tag_id = NULL, parent_tag_key = NULL WHERE category <> 'activity_type'");
  syncParentTagIds();
  normalizeRecordTagCategories();
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
       AND tags.is_active = 1
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
  return all(
    `SELECT record_tags.tag_id
     FROM record_tags
     JOIN tags ON tags.tag_id = record_tags.tag_id
     WHERE record_tags.record_id = ? AND tags.is_active = 1
     ORDER BY record_tags.tag_id`,
    [recordId],
  ).map((row) => row.tag_id);
}

function tagKeysFor(recordId) {
  return all(
    `SELECT tags.tag_key
     FROM record_tags
     JOIN tags ON tags.tag_id = record_tags.tag_id
     WHERE record_tags.record_id = ?
       AND tags.is_active = 1
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

function topTagNames(category) {
  return all(
    `SELECT tags.name, COUNT(*) AS count
     FROM record_tags
     JOIN tags ON tags.tag_id = record_tags.tag_id
     WHERE tags.category = ?
       AND tags.is_active = 1
     GROUP BY tags.tag_id
     ORDER BY count DESC, tags.sort_order ASC, tags.name ASC
     LIMIT 4`,
    [category],
  ).map((row) => row.name);
}

function periodBounds(level, date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (level === 'day') return { start: today(date), end: today(date) };
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

function completedReportPeriodBounds(type, date) {
  if (type === 'month') {
    const lastMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return {
      start: today(lastMonth),
      end: today(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)),
    };
  }

  if (type === 'week') {
    const currentWeek = periodBounds('week', date);
    const currentStart = new Date(`${currentWeek.start}T00:00:00`);
    const start = new Date(currentStart);
    start.setDate(currentStart.getDate() - 7);
    const end = new Date(currentStart);
    end.setDate(currentStart.getDate() - 1);
    return { start: today(start), end: today(end) };
  }

  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  return { start: today(yesterday), end: today(yesterday) };
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
