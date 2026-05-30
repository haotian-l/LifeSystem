import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CalendarDays,
  Check,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Flag,
  ListChecks,
  ListTodo,
  MessageSquareText,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  Sparkles,
  Tags,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';

const views = [
  { id: 'today', label: '今日', icon: Clock3 },
  { id: 'goals', label: '目标', icon: Target },
  { id: 'tasks', label: '任务', icon: ListTodo },
  { id: 'timeline', label: '时间线', icon: ListChecks },
  { id: 'habits', label: '习惯', icon: Repeat2 },
  { id: 'schedule', label: '日程', icon: CalendarClock },
  { id: 'tags', label: '标签', icon: Tags },
  { id: 'reports', label: '复盘', icon: Sparkles },
];

const levelLabels = { year: '年度', quarter: '季度', month: '月度', week: '周度', custom: '自定义' };
const statusLabels = { active: '进行中', paused: '暂停', done: '完成', abandoned: '放弃', planned: '计划中', cancelled: '取消', missed: '错过' };
const taskStatusLabels = { todo: '待做', doing: '进行中', blocked: '阻塞', done: '完成', abandoned: '放弃', deleted: '删除' };
const taskCurrentStatusOrder = ['doing', 'todo', 'blocked'];
const taskWorkflowStatusOrder = ['doing', 'todo', 'blocked', 'done', 'abandoned'];
const taskArchiveStatusOrder = ['done', 'abandoned', 'deleted'];
const goalArchiveStatusLabels = { expired: '过期', done: '完成', abandoned: '放弃' };
const goalArchiveStatusOrder = ['expired', 'done', 'abandoned'];
const cadenceLabels = { daily: '每天', weekly: '每周', custom: '自定义' };
const periodLabels = { day: '日报', week: '周报', month: '月报' };
const tagCategoryLabels = {
  activity_type: '活动类型',
  work_mode: '工作模式',
  value_signal: '价值信号',
  state_signal: '状态信号',
  life_area: '生活领域',
};
const tagCategoryOptions = ['activity_type', 'work_mode', 'value_signal', 'state_signal', 'life_area'];
const tagCategoryRank = new Map(tagCategoryOptions.map((category, index) => [category, index]));

const api = {
  dashboard: () => request('/api/dashboard'),
  chat: (text) => request('/api/chat', { method: 'POST', body: JSON.stringify({ text }) }),
  createGoal: (payload) => request('/api/goals', { method: 'POST', body: JSON.stringify(payload) }),
  updateGoal: (goalId, payload) => request(`/api/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateTimeline: (timelineId, payload) => request(`/api/timeline/${timelineId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createTask: (payload) => request('/api/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateTask: (taskId, payload) => request(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createTag: (payload) => request('/api/tags', { method: 'POST', body: JSON.stringify(payload) }),
  updateTag: (tagId, payload) => request(`/api/tags/${encodeURIComponent(tagId)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTag: (tagId) => request(`/api/tags/${encodeURIComponent(tagId)}`, { method: 'DELETE' }),
  createHabit: (payload) => request('/api/habits', { method: 'POST', body: JSON.stringify(payload) }),
  logHabit: (habitId, payload) => request(`/api/habits/${habitId}/log`, { method: 'POST', body: JSON.stringify(payload) }),
  createSchedule: (payload) => request('/api/schedule', { method: 'POST', body: JSON.stringify(payload) }),
  updateSchedule: (eventId, payload) => request(`/api/schedule/${eventId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  report: (periodType) => request('/api/reports/generate', { method: 'POST', body: JSON.stringify({ periodType }) }),
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function App() {
  const [data, setData] = useState(null);
  const [activeView, setActiveView] = useState('today');
  const [loadError, setLoadError] = useState('');
  const [chatText, setChatText] = useState('');
  const [chatState, setChatState] = useState('idle');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [activeReport, setActiveReport] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));

  async function refresh() {
    setLoadError('');
    setData(await api.dashboard());
  }

  useEffect(() => {
    refresh().catch((error) => {
      console.error(error);
      setLoadError(error.message || 'Unable to load dashboard');
    });
  }, []);

  async function submitChat(event) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;

    setChatState('sending');
    try {
      setData(await api.chat(text));
      setChatText('');
      setComposerOpen(false);
    } finally {
      setChatState('idle');
    }
  }

  async function saveEditor(payload) {
    if (editor?.type === 'goal') {
      setData(await api.updateGoal(editor.item.goal_id, payload));
    }
    if (editor?.type === 'timeline') {
      setData(await api.updateTimeline(editor.item.timeline_id, payload));
    }
    setEditor(null);
  }

  async function createGoal(payload) {
    setData(await api.createGoal(payload));
  }

  async function createTask(payload) {
    setData(await api.createTask(payload));
  }

  async function updateTask(taskId, payload) {
    setData(await api.updateTask(taskId, payload));
  }

  async function createTag(payload) {
    setData(await api.createTag(payload));
  }

  async function updateTag(tagId, payload) {
    setData(await api.updateTag(tagId, payload));
  }

  async function deleteTag(tagId) {
    setData(await api.deleteTag(tagId));
  }

  async function generateReport(periodType) {
    setActiveReport(periodType);
    setData(await api.report(periodType));
  }

  async function createHabit(payload) {
    setData(await api.createHabit(payload));
  }

  async function logHabit(habitId, payload) {
    setData(await api.logHabit(habitId, payload));
  }

  async function createSchedule(payload) {
    setData(await api.createSchedule(payload));
  }

  async function updateSchedule(eventId, payload) {
    setData(await api.updateSchedule(eventId, payload));
  }

  if (loadError && !data) {
    return (
      <main className="loading-screen">
        <strong>工作台服务未连接</strong>
        <span>请运行 `npm run dev`，然后打开 http://127.0.0.1:4173。</span>
        <small>{loadError}</small>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="loading-screen">
        <RefreshCw className="spin" size={22} />
        <span>正在载入工作台</span>
      </main>
    );
  }

  const openTimeline = data.timeline.find((item) => !item.end_at);
  const latestReport = data.reports.find((report) => report.period_type === activeReport) || data.reports[0];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <nav aria-label="主视图">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                type="button"
                key={view.id}
                className={activeView === view.id ? 'active' : ''}
                onClick={() => setActiveView(view.id)}
              >
                <Icon size={18} />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">个人工作台</p>
            <h1>{views.find((view) => view.id === activeView)?.label}</h1>
          </div>
          <DateJump value={selectedDate} onChange={setSelectedDate} />
        </header>

        {activeView === 'today' && (
          <TodayView
            data={data}
            selectedDate={selectedDate}
            latestReport={latestReport}
            onLogHabit={logHabit}
            onEditTimeline={(item) => setEditor({ type: 'timeline', item })}
            onOpenGoals={() => setActiveView('goals')}
            onOpenTasks={() => setActiveView('tasks')}
            onOpenTimeline={() => setActiveView('timeline')}
            onOpenHabits={() => setActiveView('habits')}
            onOpenSchedule={() => setActiveView('schedule')}
            onUpdateTask={updateTask}
          />
        )}
        {activeView === 'goals' && (
          <GoalsView
            goals={data.goals}
            tags={data.tags}
            onCreate={createGoal}
            onEdit={(goal) => setEditor({ type: 'goal', item: goal })}
          />
        )}
        {activeView === 'tasks' && (
          <TasksView
            tasks={data.tasks}
            goals={data.goals}
            tags={data.tags}
            onCreate={createTask}
            onUpdate={updateTask}
          />
        )}
        {activeView === 'timeline' && (
          <TimelineView
            items={data.timeline}
            selectedDate={selectedDate}
            onEdit={(item) => setEditor({ type: 'timeline', item })}
          />
        )}
        {activeView === 'habits' && (
          <HabitsView
            habits={data.habits}
            tags={data.tags}
            onCreate={createHabit}
            onLog={logHabit}
          />
        )}
        {activeView === 'schedule' && (
          <ScheduleView
            events={data.schedule}
            tags={data.tags}
            onCreate={createSchedule}
          />
        )}
        {activeView === 'tags' && (
          <TagsView
            tags={data.allTags || data.tags}
            onCreate={createTag}
            onUpdate={updateTag}
            onDelete={deleteTag}
          />
        )}
        {activeView === 'reports' && (
          <ReportsView
            reports={data.reports}
            activeReport={activeReport}
            latestReport={latestReport}
            metrics={data.metrics}
            onGenerate={generateReport}
          />
        )}

      </section>

      <div className="composer-dock">
        {composerOpen ? (
          <CaptureBar
            value={chatText}
            state={chatState}
            suggestion={openTimeline ? `正在记录：${openTimeline.title}` : data.aiSuggestion}
            onChange={setChatText}
            onSubmit={submitChat}
          />
        ) : null}
        <button
          type="button"
          className="capture-fab"
          onClick={() => setComposerOpen((value) => !value)}
          aria-label={composerOpen ? '收起快速记录' : '打开快速记录'}
        >
          {composerOpen ? <X size={18} /> : <MessageSquareText size={18} />}
          <span>{composerOpen ? '收起' : '记录'}</span>
        </button>
      </div>

      {editor && (
        <EditorDrawer
          editor={editor}
          tags={data.tags}
          tasks={data.tasks}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
    </main>
  );
}

function CaptureBar({ value, state, suggestion, onChange, onSubmit }) {
  return (
    <section className="capture-shell">
      <form className="capture-form" onSubmit={onSubmit}>
        <MessageSquareText size={18} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="我开始做... / 做完了，休息一下 / 今天跳舞放松，记成高光"
        />
        <button type="submit" disabled={state === 'sending'}>
          <Send size={16} />
          <span>{state === 'sending' ? '保存中' : '发送'}</span>
        </button>
      </form>
      <p>{suggestion}</p>
    </section>
  );
}

function DateJump({ value, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(dateFromKey(value)));
  const [calendarMode, setCalendarMode] = useState('day');
  const selectedDate = dateFromKey(value);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const visibleYear = visibleMonth.getFullYear();
  const yearStart = Math.floor(visibleYear / 12) * 12;
  const yearOptions = Array.from({ length: 12 }, (_, index) => yearStart + index);
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  useEffect(() => {
    setVisibleMonth(startOfMonth(dateFromKey(value)));
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function selectDate(date) {
    onChange(localDateKey(date));
    setOpen(false);
    setCalendarMode('day');
  }

  function moveCalendar(offset) {
    if (calendarMode === 'day') setVisibleMonth(addMonths(visibleMonth, offset));
    if (calendarMode === 'month') setVisibleMonth(addYears(visibleMonth, offset));
    if (calendarMode === 'year') setVisibleMonth(addYears(visibleMonth, offset * 12));
  }

  function selectMonth(monthIndex) {
    setVisibleMonth(new Date(visibleYear, monthIndex, 1));
    setCalendarMode('day');
  }

  function selectYear(year) {
    setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1));
    setCalendarMode('month');
  }

  return (
    <div className="date-jump" ref={rootRef}>
      <button
        type="button"
        className="date-chip date-picker-button"
        onClick={() => {
          setOpen((value) => !value);
          setCalendarMode('day');
        }}
        title="切换日期"
        aria-expanded={open}
      >
        <CalendarDays size={16} />
        <span>{formatDateLabel(value)}</span>
      </button>
      {open ? (
        <section className="calendar-popover" aria-label="日期选择">
          <header className="calendar-head">
            <button type="button" onClick={() => moveCalendar(-1)} aria-label="上一页">
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="calendar-title"
              onClick={() => setCalendarMode(calendarMode === 'day' ? 'month' : 'year')}
            >
              {calendarMode === 'day' ? `${visibleYear} 年 ${visibleMonth.getMonth() + 1} 月` : null}
              {calendarMode === 'month' ? `${visibleYear} 年` : null}
              {calendarMode === 'year' ? `${yearStart} - ${yearStart + 11}` : null}
            </button>
            <button type="button" onClick={() => moveCalendar(1)} aria-label="下一页">
              <ChevronRight size={18} />
            </button>
          </header>

          {calendarMode === 'day' ? (
            <>
              <div className="calendar-weekdays" aria-hidden="true">
                {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarDays.map((date) => {
                  const dateKey = localDateKey(date);
                  const inMonth = date.getMonth() === visibleMonth.getMonth();
                  const isSelected = dateKey === value;
                  const isToday = dateKey === localDateKey(new Date());
                  return (
                    <button
                      type="button"
                      className={`${inMonth ? '' : 'muted'}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                      key={dateKey}
                      onClick={() => selectDate(date)}
                      aria-label={formatDateLabel(date)}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {calendarMode === 'month' ? (
            <div className="calendar-month-grid">
              {monthLabels.map((month, index) => (
                <button
                  type="button"
                  className={index === visibleMonth.getMonth() ? 'selected' : ''}
                  key={month}
                  onClick={() => selectMonth(index)}
                >
                  {month}
                </button>
              ))}
            </div>
          ) : null}

          {calendarMode === 'year' ? (
            <div className="calendar-year-grid">
              {yearOptions.map((year) => (
                <button
                  type="button"
                  className={year === visibleYear ? 'selected' : ''}
                  key={year}
                  onClick={() => selectYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : null}

          <footer className="calendar-actions">
            <button type="button" onClick={() => selectDate(new Date())}>今天</button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

function TodayView({ data, selectedDate, latestReport, onLogHabit, onEditTimeline, onOpenGoals, onOpenTasks, onOpenTimeline, onOpenHabits, onOpenSchedule, onUpdateTask }) {
  const topGoals = data.goals.filter(isCurrentGoal).slice(0, 3);
  const todayTimeline = data.timeline.filter((item) => isSameLocalDate(item.start_at, selectedDate));
  const currentTasks = data.tasks.filter((task) => taskCurrentStatusOrder.includes(task.status)).slice(0, 3);
  const todayHabits = data.habits.slice(0, 3);
  const upcoming = data.schedule.filter((event) => isSameLocalDate(event.start_at, selectedDate)).slice(0, 3);

  return (
    <section className="today-layout">
      <section className="panel today-timeline-panel">
        <SectionHeader eyebrow="当日事实" title="24 小时时间线" action="查看" onAction={onOpenTimeline} />
        <DayTimeline items={todayTimeline} selectedDate={selectedDate} onEdit={onEditTimeline} />
      </section>

      <div className="today-rows">
        <TodayRow eyebrow="日程" title="当日安排" onAction={onOpenSchedule}>
          <div className="today-row-items">
            {upcoming.map((event) => (
              <ScheduleRow key={event.event_id} event={event} />
            ))}
            {!upcoming.length ? <p className="muted-text">这一天还没有日程。</p> : null}
          </div>
        </TodayRow>

        <TodayRow eyebrow="习惯" title="今日习惯" onAction={onOpenHabits}>
          <div className="today-row-items">
            {todayHabits.map((habit) => (
              <HabitRow key={habit.habit_id} habit={habit} onLog={onLogHabit} />
            ))}
          </div>
        </TodayRow>

        <TodayRow eyebrow="任务" title="当前任务" onAction={onOpenTasks}>
          <div className="today-row-items">
            {currentTasks.map((task) => (
              <TaskCard key={task.task_id} task={task} compact onStatus={(status) => onUpdateTask(task.task_id, { status })} />
            ))}
            {!currentTasks.length ? <p className="muted-text">当前没有待推进任务。</p> : null}
          </div>
        </TodayRow>

        <TodayRow eyebrow="目标" title="当前目标" onAction={onOpenGoals}>
          <div className="today-row-items">
            {topGoals.map((goal) => (
              <GoalCard key={goal.goal_id} goal={goal} compact />
            ))}
          </div>
        </TodayRow>

        <TodayRow eyebrow="复盘" title={latestReport?.title || '报告'}>
          <p className="muted-text">{latestReport?.summary || '还没有报告。'}</p>
        </TodayRow>

        <TodayRow eyebrow="下一步" title="AI 提醒">
          <div className="today-row-items">
            {data.reminders.map((reminder) => (
              <div className="nudge" key={reminder.reminder_id}>
                <Flag size={15} />
                <div>
                  <strong>{reminder.title}</strong>
                  <span>{reminder.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </TodayRow>
      </div>
    </section>
  );
}

function TodayRow({ eyebrow, title, onAction, children }) {
  const heading = (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </>
  );

  return (
    <section className="today-row panel">
      <div className="today-row-heading">
        {onAction ? (
          <button type="button" className="today-row-link" onClick={onAction}>
            {heading}
          </button>
        ) : (
          <div>{heading}</div>
        )}
      </div>
      <div className="today-row-content">{children}</div>
    </section>
  );
}

function HabitsView({ habits, tags, onCreate, onLog }) {
  const makeDraft = () => ({
    title: '',
    cadence: 'daily',
    targetCount: 1,
    note: '',
    tagIds: tagIdsByKeys(tags, ['high_value']),
  });
  const [draft, setDraft] = useState(makeDraft);
  const [creating, setCreating] = useState(false);
  const doneCount = habits.filter((habit) => habit.todayLog?.status === 'done').length;

  function openCreate() {
    setDraft(makeDraft());
    setCreating(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    await onCreate(draft);
    setDraft(makeDraft());
    setCreating(false);
  }

  return (
    <section className="panel habits-layout">
      <SectionHeader eyebrow="今日进度" title={`${doneCount}/${habits.length} 已完成`} action="新建" onAction={openCreate} />
      <div className="habit-list">
        {habits.map((habit) => (
          <HabitRow key={habit.habit_id} habit={habit} onLog={onLog} />
        ))}
      </div>

      {creating ? (
        <FormModal title="新增习惯" onClose={() => setCreating(false)}>
          <form className="edit-form" onSubmit={submit}>
            <label>
              习惯
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：每天记录一句 timeline" />
            </label>
            <label>
              频率
              <select value={draft.cadence} onChange={(event) => setDraft({ ...draft, cadence: event.target.value })}>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
              </select>
            </label>
            <label>
              目标次数
              <input type="number" min="1" value={draft.targetCount} onChange={(event) => setDraft({ ...draft, targetCount: event.target.value })} />
            </label>
            <label>
              备注
              <textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="可选，写清楚这个习惯怎么算完成" />
            </label>
            <TagPicker tags={tags} selected={draft.tagIds} onChange={(tagIds) => setDraft({ ...draft, tagIds })} />
            <button className="primary-button" type="submit">
              <Plus size={16} />
              <span>添加习惯</span>
            </button>
          </form>
        </FormModal>
      ) : null}
    </section>
  );
}

function TasksView({ tasks, goals, tags, onCreate, onUpdate }) {
  const makeDraft = () => ({
    title: '',
    description: '',
    status: 'todo',
    priority: 3,
    dueDate: '',
    goalId: goals[0]?.goal_id || '',
    tagIds: tagIdsByKeys(tags, ['high_value']),
  });
  const [draft, setDraft] = useState(makeDraft);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('current');
  const [archiveStatus, setArchiveStatus] = useState('all');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const currentTasks = tasks.filter((task) => taskCurrentStatusOrder.includes(task.status));
  const archivedTasks = sortTasksByArchiveDate(tasks.filter((task) => taskArchiveStatusOrder.includes(task.status)));
  const query = archiveQuery.trim().toLowerCase();
  const activeCount = currentTasks.filter((task) => ['todo', 'doing'].includes(task.status)).length;
  const blockedCount = currentTasks.filter((task) => task.status === 'blocked').length;
  const weekDoneCount = tasks.filter((task) => task.status === 'done' && isThisWeek(task.completed_at || task.status_updated_at)).length;
  const recentDone = archivedTasks.filter((task) => task.status === 'done').slice(0, 5);
  const archiveCounts = taskArchiveStatusOrder.reduce((acc, status) => {
    acc[status] = archivedTasks.filter((task) => task.status === status).length;
    return acc;
  }, {});
  const filteredArchiveTasks = archivedTasks.filter((task) => {
    const statusMatches = archiveStatus === 'all' || task.status === archiveStatus;
    if (!statusMatches) return false;
    if (!query) return true;
    return [
      task.task_code,
      task.title,
      task.description,
      task.goal_title,
      ...(task.tags || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  });

  function openCreate() {
    setDraft(makeDraft());
    setCreating(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    await onCreate({
      ...draft,
      dueAt: draft.dueDate ? `${draft.dueDate}T18:00:00` : null,
      goalId: draft.goalId || null,
    });
    setDraft(makeDraft());
    setCreating(false);
  }

  async function updateTaskStatus(task, status) {
    await onUpdate(task.task_id, { status });
  }

  async function deleteTask() {
    if (!deleteTarget) return;
    await onUpdate(deleteTarget.task_id, { status: 'deleted' });
    setDeleteTarget(null);
  }

  return (
    <section className="panel tasks-layout">
      <SectionHeader eyebrow="行动状态" title={`${activeCount} 个推进中 · ${blockedCount} 个阻塞 · 本周完成 ${weekDoneCount}`} action="新建" onAction={openCreate} />
      <div className="task-page-tabs" aria-label="任务视图">
        <button type="button" className={mode === 'current' ? 'active' : ''} onClick={() => setMode('current')}>
          当前任务
        </button>
        <button type="button" className={mode === 'archive' ? 'active' : ''} onClick={() => setMode('archive')}>
          归档
        </button>
      </div>

      {mode === 'current' ? (
        <>
          <div className="task-board current-task-board">
            {taskCurrentStatusOrder.map((status) => {
              const group = currentTasks.filter((task) => task.status === status);
              return (
                <section className="task-column" key={status}>
                  <header>
                    <span>{taskStatusLabels[status]}</span>
                    <em>{group.length}</em>
                  </header>
                  <div className="task-stack">
                    {group.map((task) => (
                      <TaskCard
                        key={task.task_id}
                        task={task}
                        onStatus={(nextStatus) => updateTaskStatus(task, nextStatus)}
                        onDelete={() => setDeleteTarget(task)}
                      />
                    ))}
                    {!group.length ? <p className="muted-text">暂无</p> : null}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="recent-tasks">
            <header className="task-section-head">
              <div>
                <p className="eyebrow">最近完成</p>
                <h2>完成后先放这里</h2>
              </div>
              <button type="button" onClick={() => setMode('archive')}>查看全部归档</button>
            </header>
            <div className="task-archive-list compact">
              {recentDone.map((task) => (
                <TaskArchiveRow
                  key={task.task_id}
                  task={task}
                  onStatus={(nextStatus) => updateTaskStatus(task, nextStatus)}
                  onDelete={() => setDeleteTarget(task)}
                />
              ))}
              {!recentDone.length ? <p className="muted-text">最近还没有完成任务。</p> : null}
            </div>
          </section>
        </>
      ) : (
        <section className="task-archive-view">
          <header className="task-archive-head">
            <div>
              <p className="eyebrow">归档</p>
              <h2>{filteredArchiveTasks.length} 条历史任务</h2>
            </div>
            <input
              className="task-archive-search"
              value={archiveQuery}
              onChange={(event) => setArchiveQuery(event.target.value)}
              placeholder="搜索标题、目标或标签"
            />
          </header>
          <div className="task-archive-filters" aria-label="归档筛选">
            <button type="button" className={archiveStatus === 'all' ? 'active' : ''} onClick={() => setArchiveStatus('all')}>
              全部 <span>{archivedTasks.length}</span>
            </button>
            {taskArchiveStatusOrder.map((status) => (
              <button type="button" className={archiveStatus === status ? 'active' : ''} key={status} onClick={() => setArchiveStatus(status)}>
                {taskStatusLabels[status]} <span>{archiveCounts[status] || 0}</span>
              </button>
            ))}
          </div>
          <div className="task-archive-list">
            {filteredArchiveTasks.map((task) => (
              <TaskArchiveRow
                key={task.task_id}
                task={task}
                onStatus={task.status === 'deleted' ? null : (nextStatus) => updateTaskStatus(task, nextStatus)}
                onDelete={task.status === 'deleted' ? null : () => setDeleteTarget(task)}
              />
            ))}
            {!filteredArchiveTasks.length ? <p className="muted-text">没有符合条件的历史任务。</p> : null}
          </div>
        </section>
      )}

      {creating ? (
        <FormModal title="新增任务" onClose={() => setCreating(false)}>
          <form className="edit-form" onSubmit={submit}>
            <label>
              标题
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：同步 schema 文档" />
            </label>
            <label>
              说明
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="可选，写清楚交付物或完成标准" />
            </label>
            <div className="two-col">
              <label>
                状态
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  {taskCurrentStatusOrder.map((status) => (
                    <option value={status} key={status}>{taskStatusLabels[status]}</option>
                  ))}
                </select>
              </label>
              <label>
                优先级
                <input type="number" min="1" max="5" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })} />
              </label>
            </div>
            <label>
              截止日期
              <input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
            </label>
            <label>
              关联目标
              <select value={draft.goalId} onChange={(event) => setDraft({ ...draft, goalId: event.target.value })}>
                <option value="">不关联</option>
                {goals.map((goal) => (
                  <option value={goal.goal_id} key={goal.goal_id}>{goal.title}</option>
                ))}
              </select>
            </label>
            <TagPicker tags={tags} selected={draft.tagIds} onChange={(tagIds) => setDraft({ ...draft, tagIds })} />
            <button className="primary-button" type="submit">
              <Plus size={16} />
              <span>添加任务</span>
            </button>
          </form>
        </FormModal>
      ) : null}

      {deleteTarget ? (
        <DeleteTaskModal
          task={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={deleteTask}
        />
      ) : null}
    </section>
  );
}

function ScheduleView({ events, tags, onCreate }) {
  const makeDraft = () => ({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    time: '09:00',
    endTime: '',
    location: '',
    note: '',
    tagIds: [],
  });
  const [draft, setDraft] = useState(makeDraft);
  const [creating, setCreating] = useState(false);

  function openCreate() {
    setDraft(makeDraft());
    setCreating(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    await onCreate({
      title: draft.title,
      startAt: `${draft.date}T${draft.time}:00`,
      endAt: draft.endTime ? `${draft.date}T${draft.endTime}:00` : null,
      location: draft.location,
      note: draft.note,
      tagIds: draft.tagIds,
    });
    setDraft(makeDraft());
    setCreating(false);
  }

  return (
    <section className="panel schedule-layout">
      <SectionHeader eyebrow="日程" title="未来安排" action="新建" onAction={openCreate} />
      <div className="schedule-list">
        {events.map((event) => (
          <ScheduleRow key={event.event_id} event={event} />
        ))}
      </div>

      {creating ? (
        <FormModal title="新增日程" onClose={() => setCreating(false)}>
          <form className="edit-form" onSubmit={submit}>
            <label>
              标题
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：周五 14:00 和游老师开会" />
            </label>
            <label>
              日期
              <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            </label>
            <div className="two-col">
              <label>
                开始时间
                <input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
              </label>
              <label>
                结束时间
                <input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} />
              </label>
            </div>
            <label>
              地点
              <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="可选" />
            </label>
            <label>
              备注
              <textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="可选" />
            </label>
            <TagPicker tags={tags} selected={draft.tagIds} onChange={(tagIds) => setDraft({ ...draft, tagIds })} />
            <button className="primary-button" type="submit">
              <Plus size={16} />
              <span>添加日程</span>
            </button>
          </form>
        </FormModal>
      ) : null}
    </section>
  );
}

function TagsView({ tags, onCreate, onUpdate, onDelete }) {
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const tree = useMemo(() => buildTagTree(tags, true), [tags]);
  const parentOptions = useMemo(() => tags.filter((tag) => !tag.parent_tag_id), [tags]);

  function editTag(tag) {
    setDialog({
      mode: 'edit',
      tag,
      draft: {
        name: tag.name,
        tagKey: tag.tag_key,
        category: tag.category,
        parentTagId: tag.parent_tag_id || '',
        description: tag.description || '',
        sortOrder: tag.sort_order || 100,
        isActive: tag.is_active !== 0,
      },
    });
  }

  function createNew() {
    setDialog({ mode: 'create', draft: emptyTagDraft() });
  }

  function createChild(parent) {
    const siblings = tree.childrenByParent[parent.tag_id] || [];
    setDialog({
      mode: 'create',
      parent,
      draft: {
        ...emptyTagDraft(),
        category: parent.category,
        parentTagId: parent.tag_id,
        sortOrder: (parent.sort_order || 100) + siblings.length + 1,
      },
    });
  }

  async function submitTag(draft) {
    const payload = {
      name: draft.name,
      tagKey: draft.tagKey || makeTagKey(draft.name),
      category: draft.category,
      parentTagId: draft.parentTagId || null,
      description: draft.description,
      sortOrder: Number(draft.sortOrder || 100),
      isActive: draft.isActive,
    };
    if (dialog?.mode === 'edit') {
      await onUpdate(dialog.tag.tag_id, payload);
    } else {
      await onCreate(payload);
    }
    setDialog(null);
  }

  async function toggleTag(tag) {
    await onUpdate(tag.tag_id, {
      name: tag.name,
      category: tag.category,
      parentTagId: tag.parent_tag_id || null,
      description: tag.description || '',
      sortOrder: tag.sort_order || 100,
      isActive: tag.is_active === 0,
    });
  }

  return (
    <section className="panel tag-manager-page">
      <SectionHeader eyebrow="受控集合" title={`所有标签 · ${tags.length} 个`} action="新增一级" onAction={createNew} />
      <div className="tag-manager-list">
        {orderedTagCategories(tree.byCategory).map(([category, parents]) => (
          <section className="tag-tree-section" key={category}>
            <h2>{tagCategoryLabels[category] || category}</h2>
            <div className="tag-tree">
              {parents.map((tag) => {
                const children = tree.childrenByParent[tag.tag_id] || [];
                return (
                  <div className="tag-branch" key={tag.tag_id}>
                    <TagNode
                      tag={tag}
                      childCount={children.length}
                      onEdit={editTag}
                      onToggle={toggleTag}
                      onDelete={setDeleteTarget}
                      onCreateChild={createChild}
                    />
                    {children.map((child) => (
                      <TagNode
                        child
                        tag={child}
                        onEdit={editTag}
                        onToggle={toggleTag}
                        onDelete={setDeleteTarget}
                        key={child.tag_id}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {dialog ? (
        <TagFormModal
          dialog={dialog}
          parentOptions={parentOptions}
          tree={tree}
          onClose={() => setDialog(null)}
          onSubmit={submitTag}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteTagModal
          tag={deleteTarget}
          children={tree.childrenByParent[deleteTarget.tag_id] || []}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await onDelete(deleteTarget.tag_id);
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}

function FormModal({ eyebrow = '新建', title, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel form-modal" role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="form-modal-title">{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function TagFormModal({ dialog, parentOptions, tree, onClose, onSubmit }) {
  const [draft, setDraft] = useState(dialog.draft);
  const isEdit = dialog.mode === 'edit';
  const lockedParent = Boolean(dialog.parent);
  const selectedHasChildren = isEdit && Boolean(tree.childrenByParent[dialog.tag.tag_id]?.length);

  async function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    await onSubmit(draft);
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-panel tag-form-modal" role="dialog" aria-modal="true" aria-labelledby="tag-form-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{isEdit ? '编辑' : lockedParent ? '新增子标签' : '新建'}</p>
            <h2 id="tag-form-title">{isEdit ? '编辑标签' : lockedParent ? `给「${dialog.parent.name}」新增子标签` : '新增一级标签'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>

        <form className="edit-form" onSubmit={submit}>
          {isEdit ? (
            <label>
              Tag ID
              <input value={dialog.tag.tag_id} disabled />
            </label>
          ) : null}
          <label>
            名称
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：运动" />
          </label>
          <label>
            Key
            <input
              value={draft.tagKey}
              disabled={isEdit}
              onChange={(event) => setDraft({ ...draft, tagKey: makeTagKey(event.target.value) })}
              placeholder="例如：exercise"
            />
          </label>
          <label>
            类别
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              {tagCategoryOptions.map((category) => (
                <option value={category} key={category}>{tagCategoryLabels[category]}</option>
              ))}
            </select>
          </label>
          <label>
            父标签
            <select
              value={selectedHasChildren ? '' : draft.parentTagId}
              disabled={selectedHasChildren || lockedParent}
              onChange={(event) => setDraft({ ...draft, parentTagId: event.target.value })}
            >
              <option value="">一级标签</option>
              {parentOptions.filter((tag) => tag.tag_id !== dialog.tag?.tag_id).map((tag) => (
                <option value={tag.tag_id} key={tag.tag_id}>{tag.name} · {tagCategoryLabels[tag.category] || tag.category}</option>
              ))}
            </select>
            {selectedHasChildren ? <small className="form-hint">已有子标签的标签只能作为一级标签。</small> : null}
          </label>
          <div className="two-col">
            <label>
              排序
              <input type="number" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} />
            </label>
            <label>
              状态
              <select value={draft.isActive ? '1' : '0'} onChange={(event) => setDraft({ ...draft, isActive: event.target.value === '1' })}>
                <option value="1">启用</option>
                <option value="0">停用</option>
              </select>
            </label>
          </div>
          <label>
            说明
            <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="可选，说明什么时候使用这个标签" />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>取消</button>
            <button className="primary-button" type="submit">
              <Check size={16} />
              <span>{isEdit ? '保存标签' : '添加标签'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteTagModal({ tag, children, onClose, onConfirm }) {
  const usageCount = (tag.usage_count || 0) + children.reduce((sum, child) => sum + (child.usage_count || 0), 0);
  return (
    <div className="modal-backdrop">
      <section className="modal-panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-tag-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">二次确认</p>
            <h2 id="delete-tag-title">删除「{tag.name}」？</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>
        <p className="confirm-copy">
          删除后会清除 {usageCount} 条记录上的关联标签
          {children.length ? `，并同时删除 ${children.length} 个子标签` : ''}。
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="button" className="danger-button" onClick={onConfirm}>
            <Trash2 size={16} />
            <span>删除标签</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function TagNode({ tag, child = false, childCount = 0, onEdit, onToggle, onDelete, onCreateChild }) {
  const active = tag.is_active !== 0;
  return (
    <article className={`tag-node${child ? ' child' : ''}${active ? '' : ' disabled'}`}>
      <button type="button" className="tag-node-main" onClick={() => onEdit(tag)}>
        <strong>{tag.name}</strong>
        <span>{childCount ? `${tag.tag_key} · ${childCount} 个子标签` : tag.tag_key}</span>
      </button>
      <div className="tag-node-actions">
        {!child && onCreateChild ? (
          <button type="button" className="tag-node-add" onClick={() => onCreateChild(tag)} title={`给${tag.name}新增子标签`}>
            <Plus size={14} />
            <span>子标签</span>
          </button>
        ) : null}
        <button type="button" className="tag-node-action" onClick={() => onEdit(tag)}>
          <Edit3 size={14} />
          <span>编辑</span>
        </button>
        <button type="button" className="tag-status-toggle" onClick={() => onToggle(tag)}>
          {active ? '停用' : '启用'}
        </button>
        {!active ? (
          <button type="button" className="tag-delete-button" onClick={() => onDelete(tag)}>
            <Trash2 size={14} />
            <span>删除</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}

function GoalsView({ goals, tags, onCreate, onEdit }) {
  const makeDraft = () => ({
    title: '',
    level: 'month',
    successCriteria: '',
    tagIds: tagIdsByKeys(tags, ['high_value']),
  });
  const [draft, setDraft] = useState(makeDraft);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('current');
  const [archiveStatus, setArchiveStatus] = useState('all');
  const [archiveQuery, setArchiveQuery] = useState('');
  const currentGoals = goals.filter(isCurrentGoal);
  const archivedGoals = sortGoalsByPeriod(goals.filter((goal) => !isCurrentGoal(goal)));
  const query = archiveQuery.trim().toLowerCase();
  const monthCount = currentGoals.filter((goal) => goal.level === 'month').length;
  const yearCount = currentGoals.filter((goal) => goal.level === 'year').length;
  const archiveCounts = goalArchiveStatusOrder.reduce((acc, status) => {
    acc[status] = archivedGoals.filter((goal) => goalArchiveStatus(goal) === status).length;
    return acc;
  }, {});
  const filteredArchiveGoals = archivedGoals.filter((goal) => {
    const status = goalArchiveStatus(goal);
    const statusMatches = archiveStatus === 'all' || status === archiveStatus;
    if (!statusMatches) return false;
    if (!query) return true;
    return [
      goal.title,
      goal.success_criteria,
      levelLabels[goal.level],
      statusLabels[goal.status],
      ...(goal.tags || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  });

  function openCreate() {
    setDraft(makeDraft());
    setCreating(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    await onCreate(draft);
    setDraft(makeDraft());
    setCreating(false);
  }

  return (
    <section className="panel goals-layout">
      <SectionHeader eyebrow="当前聚焦" title={`${monthCount} 个月度 · ${yearCount} 个年度`} action="新建" onAction={openCreate} />
      <div className="goal-page-tabs" aria-label="目标视图">
        <button type="button" className={mode === 'current' ? 'active' : ''} onClick={() => setMode('current')}>
          当前目标
        </button>
        <button type="button" className={mode === 'archive' ? 'active' : ''} onClick={() => setMode('archive')}>
          归档
        </button>
      </div>

      {mode === 'current' ? (
        <>
          <div className="goal-board">
            {currentGoals.map((goal) => (
              <button type="button" className="goal-open" key={goal.goal_id} onClick={() => onEdit(goal)}>
                <GoalCard goal={goal} />
              </button>
            ))}
            {!currentGoals.length ? <p className="muted-text">当前周期还没有目标。</p> : null}
          </div>
          {archivedGoals.length ? (
            <section className="goal-archive-preview">
              <header className="goal-section-head">
                <div>
                  <p className="eyebrow">历史目标</p>
                  <h2>已归档 {archivedGoals.length} 个目标</h2>
                </div>
                <button type="button" onClick={() => setMode('archive')}>查看归档</button>
              </header>
            </section>
          ) : null}
        </>
      ) : (
        <section className="goal-archive-view">
          <header className="goal-archive-head">
            <div>
              <p className="eyebrow">归档</p>
              <h2>{filteredArchiveGoals.length} 个历史目标</h2>
            </div>
            <input
              className="goal-archive-search"
              value={archiveQuery}
              onChange={(event) => setArchiveQuery(event.target.value)}
              placeholder="搜索目标、标准或标签"
            />
          </header>
          <div className="goal-archive-filters" aria-label="目标归档筛选">
            <button type="button" className={archiveStatus === 'all' ? 'active' : ''} onClick={() => setArchiveStatus('all')}>
              全部 <span>{archivedGoals.length}</span>
            </button>
            {goalArchiveStatusOrder.map((status) => (
              <button type="button" className={archiveStatus === status ? 'active' : ''} key={status} onClick={() => setArchiveStatus(status)}>
                {goalArchiveStatusLabels[status]} <span>{archiveCounts[status] || 0}</span>
              </button>
            ))}
          </div>
          <div className="goal-archive-list">
            {filteredArchiveGoals.map((goal) => (
              <button type="button" className="goal-archive-open" key={goal.goal_id} onClick={() => onEdit(goal)}>
                <GoalArchiveRow goal={goal} />
              </button>
            ))}
            {!filteredArchiveGoals.length ? <p className="muted-text">没有符合条件的历史目标。</p> : null}
          </div>
        </section>
      )}

      {creating ? (
        <FormModal title="新增目标" onClose={() => setCreating(false)}>
          <form className="edit-form" onSubmit={submit}>
            <label>
              标题
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：稳定记录 20 天" />
            </label>
            <label>
              层级
              <select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })}>
                <option value="year">年度</option>
                <option value="month">月度</option>
                <option value="week">周度</option>
              </select>
            </label>
            <label>
              成功标准
              <textarea value={draft.successCriteria} onChange={(event) => setDraft({ ...draft, successCriteria: event.target.value })} placeholder="成功标准，可为空" />
            </label>
            <TagPicker tags={tags} selected={draft.tagIds} onChange={(tagIds) => setDraft({ ...draft, tagIds })} />
            <button className="primary-button" type="submit">
              <Plus size={16} />
              <span>添加目标</span>
            </button>
          </form>
        </FormModal>
      ) : null}
    </section>
  );
}

function TimelineView({ items, selectedDate, onEdit }) {
  const todayTimeline = items.filter((item) => isSameLocalDate(item.start_at, selectedDate));

  return (
    <section className="panel timeline-page">
      <SectionHeader eyebrow="时间线" title="24 小时日视图" />
      <DayTimeline items={todayTimeline} selectedDate={selectedDate} onEdit={onEdit} full />
    </section>
  );
}

function ReportsView({ reports, activeReport, latestReport, metrics, onGenerate }) {
  return (
    <section className="view-grid reports-layout">
      <div className="primary-column">
        <SectionHeader eyebrow="复盘" title="AI 总结" />
        <div className="segmented">
          {['day', 'week', 'month'].map((period) => (
            <button key={period} type="button" className={activeReport === period ? 'active' : ''} onClick={() => onGenerate(period)}>
              {periodLabels[period]}
            </button>
          ))}
        </div>
        <article className="report-focus">
          <span>{periodLabels[latestReport?.period_type] || '日报'}</span>
          <h2>{latestReport?.title || '还没有报告'}</h2>
          <p>{latestReport?.summary || '先从聊天框记录几条 timeline。'}</p>
        </article>
      </div>

      <aside className="context-column">
        <section className="panel">
          <SectionHeader eyebrow="指标" title="本周期" />
          <div className="metric-grid">
            <Metric label="记录时长" value={`${metrics.trackedHours}h`} />
            <Metric label="质量" value={metrics.averageQuality || '-'} />
            <Metric label="完成任务" value={metrics.completedTasks} />
            <Metric label="阻塞任务" value={metrics.blockedTasks} />
            <Metric label="高光" value={metrics.moments} />
            <Metric label="习惯" value={metrics.habitsDoneToday} />
            <Metric label="日程" value={metrics.upcomingEvents} />
          </div>
        </section>
        <section className="panel">
          <SectionHeader eyebrow="历史" title="最近报告" />
          <div className="stack">
            {reports.map((report) => (
              <article className="mini-report" key={report.report_id}>
                <strong>{report.title}</strong>
                <span>{report.generated_at}</span>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

function TaskCard({ task, onStatus, onDelete, compact = false }) {
  return (
    <article className={`task-card ${task.status}${compact ? ' compact' : ''}`}>
      <div className="task-topline">
        <span>{task.task_code}</span>
        <div className="task-actions">
          {onStatus ? (
            <TaskStatusMenu
              value={task.status}
              onChange={onStatus}
              label={`更新 ${task.title} 状态`}
            />
          ) : (
            <em>{taskStatusLabels[task.status] || task.status}</em>
          )}
          {onDelete ? (
            <button type="button" className="task-delete-trigger" onClick={onDelete} title="删除任务" aria-label={`删除 ${task.title}`}>
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
      </div>
      <strong title={task.title}>{task.title}</strong>
      <p title={task.description || '没有说明'}>{task.description || '没有说明'}</p>
      <div className="task-meta">
        {task.goal_title ? <span title={task.goal_title}>{task.goal_title}</span> : null}
        {task.due_at ? <span>{formatDate(task.due_at)} 截止</span> : null}
      </div>
      <TagPills tags={task.tags} />
    </article>
  );
}

function TaskArchiveRow({ task, onStatus, onDelete }) {
  return (
    <article className={`task-archive-row ${task.status}`}>
      <div className="task-archive-main">
        <div className="task-archive-title">
          <span>{task.task_code}</span>
          <strong title={task.title}>{task.title}</strong>
        </div>
        <p title={task.description || '没有说明'}>{task.description || '没有说明'}</p>
        <div className="task-meta">
          {task.goal_title ? <span title={task.goal_title}>{task.goal_title}</span> : null}
          <span>{formatArchiveDateLabel(task)}</span>
        </div>
        <TagPills tags={task.tags} />
      </div>
      <div className="task-actions">
        {onStatus ? (
          <TaskStatusMenu value={task.status} onChange={onStatus} label={`更新 ${task.title} 状态`} />
        ) : (
          <em className="task-status-static">{taskStatusLabels[task.status] || task.status}</em>
        )}
        {onDelete ? (
          <button type="button" className="task-delete-trigger" onClick={onDelete} title="删除任务" aria-label={`删除 ${task.title}`}>
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function DeleteTaskModal({ task, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-task-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">二次确认</p>
            <h2 id="delete-task-title">删除「{task.title}」？</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>
        <p className="confirm-copy">
          删除后任务会从当前看板移出，只保留在归档的删除筛选里。
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="button" className="danger-button" onClick={onConfirm}>
            <Trash2 size={16} />
            <span>删除任务</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function TaskStatusMenu({ value, onChange, label, statuses = taskWorkflowStatusOrder }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  function choose(status) {
    setOpen(false);
    if (status !== value) onChange(status);
  }

  return (
    <div className="task-status-menu" ref={menuRef}>
      <button
        type="button"
        className="task-status-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        <span>{taskStatusLabels[value] || value}</span>
        <ChevronDown size={13} />
      </button>
      {open ? (
        <div className="task-status-popover" role="menu" aria-label={label}>
          {statuses.map((status) => {
            const selected = status === value;
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={selected ? 'task-status-option active' : 'task-status-option'}
                key={status}
                onClick={() => choose(status)}
              >
                <span className="task-status-check">{selected ? <Check size={14} /> : null}</span>
                <span>{taskStatusLabels[status]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function HabitRow({ habit, onLog, readonly = false }) {
  const doneToday = habit.todayLog?.status === 'done';
  return (
    <article className={doneToday ? 'habit-row done' : 'habit-row'}>
      <button
        type="button"
        className="check-button"
        disabled={readonly || !onLog}
        onClick={() => onLog?.(habit.habit_id, { status: doneToday ? 'skipped' : 'done' })}
        title={doneToday ? '取消完成' : '标记完成'}
        aria-label={doneToday ? `取消完成 ${habit.title}` : `标记完成 ${habit.title}`}
      >
        <Check size={15} />
      </button>
      <div className="habit-main">
        <div className="row-title">
          <strong title={habit.title}>{habit.title}</strong>
          <span className="habit-count">{cadenceLabels[habit.cadence] || habit.cadence} · {habit.weekCount}/{habit.target_count}</span>
        </div>
        <p title={habit.note}>{habit.note}</p>
        <TagPills tags={habit.tags} quality={habit.todayLog?.quality} />
      </div>
    </article>
  );
}

function ScheduleRow({ event }) {
  return (
    <article className="schedule-row">
      <div className="schedule-time">
        <span>{formatDate(event.start_at)}</span>
        <strong>{formatScheduleTimeRange(event)}</strong>
      </div>
      <div>
        <div className="row-title">
          <strong>{event.title}</strong>
        </div>
        <p>{[event.location, event.note].filter(Boolean).join(' · ')}</p>
        <TagPills tags={event.tags} />
      </div>
    </article>
  );
}

function DayTimeline({ items, selectedDate, onEdit, full = false }) {
  const height = full ? 1180 : 650;
  const sortedItems = [...items].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const timelineEvents = layoutDayEvents(sortedItems, height, full, selectedDate);
  const hours = Array.from({ length: 13 }, (_, index) => index * 2);
  const now = new Date();
  const showNow = isSameLocalDate(now, selectedDate);

  return (
    <div className={full ? 'day-timeline full' : 'day-timeline'} style={{ '--day-height': `${timelineEvents.trackHeight}px` }}>
      <div className="day-hours" aria-hidden="true">
        {hours.map((hour) => (
          <div className="day-hour" style={{ top: `${(hour / 24) * height}px` }} key={hour}>
            <span>{formatHour(hour)}</span>
            <i />
          </div>
        ))}
      </div>

      {showNow ? (
        <div className="day-now" style={{ top: `${(minutesOfDay(now) / 1440) * height}px` }}>
          <span>现在</span>
        </div>
      ) : null}

      {!sortedItems.length ? <div className="day-empty">这一天还没有时间线记录。</div> : null}

      {timelineEvents.items.map(({ item, top, height: eventHeight, isShort }) => {
        const visibleTags = full ? item.tags : [];

        return (
          <button
            type="button"
            className={`${item.end_at ? 'day-event' : 'day-event live'}${isShort ? ' short' : ''}`}
            style={{ top: `${top}px`, height: `${eventHeight}px` }}
            key={item.timeline_id}
            onClick={() => onEdit(item)}
          >
            <span className="day-event-time">
              {formatTime(item.start_at)} - {item.end_at ? formatTime(item.end_at) : '现在'}
            </span>
            <div className="row-title">
              <strong>{item.title}</strong>
              <Edit3 size={14} />
            </div>
            {full && item.task_code ? <span className="day-event-link">{item.task_code} · {item.task_title}</span> : null}
            {full ? <p>{item.description}</p> : null}
            <TagPills tags={visibleTags} quality={full ? item.quality : null} />
          </button>
        );
      })}
    </div>
  );
}

function GoalCard({ goal, compact = false }) {
  return (
    <article className={compact ? 'goal-card compact' : 'goal-card'}>
      <div className="goal-topline">
        <span>{levelLabels[goal.level] || goal.level}</span>
        <em>{formatGoalPeriod(goal)}</em>
      </div>
      <strong title={goal.title}>{goal.title}</strong>
      <p title={goal.success_criteria || '还没有成功标准'}>{goal.success_criteria || '还没有成功标准'}</p>
      <TagPills tags={goal.tags} />
      <div className="progress-track">
        <i style={{ width: `${goal.progress || 12}%` }} />
      </div>
    </article>
  );
}

function GoalArchiveRow({ goal }) {
  const archiveStatus = goalArchiveStatus(goal);
  return (
    <article className={`goal-archive-row ${archiveStatus}`}>
      <div className="goal-archive-main">
        <div className="goal-archive-title">
          <span>{levelLabels[goal.level] || goal.level}</span>
          <strong title={goal.title}>{goal.title}</strong>
        </div>
        <p title={goal.success_criteria || '还没有成功标准'}>{goal.success_criteria || '还没有成功标准'}</p>
        <div className="task-meta">
          <span>{goalArchiveStatusLabels[archiveStatus]}</span>
          <span>{formatGoalPeriod(goal)}</span>
        </div>
        <TagPills tags={goal.tags} />
      </div>
      <div className="progress-track">
        <i style={{ width: `${goal.progress || 12}%` }} />
      </div>
    </article>
  );
}

function EditorDrawer({ editor, tags, tasks = [], onClose, onSave }) {
  const isGoal = editor.type === 'goal';
  const item = editor.item;
  const [draft, setDraft] = useState(() => {
    if (isGoal) {
      return {
        title: item.title,
        level: item.level,
        status: item.status,
        priority: item.priority,
        successCriteria: item.success_criteria || '',
        tagIds: item.tagIds || [],
      };
    }
    return {
      title: item.title,
      description: item.description || '',
      kind: item.kind,
      quality: item.quality || '',
      taskId: item.task_id || '',
      tagIds: item.tagIds || [],
    };
  });

  return (
    <aside className="drawer">
      <div className="drawer-backdrop" onClick={onClose} />
      <section className="drawer-panel">
        <header>
          <div>
            <p className="eyebrow">编辑</p>
            <h2>{isGoal ? '目标' : '时间线'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>

        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <label>
            标题
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>

          {isGoal ? (
            <>
              <label>
                层级
                <select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })}>
                  <option value="year">年度</option>
                  <option value="month">月度</option>
                  <option value="week">周度</option>
                </select>
              </label>
              <label>
                状态
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  <option value="active">进行中</option>
                  <option value="paused">暂停</option>
                  <option value="done">完成</option>
                  <option value="abandoned">放弃</option>
                </select>
              </label>
              <label>
                成功标准
                <textarea value={draft.successCriteria} onChange={(event) => setDraft({ ...draft, successCriteria: event.target.value })} />
              </label>
            </>
          ) : (
            <>
              <label>
                描述
                <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </label>
              <label>
                质量
                <select value={draft.quality} onChange={(event) => setDraft({ ...draft, quality: event.target.value })}>
                  <option value="">不评分</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </label>
              <label>
                关联任务
                <select value={draft.taskId} onChange={(event) => setDraft({ ...draft, taskId: event.target.value })}>
                  <option value="">不关联</option>
                  {tasks.filter((task) => task.status !== 'deleted').map((task) => (
                    <option value={task.task_id} key={task.task_id}>{task.task_code} · {task.title}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          <TagPicker tags={tags} selected={draft.tagIds} onChange={(tagIds) => setDraft({ ...draft, tagIds })} />

          <button className="primary-button" type="submit">
            <Check size={16} />
            <span>保存修改</span>
          </button>
        </form>
      </section>
    </aside>
  );
}

function TagPicker({ tags, selected, onChange }) {
  const tree = useMemo(() => buildTagTree(tags), [tags]);
  const [expandedParentId, setExpandedParentId] = useState('');
  const selectedChildParentKey = useMemo(() => {
    const selectedSet = new Set(selected);
    return Object.entries(tree.childrenByParent).find(([, children]) => (
      children.some((child) => selectedSet.has(child.tag_id))
    ))?.[0] || '';
  }, [selected, tree]);

  useEffect(() => {
    if (selectedChildParentKey) setExpandedParentId(selectedChildParentKey);
  }, [selectedChildParentKey]);

  function toggleParent(tag) {
    const children = tree.childrenByParent[tag.tag_id] || [];
    const childIds = children.map((child) => child.tag_id);
    if (selected.includes(tag.tag_id)) {
      onChange(selected.filter((tagId) => tagId !== tag.tag_id && !childIds.includes(tagId)));
      if (expandedParentId === tag.tag_id) setExpandedParentId('');
    } else {
      onChange([...selected, tag.tag_id]);
      if (children.length) setExpandedParentId(tag.tag_id);
    }
  }

  function toggleChild(parent, child) {
    if (selected.includes(child.tag_id)) {
      onChange(selected.filter((tagId) => tagId !== child.tag_id));
    } else {
      onChange([...new Set([...selected, parent.tag_id, child.tag_id])]);
    }
  }

  function isParentSelected(parent) {
    const childIds = (tree.childrenByParent[parent.tag_id] || []).map((child) => child.tag_id);
    return selected.includes(parent.tag_id) || childIds.some((tagId) => selected.includes(tagId));
  }

  return (
    <fieldset className="tag-picker">
      <legend>标签</legend>
      {orderedTagCategories(tree.byCategory).map(([category, parents]) => {
        const expandedParent = parents.find((tag) => (
          expandedParentId === tag.tag_id
          && isParentSelected(tag)
          && (tree.childrenByParent[tag.tag_id] || []).length > 0
        ));
        const expandedChildren = expandedParent ? tree.childrenByParent[expandedParent.tag_id] || [] : [];
        const childListId = expandedParent ? `tag-children-${expandedParent.tag_id}` : undefined;

        return (
          <div className="tag-group" key={category}>
            <span className="tag-group-label">{tagCategoryLabels[category] || category}</span>
            <div className="tag-parent-list">
              {parents.map((tag) => {
                const children = tree.childrenByParent[tag.tag_id] || [];
                const open = expandedParent?.tag_id === tag.tag_id;
                return (
                  <div className={open ? 'tag-parent-block open' : 'tag-parent-block'} key={tag.tag_id}>
                    <button
                      type="button"
                      className={selected.includes(tag.tag_id) ? 'tag-chip selected' : 'tag-chip'}
                      onClick={() => toggleParent(tag)}
                      aria-expanded={children.length ? open : undefined}
                      aria-controls={children.length ? childListId : undefined}
                    >
                      {tag.name}
                    </button>
                  </div>
                );
              })}
            </div>
            {expandedParent ? (
              <div className="tag-child-list" id={childListId}>
                {expandedChildren.map((child) => (
                  <button
                    type="button"
                    className={selected.includes(child.tag_id) ? 'tag-chip child selected' : 'tag-chip child'}
                    key={child.tag_id}
                    onClick={() => toggleChild(expandedParent, child)}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

function SectionHeader({ eyebrow, title, action, onAction }) {
  return (
    <header className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </header>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TagPills({ tags, quality }) {
  if (!tags?.length && !quality) return null;
  return (
    <div className="tag-pills">
      {tags.map((tag) => (
        <em key={tag}>{tag}</em>
      ))}
      {quality ? <em>Q{quality}</em> : null}
    </div>
  );
}

function buildTagTree(tags, includeInactive = false) {
  const activeTags = includeInactive ? tags : tags.filter((tag) => tag.is_active !== 0);
  const tagById = new Map(activeTags.map((tag) => [tag.tag_id, tag]));
  const childrenByParent = activeTags.reduce((acc, tag) => {
    if (tag.parent_tag_id && tagById.has(tag.parent_tag_id)) {
      acc[tag.parent_tag_id] ||= [];
      acc[tag.parent_tag_id].push(tag);
    }
    return acc;
  }, {});
  const byCategory = activeTags.reduce((acc, tag) => {
    if (!tag.parent_tag_id || !tagById.has(tag.parent_tag_id)) {
      acc[tag.category] ||= [];
      acc[tag.category].push(tag);
    }
    return acc;
  }, {});

  Object.values(childrenByParent).forEach(sortTags);
  Object.values(byCategory).forEach(sortTags);
  return { byCategory, childrenByParent };
}

function sortTags(tags) {
  tags.sort((a, b) => (
    (a.sort_order || 100) - (b.sort_order || 100)
    || a.name.localeCompare(b.name, 'zh-CN')
  ));
}

function orderedTagCategories(byCategory) {
  return Object.entries(byCategory).sort(([a], [b]) => (
    (tagCategoryRank.get(a) ?? 99) - (tagCategoryRank.get(b) ?? 99)
    || a.localeCompare(b)
  ));
}

function emptyTagDraft() {
  return {
    name: '',
    tagKey: '',
    category: 'activity_type',
    parentTagId: '',
    description: '',
    sortOrder: 100,
    isActive: true,
  };
}

function tagIdsByKeys(tags, keys) {
  const keySet = new Set(keys);
  return tags.filter((tag) => keySet.has(tag.tag_key)).map((tag) => tag.tag_id);
}

function makeTagKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/[\s-]+/g, '_')
    .slice(0, 40);
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function minutesOfDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function clampMinute(value) {
  return Math.min(1440, Math.max(0, value));
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function addYears(date, offset) {
  return new Date(date.getFullYear() + offset, date.getMonth(), 1);
}

function buildCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

function layoutDayEvents(items, height, full) {
  const now = new Date();
  const minHeight = full ? 86 : 58;
  const gap = full ? 10 : 8;
  let bottom = -gap;

  const laidOutItems = items.map((item) => {
    const start = clampMinute(minutesOfDay(item.start_at));
    let end = item.end_at ? clampMinute(minutesOfDay(item.end_at)) : clampMinute(minutesOfDay(now));
    if (end <= start) end = item.end_at ? Math.min(1440, start + 15) : 1440;

    const duration = end - start;
    const naturalHeight = Math.max((duration / 1440) * height, minHeight);
    const actualTop = (start / 1440) * height;
    const top = Math.max(actualTop, bottom + gap);

    bottom = top + naturalHeight;

    return {
      item,
      top,
      height: naturalHeight,
      isShort: duration < 45,
    };
  });

  return {
    items: laidOutItems,
    trackHeight: Math.max(height, bottom),
  };
}

function isSameLocalDate(value, target = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const targetDate = typeof target === 'string' ? dateFromKey(target) : target;
  return (
    date.getFullYear() === targetDate.getFullYear()
    && date.getMonth() === targetDate.getMonth()
    && date.getDate() === targetDate.getDate()
  );
}

function isThisWeek(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= startOfWeek(new Date());
}

function startOfWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - mondayOffset);
  date.setHours(0, 0, 0, 0);
  return date;
}

function taskArchiveTime(task) {
  return task.completed_at || task.status_updated_at || task.created_at;
}

function sortTasksByArchiveDate(tasks) {
  return [...tasks].sort((a, b) => new Date(taskArchiveTime(b)) - new Date(taskArchiveTime(a)));
}

function isCurrentGoal(goal) {
  return ['active', 'paused'].includes(goal.status) && !isPastDate(goal.period_end);
}

function goalArchiveStatus(goal) {
  if (goal.status === 'done') return 'done';
  if (goal.status === 'abandoned') return 'abandoned';
  return 'expired';
}

function sortGoalsByPeriod(goals) {
  return [...goals].sort((a, b) => new Date(b.period_end || b.created_at) - new Date(a.period_end || a.created_at));
}

function isPastDate(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date < new Date();
}

function formatArchiveDate(task) {
  const value = taskArchiveTime(task);
  return value ? formatDate(value) : '未知日期';
}

function formatArchiveDateLabel(task) {
  const action = task.status === 'done' ? '完成' : task.status === 'deleted' ? '删除' : '归档';
  return `${formatArchiveDate(task)} ${action}`;
}

function formatGoalPeriod(goal) {
  const start = formatDate(goal.period_start);
  const end = formatDate(goal.period_end);
  return start && end ? `${start} - ${end}` : '';
}

function formatScheduleTimeRange(event) {
  return event.end_at ? `${formatTime(event.start_at)} - ${formatTime(event.end_at)}` : formatTime(event.start_at);
}

function formatDateLabel(value) {
  const date = typeof value === 'string' ? dateFromKey(value) : new Date(value);
  return date.toLocaleDateString('zh-CN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

createRoot(document.getElementById('root')).render(<App />);
