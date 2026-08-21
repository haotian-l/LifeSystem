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
  Images,
  ListChecks,
  ListTodo,
  Plus,
  RefreshCw,
  Repeat2,
  Sparkles,
  Tags,
  Target,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import './styles.css';

const primaryViews = [
  { id: 'week', label: '本周', icon: CalendarDays },
  { id: 'timeline', label: '时间线', icon: ListChecks },
  { id: 'tasks', label: '任务', icon: ListTodo },
  { id: 'goals', label: '目标', icon: Target },
];

const secondaryViews = [
  { id: 'habits', label: '习惯', icon: Repeat2 },
  { id: 'schedule', label: '日程', icon: CalendarClock },
  { id: 'tags', label: '标签', icon: Tags },
  { id: 'reports', label: '复盘', icon: Sparkles },
  { id: 'moments', label: '高光', icon: Images },
  { id: 'people-relations', label: '人物', icon: UsersRound },
];

const views = [...primaryViews, ...secondaryViews];

const levelLabels = { day: '每日', week: '每周', month: '每月', year: '每年' };
const goalLevelOrder = ['day', 'week', 'month', 'year'];
const statusLabels = { active: '进行中', paused: '暂停', done: '完成', not_done: '未完成', abandoned: '放弃', deleted: '删除', planned: '计划中', cancelled: '取消', missed: '错过' };
const taskStatusLabels = { todo: '待做', doing: '进行中', blocked: '阻塞', done: '完成', abandoned: '放弃', deleted: '删除' };
const taskCurrentStatusOrder = ['doing', 'todo', 'blocked'];
const taskWorkflowStatusOrder = ['doing', 'todo', 'blocked', 'done', 'abandoned'];
const taskArchiveStatusOrder = ['done', 'abandoned', 'deleted'];
const goalWorkflowStatusOrder = ['active', 'done', 'not_done', 'abandoned'];
const goalArchiveStatusLabels = { done: '完成', not_done: '未完成', abandoned: '放弃' };
const goalArchiveStatusOrder = ['done', 'not_done', 'abandoned'];
const goalViewOrder = ['all', ...goalLevelOrder];
const goalTabLabels = { all: '全部', day: '日目标', week: '周目标', month: '月目标', year: '年目标' };
const goalFocusTitles = { all: '全部目标', day: '今日目标', week: '本周目标', month: '本月目标', year: '今年目标' };
const periodLabels = { day: '日报', week: '周报', month: '月报' };
const reportTargetLabels = { day: '昨天', week: '上周', month: '上个月' };
const reviewTypeLabels = { day: '日复盘', week: '周复盘', month: '月复盘', topic: '主题复盘' };
const reviewTypeOrder = ['day', 'week', 'month', 'topic'];
const momentRangeLabels = { month: '本月', week: '本周', year: '今年', all: '全部', custom: '自定义' };
const momentRangeOrder = ['year', 'month', 'week', 'all', 'custom'];
const peopleRelationSources = [
  { id: 'all', label: '全部' },
  { id: 'timeline', label: '时间线' },
  { id: 'task', label: '任务' },
  { id: 'schedule', label: '日程' },
  { id: 'moment', label: '高光' },
  { id: 'review', label: '复盘' },
  { id: 'goal', label: '目标' },
  { id: 'habit', label: '习惯' },
  { id: 'reminder', label: '提醒' },
];
const personRelationshipLabels = {
  mentor: '导师',
  teacher: '老师',
  friend: '朋友',
  family: '家人',
  colleague: '同事',
  partner: '伙伴',
  client: '客户',
};
const personLinkRoleLabels = {
  participant: '参与者',
  owner: '负责人',
  collaborator: '协作者',
  mentioned: '被提到',
  requester: '提出者',
  reviewer: '评审者',
  audience: '面向对象',
};
const tagCategoryLabels = {
  activity_type: '活动',
  work_mode: '工作模式',
  value_signal: '价值',
  life_area: '领域',
};
const tagCategoryOptions = ['activity_type', 'work_mode', 'value_signal', 'life_area'];
const tagCategoryRank = new Map(tagCategoryOptions.map((category, index) => [category, index]));

const api = {
  dashboard: () => request('/api/dashboard'),
  createGoal: (payload) => request('/api/goals', { method: 'POST', body: JSON.stringify(payload) }),
  updateGoal: (goalId, payload) => request(`/api/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateTimeline: (timelineId, payload) => request(`/api/timeline/${timelineId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createTask: (payload) => request('/api/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateTask: (taskId, payload) => request(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  restoreTask: (taskId) => request(`/api/tasks/${taskId}/restore`, { method: 'POST' }),
  setTaskDayPlan: (taskId, payload) => request(`/api/tasks/${taskId}/day-plan`, { method: 'PUT', body: JSON.stringify(payload) }),
  createTag: (payload) => request('/api/tags', { method: 'POST', body: JSON.stringify(payload) }),
  updateTag: (tagId, payload) => request(`/api/tags/${encodeURIComponent(tagId)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTag: (tagId) => request(`/api/tags/${encodeURIComponent(tagId)}`, { method: 'DELETE' }),
  createHabit: (payload) => request('/api/habits', { method: 'POST', body: JSON.stringify(payload) }),
  updateHabit: (habitId, payload) => request(`/api/habits/${habitId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  logHabit: (habitId, payload) => request(`/api/habits/${habitId}/log`, { method: 'POST', body: JSON.stringify(payload) }),
  createSchedule: (payload) => request('/api/schedule', { method: 'POST', body: JSON.stringify(payload) }),
  updateSchedule: (eventId, payload) => request(`/api/schedule/${eventId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateReview: (reviewId, payload) => request(`/api/reviews/${reviewId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createMoment: (payload) => request('/api/moments', { method: 'POST', body: JSON.stringify(payload) }),
  updateMoment: (momentId, payload) => request(`/api/moments/${momentId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMoment: (momentId) => request(`/api/moments/${momentId}`, { method: 'DELETE' }),
  uploadMomentImage: (payload) => request('/api/moment-images', { method: 'POST', body: JSON.stringify(payload) }),
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
  const [activeView, setActiveView] = useState('week');
  const [loadError, setLoadError] = useState('');
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

  async function updateGoal(goalId, payload) {
    setData(await api.updateGoal(goalId, payload));
  }

  async function createTask(payload) {
    setData(await api.createTask(payload));
  }

  async function updateTask(taskId, payload) {
    setData(await api.updateTask(taskId, payload));
  }

  async function restoreTask(taskId) {
    setData(await api.restoreTask(taskId));
  }

  async function setTaskDayPlan(taskId, payload) {
    setData(await api.setTaskDayPlan(taskId, payload));
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

  async function updateReview(reviewId, payload) {
    setData(await api.updateReview(reviewId, payload));
  }

  async function createHabit(payload) {
    setData(await api.createHabit(payload));
  }

  async function updateHabit(habitId, payload) {
    setData(await api.updateHabit(habitId, payload));
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

  async function createMoment(payload) {
    setData(await api.createMoment(payload));
  }

  async function updateMoment(momentId, payload) {
    setData(await api.updateMoment(momentId, payload));
  }

  async function deleteMoment(momentId) {
    setData(await api.deleteMoment(momentId));
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

  const latestReportRange = completedReviewRange(activeReport);
  const latestReport = data.reports.find((report) => report.period_type === activeReport && reviewOverlapsRange(report, latestReportRange)) || null;
  const activeViewTitle = activeView === 'week'
    ? weekRelativeLabel(selectedDate)
    : views.find((view) => view.id === activeView)?.label;

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="app-navigation">
          <button type="button" className="app-brand" onClick={() => setActiveView('week')}>
            个人工作台
          </button>
          <AppNavigation activeView={activeView} onSelect={setActiveView} />
        </header>

        <header className="topbar">
          <div>
            <p className="eyebrow">{activeView === 'week' ? formatWeekRange(selectedDate) : '个人工作台'}</p>
            <h1>{activeViewTitle}</h1>
          </div>
          {['week', 'timeline'].includes(activeView) ? (
            <WeekJump value={selectedDate} onChange={setSelectedDate} />
          ) : (
            <DateJump value={selectedDate} onChange={setSelectedDate} />
          )}
        </header>

        {activeView === 'week' && (
          <WeekView
            data={data}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onCreateTask={createTask}
            onUpdateTask={updateTask}
            onRestoreTask={restoreTask}
            onSetTaskDayPlan={setTaskDayPlan}
            onEditTimeline={(item) => setEditor({ type: 'timeline', item })}
            onOpenTimeline={() => setActiveView('timeline')}
            onOpenTasks={() => setActiveView('tasks')}
          />
        )}
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
            onUpdate={updateGoal}
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
        {activeView === 'people-relations' && (
          <PeopleRelationsView people={data.people || []} />
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
            habitLogs={data.habitLogs || []}
            tags={data.tags}
            onCreate={createHabit}
            onUpdate={updateHabit}
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
            reviews={data.reviews || []}
            tags={data.tags}
            activeReport={activeReport}
            latestReport={latestReport}
            onSelectReport={setActiveReport}
            onUpdateReview={updateReview}
          />
        )}
        {activeView === 'moments' && (
          <MomentsView
            moments={data.moments || []}
            tags={data.tags}
            onCreate={createMoment}
            onUpdate={updateMoment}
            onDelete={deleteMoment}
            onUploadImage={api.uploadMomentImage}
          />
        )}

      </section>

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

function AppNavigation({ activeView, onSelect }) {
  const rootRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const secondaryActive = secondaryViews.some((view) => view.id === activeView);

  useEffect(() => {
    if (!moreOpen) return undefined;
    function closeOnOutside(event) {
      if (!rootRef.current?.contains(event.target)) setMoreOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [moreOpen]);

  function select(viewId) {
    onSelect(viewId);
    setMoreOpen(false);
  }

  return (
    <nav className="top-navigation" aria-label="主视图" ref={rootRef}>
      {primaryViews.map((view) => {
        const Icon = view.icon;
        return (
          <button
            type="button"
            key={view.id}
            className={activeView === view.id ? 'active' : ''}
            onClick={() => select(view.id)}
          >
            <Icon size={16} />
            <span>{view.label}</span>
          </button>
        );
      })}
      <div className="more-navigation">
        <button
          type="button"
          className={secondaryActive ? 'active' : ''}
          onClick={() => setMoreOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          <span>{secondaryActive ? views.find((view) => view.id === activeView)?.label : '更多'}</span>
          <ChevronDown size={14} />
        </button>
        {moreOpen ? (
          <div className="more-navigation-menu" role="menu">
            {secondaryViews.map((view) => {
              const Icon = view.icon;
              return (
                <button type="button" role="menuitem" key={view.id} onClick={() => select(view.target || view.id)}>
                  <Icon size={16} />
                  <span>{view.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function WeekJump({ value, onChange }) {
  const label = weekRelativeLabel(value);

  function move(offset) {
    const next = startOfWeek(dateFromKey(value));
    next.setDate(next.getDate() + offset * 7);
    onChange(localDateKey(next));
  }

  return (
    <div className="week-jump" aria-label="切换周">
      <button type="button" className="week-arrow" onClick={() => move(-1)} aria-label="上一周">
        <ChevronLeft size={17} />
      </button>
      <button
        type="button"
        className="week-current"
        onClick={() => onChange(localDateKey(new Date()))}
        title={label === '本周' ? '当前周' : '返回本周'}
      >
        {label}
      </button>
      <button type="button" className="week-arrow" onClick={() => move(1)} aria-label="下一周">
        <ChevronRight size={17} />
      </button>
    </div>
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

function WeekView({ data, selectedDate, onSelectDate, onCreateTask, onUpdateTask, onRestoreTask, onSetTaskDayPlan, onEditTimeline, onOpenTimeline, onOpenTasks }) {
  const [composerDate, setComposerDate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const days = weekDates(selectedDate);
  const dayKeys = new Set(days.map(localDateKey));
  const weekStartKey = localDateKey(days[0]);
  const weekEndKey = localDateKey(days[6]);
  const selectedKey = selectedDate;
  const selectedDay = dateFromKey(selectedKey);
  const weekTasks = data.tasks.filter((task) => (
    task.status !== 'deleted'
    && taskWeekDisplayDates(task).some((dateKey) => dateKey >= weekStartKey && dateKey <= weekEndKey)
  ));
  const incompleteTasks = data.tasks.filter((task) => taskCurrentStatusOrder.includes(task.status));
  const selectedCompletedTasks = data.tasks.filter((task) => (
    task.status === 'done' && taskWeekDisplayDates(task).includes(selectedKey)
  ));
  const selectedAbandonedTasks = data.tasks.filter((task) => (
    task.status === 'abandoned' && isSameLocalDate(task.status_updated_at, selectedKey)
  ));
  const selectedPlannedCount = incompleteTasks.filter((task) => (task.plannedDates || []).includes(selectedKey)).length;
  const worklistTasks = sortWeekTaskList([...incompleteTasks, ...selectedCompletedTasks, ...selectedAbandonedTasks]);
  const doneCount = weekTasks.filter((task) => task.status === 'done').length;
  const plannedCount = weekTasks.filter((task) => (
    (task.plannedDates || []).some((dateKey) => dateKey >= weekStartKey && dateKey <= weekEndKey)
  )).length;
  const taskSpans = layoutWeekTaskSpans(weekTasks, days);
  const laneCount = Math.max(1, ...taskSpans.map((span) => span.lane + 1));
  const weekTimeline = data.timeline.filter((item) => dayKeys.has(item.local_date || localDateKey(item.start_at)));

  return (
    <section className="week-layout">
      <section className="week-board-panel">
        <header className="week-overview-head">
          <div>
            <p className="eyebrow">一周任务安排</p>
            <h2>周任务概览</h2>
          </div>
          <div className="week-summary-stats" aria-label="周任务统计">
            <span><b>{plannedCount}</b> 已安排</span>
            <span><b>{doneCount}</b> 已完成</span>
            <span><b>{incompleteTasks.length}</b> 待完成</span>
          </div>
        </header>

        <div className="week-board-scroll">
          <div className="week-board" style={{ '--week-task-lanes': laneCount }}>
            {days.map((day, index) => {
              const dateKey = localDateKey(day);
              const taskCount = weekTasks.filter((task) => taskCoversDate(task, dateKey)).length;
              return (
                <section
                  className={['week-day', isSameLocalDate(day) ? 'today' : '', dateKey === selectedKey ? 'selected' : ''].filter(Boolean).join(' ')}
                  data-day-index={index}
                  key={dateKey}
                >
                  <button type="button" className="week-day-head" onClick={() => onSelectDate(dateKey)} aria-pressed={dateKey === selectedKey}>
                    <div>
                      <span>{formatWeekday(day)}</span>
                      <strong>{day.getDate()}</strong>
                    </div>
                    <em>{taskCount}</em>
                  </button>
                  {!taskCount ? <p className="week-day-empty">这一天还没有任务</p> : <span />}
                  <button type="button" className="week-add-task" onClick={() => setComposerDate(dateKey)}>
                    <Plus size={14} />
                    <span>添加任务</span>
                  </button>
                </section>
              );
            })}
            <div className="week-task-spans" aria-label="周任务区间">
              {taskSpans.map((span) => (
                <WeekTaskBar
                  span={span}
                  onUpdate={(payload) => onUpdateTask(span.task.task_id, payload)}
                  onRestore={() => onRestoreTask(span.task.task_id)}
                  onDelete={() => setDeleteTarget(span.task)}
                  key={span.key}
                />
              ))}
            </div>
          </div>
        </div>

        <details className="task-worklist" open={worklistTasks.length > 0}>
          <summary>
            <span>{selectedDay.getMonth() + 1}月{selectedDay.getDate()}日 · {formatWeekday(selectedDay)}</span>
            <em>{selectedPlannedCount}</em>
            <small>当天进行 {selectedPlannedCount}</small>
            <small>待完成 {incompleteTasks.length}</small>
            {selectedCompletedTasks.length ? <small>当天完成 {selectedCompletedTasks.length}</small> : null}
            {selectedAbandonedTasks.length ? <small className="abandoned">当天放弃 {selectedAbandonedTasks.length}</small> : null}
          </summary>
          <div className="task-worklist-list">
            {worklistTasks.map((task) => (
              <WeekTaskItem
                task={task}
                planningDate={selectedKey}
                plannedForDate={(task.plannedDates || []).includes(selectedKey)}
                onUpdate={(payload) => onUpdateTask(task.task_id, payload)}
                onToggleDate={task.status === 'done' || task.status === 'abandoned'
                  ? null
                  : (planned) => onSetTaskDayPlan(task.task_id, { localDate: selectedKey, planned })}
                onRestore={() => onRestoreTask(task.task_id)}
                onDelete={() => setDeleteTarget(task)}
                key={task.task_id}
              />
            ))}
            {!worklistTasks.length ? <p className="muted-text">当前没有待完成任务，这一天也没有终态记录。</p> : null}
          </div>
          <button type="button" className="text-button" onClick={onOpenTasks}>打开任务库</button>
        </details>
      </section>

      <section className="panel week-timeline-preview">
        <SectionHeader eyebrow="周记录" title={`${weekTimeline.length} 个时间块`} action="展开" onAction={onOpenTimeline} />
        <WeekTimelineGrid items={weekTimeline} selectedDate={selectedDate} onEdit={onEditTimeline} compact />
      </section>

      {composerDate ? (
        <WeekTaskModal
          date={composerDate}
          goals={data.goals}
          onClose={() => setComposerDate(null)}
          onCreate={async (payload) => {
            await onCreateTask(payload);
            setComposerDate(null);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteTaskModal
          task={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await onUpdateTask(deleteTarget.task_id, { status: 'deleted' });
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}

function WeekTaskItem({ task, planningDate, plannedForDate, onUpdate, onToggleDate, onRestore, onDelete }) {
  const done = task.status === 'done';
  const abandoned = task.status === 'abandoned';
  const planningLabel = isSameLocalDate(planningDate) ? '今天' : formatWeekday(dateFromKey(planningDate));
  const overdue = task.due_at && !done && new Date(task.due_at) < new Date();
  const visibleTags = (task.tags || []).slice(0, 2);

  return (
    <article className={done ? 'week-task list done' : `week-task list ${task.status}`}>
      <div className="week-task-body">
        <div className="week-task-title">
          {abandoned ? (
            <button type="button" className="week-task-abandoned-mark" onClick={onRestore} title="恢复任务" aria-label={`恢复 ${task.title}`}>
              <X size={14} />
            </button>
          ) : (
            <input
              type="checkbox"
              checked={done}
              onChange={() => onUpdate({ status: done ? 'todo' : 'done' })}
              aria-label={`${done ? '恢复' : '完成'} ${task.title}`}
            />
          )}
          <strong>{task.title}</strong>
        </div>
        {task.description ? <p>{task.description}</p> : null}
        <div className="week-task-meta">
          <span className="task-code">{task.task_code}</span>
          <span className={`priority priority-${taskPriorityLevel(task.priority)}`}>{taskPriorityLabel(task.priority)}优先级</span>
          {task.goal_title ? <span className="goal" title={task.goal_title}>目标 · {task.goal_title}</span> : null}
          {task.status === 'doing' ? <span className="status doing">进行中</span> : null}
          {task.status === 'blocked' ? <span className="status blocked">阻塞</span> : null}
          {visibleTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          {task.due_at ? <span className={overdue ? 'due overdue' : 'due'}>{formatDate(task.due_at)} 截止</span> : null}
        </div>
      </div>
      <div className="week-task-actions">
        {abandoned ? (
          <em className="task-status-static">放弃</em>
        ) : (
          <TaskStatusMenu value={task.status} onChange={(status) => onUpdate({ status })} label={`更新 ${task.title} 状态`} />
        )}
        {abandoned ? (
          <span className="week-task-day-state abandoned"><X size={14} />当天放弃</span>
        ) : done ? (
          <span className="week-task-day-state done"><Check size={14} />当天完成</span>
        ) : (
          <button
            type="button"
            className={plannedForDate ? 'week-task-schedule active' : 'week-task-schedule'}
            onClick={() => onToggleDate(!plannedForDate)}
            aria-pressed={plannedForDate}
          >
            {plannedForDate ? <Check size={14} /> : <CalendarDays size={14} />}
            <span>{plannedForDate ? `${planningLabel}进行中` : `设为${planningLabel}进行中`}</span>
          </button>
        )}
        {onDelete ? (
          <button type="button" className="task-delete-trigger" onClick={onDelete} title="删除任务" aria-label={`删除 ${task.title}`}>
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function WeekTaskBar({ span, onUpdate, onRestore, onDelete }) {
  const { task, startIndex, endIndex, lane } = span;
  const done = task.status === 'done';
  const abandoned = task.status === 'abandoned';
  const terminalAbandoned = abandoned && span.terminal;

  return (
    <article
      className={terminalAbandoned ? 'week-task-bar abandoned' : done ? 'week-task-bar done' : `week-task-bar ${abandoned ? 'history' : task.status}`}
      style={{ gridColumn: `${startIndex + 1} / ${endIndex + 2}`, gridRow: lane + 1 }}
    >
      {terminalAbandoned ? (
        <button type="button" className="week-task-abandoned-mark" onClick={onRestore} title="恢复任务" aria-label={`恢复 ${task.title}`}>
          <X size={14} />
        </button>
      ) : abandoned ? (
        <span className="week-task-history-mark" aria-hidden="true" />
      ) : (
        <input
          type="checkbox"
          checked={done}
          onChange={() => onUpdate({ status: done ? 'todo' : 'done' })}
          aria-label={`${done ? '恢复' : '完成'} ${task.title}`}
        />
      )}
      <div className="week-task-bar-main" title={`${task.title} · ${formatWeekTaskBarRange(span)}`}>
        <strong>{task.title}</strong>
        <span>{formatWeekTaskBarRange(span)}</span>
      </div>
      <button type="button" className="task-delete-trigger" onClick={onDelete} title="删除任务" aria-label={`删除 ${task.title}`}>
        <Trash2 size={13} />
      </button>
    </article>
  );
}

function WeekTaskModal({ date, goals, onClose, onCreate }) {
  const [draft, setDraft] = useState({ title: '', priority: 3, dueDate: '', goalId: '' });

  async function submit(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    await onCreate({
      title,
      priority: draft.priority,
      goalId: draft.goalId || null,
      plannedDate: date,
      dueAt: draft.dueDate ? `${draft.dueDate}T18:00:00` : null,
    });
  }

  return (
    <FormModal title="新增任务" onClose={onClose}>
      <form className="edit-form" onSubmit={submit}>
        <label>
          任务
          <input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="这一天下一步要完成什么？" />
        </label>
        <p className="form-hint">安排到 {formatWeekday(dateFromKey(date))} · {dateFromKey(date).getMonth() + 1}月{dateFromKey(date).getDate()}日</p>
        <div className="two-col">
          <label>
            优先级
            <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}>
              <option value="1">高</option>
              <option value="3">中</option>
              <option value="5">低</option>
            </select>
          </label>
          <label>
            截止日期
            <input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
          </label>
        </div>
        <label>
          关联目标
          <select value={draft.goalId} onChange={(event) => setDraft({ ...draft, goalId: event.target.value })}>
            <option value="">不关联</option>
            {goals.filter(isCurrentGoal).map((goal) => <option value={goal.goal_id} key={goal.goal_id}>{goal.title}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit">
          <Plus size={16} />
          <span>添加任务</span>
        </button>
      </form>
    </FormModal>
  );
}

function TodayView({ data, selectedDate, latestReport, onLogHabit, onEditTimeline, onOpenGoals, onOpenTasks, onOpenTimeline, onOpenHabits, onOpenSchedule, onUpdateTask }) {
  const topGoals = data.goals.filter(isCurrentGoal).slice(0, 3);
  const todayTimeline = data.timeline.filter((item) => isSameLocalDate(item.start_at, selectedDate));
  const currentTasks = data.tasks.filter((task) => taskCurrentStatusOrder.includes(task.status)).slice(0, 3);
  const todayHabits = data.habits.filter((habit) => habit.status === 'active').slice(0, 3);
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

function HabitsView({ habits, habitLogs, tags, onCreate, onUpdate, onLog }) {
  const makeDraft = () => ({
    title: '',
    note: '',
    tagIds: [],
  });
  const [draft, setDraft] = useState(makeDraft);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('current');
  const [archiveQuery, setArchiveQuery] = useState('');
  const currentHabits = habits.filter((habit) => habit.status === 'active');
  const archivedHabits = habits.filter((habit) => habit.status === 'archived');
  const query = archiveQuery.trim().toLowerCase();
  const doneCount = currentHabits.filter((habit) => habit.todayLog?.status === 'done').length;
  const filteredArchiveHabits = archivedHabits.filter((habit) => {
    if (!query) return true;
    return [
      habit.title,
      habit.note,
      ...(habit.tags || []),
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  });

  function openCreate() {
    setDraft(makeDraft());
    setCreating(true);
  }

  async function submit(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      event.currentTarget.reportValidity();
      return;
    }
    await onCreate({ ...draft, title });
    setDraft(makeDraft());
    setCreating(false);
  }

  async function updateHabitStatus(habit, status) {
    await onUpdate(habit.habit_id, { status });
  }

  return (
    <section className="panel habits-layout">
      <SectionHeader eyebrow="今日进度" title={`${doneCount}/${currentHabits.length} 已完成 · ${archivedHabits.length} 个归档`} action="新建" onAction={openCreate} />
      <div className="archive-page-tabs" aria-label="习惯视图">
        <button type="button" className={mode === 'current' ? 'active' : ''} onClick={() => setMode('current')}>
          当前习惯
        </button>
        <button type="button" className={mode === 'archive' ? 'active' : ''} onClick={() => setMode('archive')}>
          归档
        </button>
      </div>

      {mode === 'current' ? (
        <>
          <div className="habit-list">
            {currentHabits.map((habit) => (
              <HabitRow
                key={habit.habit_id}
                habit={habit}
                onLog={onLog}
                onArchive={() => updateHabitStatus(habit, 'archived')}
              />
            ))}
            {!currentHabits.length ? <p className="muted-text">当前没有习惯。</p> : null}
          </div>
          <HabitHeatmap habits={currentHabits} logs={habitLogs} />
        </>
      ) : (
        <section className="habit-archive-view">
          <header className="habit-archive-head">
            <div>
              <p className="eyebrow">归档</p>
              <h2>{filteredArchiveHabits.length} 个历史习惯</h2>
            </div>
            <input
              className="habit-archive-search"
              value={archiveQuery}
              onChange={(event) => setArchiveQuery(event.target.value)}
              placeholder="搜索习惯或标签"
            />
          </header>
          <div className="habit-archive-list">
            {filteredArchiveHabits.map((habit) => (
              <HabitArchiveRow
                key={habit.habit_id}
                habit={habit}
                onRestore={() => updateHabitStatus(habit, 'active')}
                onDelete={() => updateHabitStatus(habit, 'deleted')}
              />
            ))}
            {!filteredArchiveHabits.length ? <p className="muted-text">没有符合条件的历史习惯。</p> : null}
          </div>
        </section>
      )}

      {creating ? (
        <FormModal title="新增习惯" onClose={() => setCreating(false)}>
          <form className="edit-form" onSubmit={submit}>
            <label>
              习惯
              <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：每天记录一句 timeline" />
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
    tagIds: [],
  });
  const [draft, setDraft] = useState(makeDraft);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('current');
  const [boardView, setBoardView] = useState('status');
  const [archiveStatus, setArchiveStatus] = useState('all');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const currentTasks = tasks.filter((task) => taskCurrentStatusOrder.includes(task.status));
  const dueGroups = buildTaskDueGroups(currentTasks);
  const goalGroups = buildTaskGoalGroups(currentTasks);
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
      <div className="archive-page-tabs" aria-label="任务视图">
        <button type="button" className={mode === 'current' ? 'active' : ''} onClick={() => setMode('current')}>
          当前任务
        </button>
        <button type="button" className={mode === 'archive' ? 'active' : ''} onClick={() => setMode('archive')}>
          归档
        </button>
      </div>

      {mode === 'current' ? (
        <>
          <div className="task-board-tabs" aria-label="任务看板">
            <button type="button" className={boardView === 'status' ? 'active' : ''} onClick={() => setBoardView('status')}>按状态</button>
            <button type="button" className={boardView === 'due' ? 'active' : ''} onClick={() => setBoardView('due')}>按截止</button>
            <button type="button" className={boardView === 'goal' ? 'active' : ''} onClick={() => setBoardView('goal')}>按目标</button>
          </div>

          {boardView === 'status' ? (
            <TaskBoard
              groups={taskCurrentStatusOrder.map((status) => ({
                key: status,
                title: taskStatusLabels[status],
                tasks: currentTasks.filter((task) => task.status === status),
              }))}
              onStatus={updateTaskStatus}
              onDelete={setDeleteTarget}
              fixedColumns
            />
          ) : null}

          {boardView === 'due' ? (
            <TaskBoard
              groups={dueGroups}
              onStatus={updateTaskStatus}
              onDelete={setDeleteTarget}
            />
          ) : null}

          {boardView === 'goal' ? (
            <TaskBoard
              groups={goalGroups}
              onStatus={updateTaskStatus}
              onDelete={setDeleteTarget}
            />
          ) : null}

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

function TaskBoard({ groups, onStatus, onDelete, fixedColumns = false }) {
  return (
    <div className={fixedColumns ? 'task-board current-task-board' : 'task-board grouped-task-board'}>
      {groups.map((group) => (
        <section className="task-column" key={group.key}>
          <header>
            <span>{group.title}</span>
            <em>{group.tasks.length}</em>
          </header>
          <div className="task-stack">
            {group.tasks.map((task) => (
              <TaskCard
                key={task.task_id}
                task={task}
                onStatus={(nextStatus) => onStatus(task, nextStatus)}
                onDelete={() => onDelete(task)}
              />
            ))}
            {!group.tasks.length ? <p className="muted-text">暂无</p> : null}
          </div>
        </section>
      ))}
    </div>
  );
}

function TagsView({ tags, onCreate, onUpdate, onDelete }) {
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mode, setMode] = useState('active');
  const [activeCategory, setActiveCategory] = useState('activity_type');
  const managedTags = useMemo(() => tags.filter((tag) => tagCategoryOptions.includes(tag.category)), [tags]);
  const tree = useMemo(() => buildTagTree(managedTags, true), [managedTags]);
  const parentOptions = useMemo(() => managedTags.filter((tag) => !tag.parent_tag_id), [managedTags]);
  const activeTags = managedTags.filter((tag) => tag.is_active !== 0);
  const inactiveTags = managedTags.filter((tag) => tag.is_active === 0);
  const visibleTags = mode === 'active' ? activeTags : inactiveTags;
  const visibleTree = useMemo(() => buildTagTree(visibleTags, true), [visibleTags]);
  const visibleParents = visibleTree.byCategory[activeCategory] || [];
  const categoryCounts = tagCategoryOptions.reduce((acc, category) => {
    acc[category] = visibleTags.filter((tag) => tag.category === category).length;
    return acc;
  }, {});

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
    setDialog({ mode: 'create', draft: emptyTagDraft(activeCategory) });
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
      <SectionHeader eyebrow="互斥维度" title={`${activeTags.length} 个可用 · ${inactiveTags.length} 个停用`} action="新增一级" onAction={createNew} />
      <div className="archive-page-tabs" aria-label="标签状态视图">
        <button type="button" className={mode === 'active' ? 'active' : ''} onClick={() => setMode('active')}>
          可用标签
        </button>
        <button type="button" className={mode === 'inactive' ? 'active' : ''} onClick={() => setMode('inactive')}>
          停用
        </button>
      </div>
      <div className="task-board-tabs tag-category-tabs" aria-label="标签分类视图">
        {tagCategoryOptions.map((category) => (
          <button
            type="button"
            className={activeCategory === category ? 'active' : ''}
            key={category}
            onClick={() => setActiveCategory(category)}
          >
            {tagCategoryLabels[category]} <span>{categoryCounts[category] || 0}</span>
          </button>
        ))}
      </div>
      <section className="tag-tree-section">
        <header className="tag-category-head">
          <div>
            <p className="eyebrow">{mode === 'active' ? '可用标签' : '停用标签'}</p>
            <h2>{tagCategoryLabels[activeCategory] || activeCategory}</h2>
          </div>
          <span>这个分类每条记录最多选一个</span>
        </header>
        <div className="tag-tree">
          {visibleParents.map((tag) => {
            const children = visibleTree.childrenByParent[tag.tag_id] || [];
            return (
              <div className="tag-branch" key={tag.tag_id}>
                <TagNode
                  tag={tag}
                  childCount={children.length}
                  onEdit={editTag}
                  onToggle={toggleTag}
                  onDelete={setDeleteTarget}
                  onCreateChild={mode === 'active' ? createChild : null}
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
          {!visibleParents.length ? <p className="muted-text">这个分类下还没有标签。</p> : null}
        </div>
      </section>

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
            <select
              value={draft.category}
              disabled={lockedParent || selectedHasChildren}
              onChange={(event) => setDraft({ ...draft, category: event.target.value, parentTagId: '' })}
            >
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
              {parentOptions.filter((tag) => tag.category === draft.category && tag.tag_id !== dialog.tag?.tag_id).map((tag) => (
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

function GoalsView({ goals, tags, onCreate, onUpdate, onEdit }) {
  const makeDraft = (level = 'day') => ({
    title: '',
    level,
    successCriteria: '',
    tagIds: [],
  });
  const [draft, setDraft] = useState(makeDraft);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('current');
  const [activeGoalLevel, setActiveGoalLevel] = useState('day');
  const [archiveStatus, setArchiveStatus] = useState('all');
  const [archiveQuery, setArchiveQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const currentGoals = sortGoalsByPeriod(goals.filter(isCurrentGoal));
  const archivedGoals = sortGoalsByPeriod(goals.filter(isArchivedGoal));
  const activeGoals = activeGoalLevel === 'all' ? currentGoals : currentGoals.filter((goal) => goal.level === activeGoalLevel);
  const archivedGoalsByLevel = activeGoalLevel === 'all' ? archivedGoals : archivedGoals.filter((goal) => goal.level === activeGoalLevel);
  const query = archiveQuery.trim().toLowerCase();
  const activeGoalCounts = goalLevelOrder.reduce((acc, level) => {
    acc[level] = currentGoals.filter((goal) => goal.level === level).length;
    return acc;
  }, {});
  const archiveCounts = goalArchiveStatusOrder.reduce((acc, status) => {
    acc[status] = archivedGoalsByLevel.filter((goal) => goalArchiveStatus(goal) === status).length;
    return acc;
  }, {});
  const filteredArchiveGoals = archivedGoalsByLevel.filter((goal) => {
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

  function openCreate(level = 'day') {
    setDraft(makeDraft(level));
    setCreating(true);
  }

  async function submit(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      event.currentTarget.reportValidity();
      return;
    }
    await onCreate({ ...draft, title });
    setDraft(makeDraft());
    setCreating(false);
  }

  async function updateGoalStatus(goal, status) {
    await onUpdate(goal.goal_id, { status });
  }

  async function deleteGoal() {
    if (!deleteTarget) return;
    await onUpdate(deleteTarget.goal_id, { status: 'deleted' });
    setDeleteTarget(null);
  }

  return (
    <section className="panel goals-layout">
      <SectionHeader
        eyebrow="目标状态"
        title={`${currentGoals.length} 个进行中 · ${archivedGoals.length} 个归档`}
        action="新建"
        onAction={() => openCreate(activeGoalLevel === 'all' ? 'day' : activeGoalLevel)}
      />
      <div className="archive-page-tabs" aria-label="目标状态视图">
        <button type="button" className={mode === 'current' ? 'active' : ''} onClick={() => setMode('current')}>
          当前目标
        </button>
        <button type="button" className={mode === 'archive' ? 'active' : ''} onClick={() => setMode('archive')}>
          归档
        </button>
      </div>
      <div className="task-board-tabs goal-level-tabs" aria-label="目标周期视图">
        {goalViewOrder.map((level) => (
          <button
            type="button"
            className={activeGoalLevel === level ? 'active' : ''}
            key={level}
            onClick={() => setActiveGoalLevel(level)}
          >
            {goalTabLabels[level]}
          </button>
        ))}
      </div>

      {mode === 'current' ? (
        <>
          <article className="goal-focus-card">
            <header className="goal-focus-head">
              <div>
                <h2>{goalFocusTitles[activeGoalLevel]}</h2>
              </div>
            </header>

            <div className="goal-focus-summary">
              <span>{formatGoalLevelSummary(activeGoalLevel, activeGoalLevel === 'all' ? currentGoals.length : activeGoalCounts[activeGoalLevel])}</span>
              <span>{archivedGoals.length} 个已归档</span>
            </div>

            <div className="goal-focus-list">
              {activeGoals.map((goal) => (
                <GoalFocusRow
                  key={goal.goal_id}
                  goal={goal}
                  onEdit={() => onEdit(goal)}
                  onStatus={(status) => updateGoalStatus(goal, status)}
                  onDelete={() => setDeleteTarget(goal)}
                />
              ))}
              {!activeGoals.length ? <p className="muted-text">暂无{goalTabLabels[activeGoalLevel]}。</p> : null}
            </div>
          </article>
        </>
      ) : (
        <section className="goal-archive-view">
          <header className="goal-archive-head">
            <div>
              <p className="eyebrow">归档</p>
              <h2>{activeGoalLevel === 'all' ? `${filteredArchiveGoals.length} 个历史目标` : `${filteredArchiveGoals.length} 个${goalTabLabels[activeGoalLevel]}归档`}</h2>
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
              全部 <span>{archivedGoalsByLevel.length}</span>
            </button>
            {goalArchiveStatusOrder.map((status) => (
              <button type="button" className={archiveStatus === status ? 'active' : ''} key={status} onClick={() => setArchiveStatus(status)}>
                {goalArchiveStatusLabels[status]} <span>{archiveCounts[status] || 0}</span>
              </button>
            ))}
          </div>
          <div className="goal-archive-list">
            {filteredArchiveGoals.map((goal) => (
              <GoalArchiveRow
                key={goal.goal_id}
                goal={goal}
                onEdit={() => onEdit(goal)}
                onStatus={(status) => updateGoalStatus(goal, status)}
                onDelete={() => setDeleteTarget(goal)}
              />
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
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="例如：稳定记录 20 天"
                required
                autoFocus
              />
            </label>
            <label>
              层级
              <select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value })}>
                {goalLevelOrder.map((level) => (
                  <option value={level} key={level}>{levelLabels[level]}</option>
                ))}
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

      {deleteTarget ? (
        <DeleteGoalModal
          goal={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={deleteGoal}
        />
      ) : null}
    </section>
  );
}

function TimelineView({ items, selectedDate, onEdit }) {
  const days = weekDates(selectedDate);
  const dayKeys = new Set(days.map(localDateKey));
  const weekItems = items.filter((item) => dayKeys.has(item.local_date || localDateKey(item.start_at)));

  return (
    <section className="panel timeline-page">
      <SectionHeader eyebrow="一周时间线" title={`${weekItems.length} 个时间块 · ${formatWeekRange(selectedDate)}`} />
      <WeekTimelineGrid items={weekItems} selectedDate={selectedDate} onEdit={onEdit} />
    </section>
  );
}

function WeekTimelineGrid({ items, selectedDate, onEdit, compact = false }) {
  const days = weekDates(selectedDate);
  const height = compact ? 480 : 960;
  const hours = compact ? [0, 6, 12, 18, 24] : Array.from({ length: 9 }, (_, index) => index * 3);

  return (
    <div className={compact ? 'week-timeline-scroll compact' : 'week-timeline-scroll'}>
      <div className="week-timeline-canvas">
        <div className="week-timeline-days">
          <span />
          {days.map((day) => (
            <div className={isSameLocalDate(day) ? 'today' : ''} key={localDateKey(day)}>
              <strong>{formatWeekday(day)}</strong>
              <span>{day.getMonth() + 1}/{day.getDate()}</span>
            </div>
          ))}
        </div>
        <div className="week-timeline-body" style={{ '--week-timeline-height': `${height}px` }}>
          <div className="week-time-axis" aria-hidden="true">
            {hours.map((hour) => (
              <span style={{ top: `${(hour / 24) * height}px` }} key={hour}>{formatHour(hour)}</span>
            ))}
          </div>
          <div className="week-time-tracks">
            {days.map((day) => {
              const dayItems = items
                .filter((item) => isSameLocalDate(item.start_at, day))
                .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
              return (
                <div className={isSameLocalDate(day) ? 'week-time-track today' : 'week-time-track'} key={localDateKey(day)}>
                  {hours.map((hour) => <i className="week-time-line" style={{ top: `${(hour / 24) * height}px` }} key={hour} />)}
                  {isSameLocalDate(day) ? (
                    <i className="week-now-line" style={{ top: `${(minutesOfDay(new Date()) / 1440) * height}px` }} />
                  ) : null}
                  {dayItems.map((item) => {
                    const start = clampMinute(minutesOfDay(item.start_at));
                    const endValue = item.end_at ? clampMinute(minutesOfDay(item.end_at)) : Math.max(start + 30, minutesOfDay(new Date()));
                    const end = endValue <= start ? Math.min(1440, start + 30) : endValue;
                    const top = (start / 1440) * height;
                    const eventHeight = Math.max(compact ? 18 : 28, ((end - start) / 1440) * height);
                    return (
                      <button
                        type="button"
                        className={`week-timeline-event type-${timelineDisplayType(item)}`}
                        style={{ top: `${top}px`, height: `${eventHeight}px` }}
                        onClick={() => onEdit(item)}
                        title={`${formatTime(item.start_at)} ${item.title}`}
                        key={item.timeline_id}
                      >
                        <span>{formatTime(item.start_at)}</span>
                        <strong>{item.title}</strong>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MomentsView({ moments, tags, onCreate, onUpdate, onDelete, onUploadImage }) {
  const [range, setRange] = useState('year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const bounds = momentRangeBounds(range, customStart, customEnd);
  const filteredMoments = moments
    .filter((moment) => momentInRange(moment, bounds))
    .sort((a, b) => new Date(b.happened_at) - new Date(a.happened_at));
  const rangeText = formatMomentRange(range, bounds, customStart, customEnd);

  return (
    <section className="moments-layout">
      <section className="panel">
        <SectionHeader eyebrow="高光画册" title={`${filteredMoments.length} 个高光 · ${rangeText}`} action="新建" onAction={() => setEditor({ mode: 'create' })} />
        <div className="moment-toolbar">
          <div className="review-filters" aria-label="高光时间筛选">
            {momentRangeOrder.map((item) => (
              <button type="button" className={range === item ? 'active' : ''} key={item} onClick={() => setRange(item)}>
                {momentRangeLabels[item]}
              </button>
            ))}
          </div>
          {range === 'custom' ? (
            <div className="moment-date-range">
              <label>
                起
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </label>
              <label>
                止
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <section className="moment-gallery" aria-label="高光时刻画册">
        {filteredMoments.map((moment) => (
          <MomentCard
            moment={moment}
            onEdit={() => setEditor({ mode: 'edit', moment })}
            onDelete={() => setDeleteTarget(moment)}
            onOpenImage={(index) => setLightbox({ moment, index })}
            key={moment.moment_id}
          />
        ))}
        {!filteredMoments.length ? <p className="muted-text">这段时间还没有高光。</p> : null}
      </section>

      {editor ? (
        <MomentEditorModal
          editor={editor}
          tags={tags}
          onUploadImage={onUploadImage}
          onClose={() => setEditor(null)}
          onSave={async (payload) => {
            if (editor.mode === 'edit') await onUpdate(editor.moment.moment_id, payload);
            else await onCreate(payload);
            setEditor(null);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteMomentModal
          moment={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await onDelete(deleteTarget.moment_id);
            setDeleteTarget(null);
          }}
        />
      ) : null}

      {lightbox ? (
        <MomentLightbox
          moment={lightbox.moment}
          index={lightbox.index}
          onChange={(index) => setLightbox({ ...lightbox, index })}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </section>
  );
}

function MomentCard({ moment, onEdit, onDelete, onOpenImage }) {
  const images = momentImageUrls(moment);
  const [activeImage, setActiveImage] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = images[activeImage] && !imageFailed ? images[activeImage] : '';
  const dateText = formatFullDate(moment.happened_at || moment.local_date);

  useEffect(() => {
    if (activeImage >= images.length) setActiveImage(Math.max(0, images.length - 1));
    setImageFailed(false);
  }, [activeImage, images.length]);

  function moveImage(offset) {
    setActiveImage((index) => (index + offset + images.length) % images.length);
  }

  return (
    <article className="moment-card">
      <div className="moment-card-actions">
        <button type="button" onClick={onEdit} title="编辑高光" aria-label={`编辑 ${moment.title}`}><Edit3 size={14} /></button>
        <button type="button" onClick={onDelete} title="删除高光" aria-label={`删除 ${moment.title}`}><Trash2 size={14} /></button>
      </div>
      <div className="moment-cover">
        {imageUrl ? (
          <button type="button" className="moment-image-open" onClick={() => onOpenImage(activeImage)} aria-label={`查看 ${moment.title} 大图`}>
            <img src={imageUrl} alt={moment.title} onError={() => setImageFailed(true)} />
          </button>
        ) : (
          <button type="button" className="moment-cover-empty" onClick={onEdit} aria-label={`编辑 ${moment.title} 并添加照片`}>
            <Sparkles size={20} />
            <span>{formatDate(moment.local_date || moment.happened_at)}</span>
            <em>点击添加照片</em>
          </button>
        )}
        {images.length > 1 ? (
          <>
            <button type="button" className="moment-image-nav previous" onClick={() => moveImage(-1)} aria-label="上一张照片"><ChevronLeft size={18} /></button>
            <button type="button" className="moment-image-nav next" onClick={() => moveImage(1)} aria-label="下一张照片"><ChevronRight size={18} /></button>
            <span className="moment-image-count">{activeImage + 1}/{images.length}</span>
          </>
        ) : null}
      </div>
      <div className="moment-card-body">
        <div className="moment-meta">
          <span>{dateText}</span>
        </div>
        <strong title={moment.title}>{moment.title}</strong>
        <p>{moment.story || '没有描述'}</p>
        {moment.timeline_title ? <em>来自：{moment.timeline_title}</em> : null}
        <TagPills tags={moment.tags} />
      </div>
    </article>
  );
}

function MomentLightbox({ moment, index, onChange, onClose }) {
  const images = momentImageUrls(moment);
  const activeIndex = Math.min(Math.max(0, index), Math.max(0, images.length - 1));
  const imageUrl = images[activeIndex];

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && images.length > 1) onChange((activeIndex - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight' && images.length > 1) onChange((activeIndex + 1) % images.length);
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [activeIndex, images.length, onChange, onClose]);

  if (!imageUrl) return null;
  return (
    <div className="moment-lightbox-backdrop" role="presentation">
      <section className="moment-lightbox" role="dialog" aria-modal="true" aria-label={`${moment.title} 大图`}>
        <button type="button" className="moment-lightbox-close" onClick={onClose} aria-label="关闭大图"><X size={20} /></button>
        {images.length > 1 ? (
          <button type="button" className="moment-lightbox-nav previous" onClick={() => onChange((activeIndex - 1 + images.length) % images.length)} aria-label="上一张照片"><ChevronLeft size={26} /></button>
        ) : null}
        <img src={imageUrl} alt={`${moment.title} ${activeIndex + 1}`} />
        {images.length > 1 ? (
          <button type="button" className="moment-lightbox-nav next" onClick={() => onChange((activeIndex + 1) % images.length)} aria-label="下一张照片"><ChevronRight size={26} /></button>
        ) : null}
        <footer>
          <div><strong>{moment.title}</strong><span>{activeIndex + 1}/{images.length}</span></div>
          <a className="secondary-button" href={imageUrl} download>下载原图</a>
        </footer>
      </section>
    </div>
  );
}

function MomentEditorModal({ editor, tags, onUploadImage, onClose, onSave }) {
  const moment = editor.moment || {};
  const initialDate = moment.local_date || localDateKey(moment.happened_at || new Date());
  const initialImageUrls = momentImageUrls(moment);
  const [draft, setDraft] = useState({
    title: moment.title || '',
    story: moment.story || '',
    date: initialDate,
    imageUrls: initialImageUrls,
    tagIds: moment.tagIds || [],
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photoPreviewRef = useRef([]);

  useEffect(() => {
    photoPreviewRef.current = photoPreviews;
  }, [photoPreviews]);

  useEffect(() => () => {
    photoPreviewRef.current.forEach((preview) => URL.revokeObjectURL(preview));
  }, []);

  function choosePhotos(files) {
    setError('');
    const selectedFiles = [...(files || [])];
    if (!selectedFiles.length) return;
    if (selectedFiles.some((file) => file.size > 8 * 1024 * 1024)) {
      setError('照片大小必须在 8MB 以内');
      return;
    }
    const available = Math.max(0, 20 - draft.imageUrls.length - photoFiles.length);
    const accepted = selectedFiles.slice(0, available);
    setPhotoFiles((current) => [...current, ...accepted]);
    setPhotoPreviews((current) => [...current, ...accepted.map((file) => URL.createObjectURL(file))]);
  }

  async function submit(event) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title || saving) return;
    setSaving(true);
    setError('');
    try {
      const uploadedImages = await Promise.all(photoFiles.map(async (file) => (
        onUploadImage({ mimeType: file.type, data: await fileToBase64(file) })
      )));
      const imageUrls = [...draft.imageUrls, ...uploadedImages.map((image) => image.imageUrl)];
      await onSave({
        title,
        story: draft.story.trim(),
        happenedAt: `${draft.date}T12:00:00`,
        imageUrls,
        tagIds: draft.tagIds,
      });
    } catch (submitError) {
      setError(submitError.message || '保存失败');
      setSaving(false);
    }
  }

  const photoItems = [
    ...draft.imageUrls.map((url, index) => ({ url, type: 'saved', index })),
    ...photoPreviews.map((url, index) => ({ url, type: 'new', index })),
  ];

  return (
    <FormModal eyebrow={editor.mode === 'edit' ? '编辑' : '新建'} title={editor.mode === 'edit' ? '编辑高光' : '新增高光'} onClose={onClose}>
      <form className="edit-form" onSubmit={submit}>
        <label>
          标题
          <input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="这一刻为什么值得记住？" />
        </label>
        <label>
          故事
          <textarea value={draft.story} onChange={(event) => setDraft({ ...draft, story: event.target.value })} placeholder="记录发生了什么，以及它为什么重要" />
        </label>
        <label>
          日期
          <input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </label>
        <div className="moment-photo-editor multiple">
          <header className="moment-photo-head">
            <div><strong>照片</strong><span>记录这一刻的画面</span></div>
            <em>{photoItems.length}/20</em>
          </header>
          {photoItems.length ? (
            <div className="moment-photo-grid">
              {photoItems.map((photo, displayIndex) => (
                <figure key={`${photo.type}-${photo.url}`}>
                  <img src={photo.url} alt={`高光照片 ${displayIndex + 1}`} />
                  <button type="button" onClick={() => {
                    if (photo.type === 'saved') {
                      setDraft({ ...draft, imageUrls: draft.imageUrls.filter((_, index) => index !== photo.index) });
                    } else {
                      URL.revokeObjectURL(photo.url);
                      setPhotoFiles((files) => files.filter((_, index) => index !== photo.index));
                      setPhotoPreviews((previews) => previews.filter((_, index) => index !== photo.index));
                    }
                  }} aria-label={`移除第 ${displayIndex + 1} 张照片`}><X size={13} /></button>
                </figure>
              ))}
              {photoItems.length < 20 ? (
                <label className="moment-photo-add-tile">
                  <Plus size={20} />
                  <span>继续添加</span>
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => choosePhotos(event.target.files)} />
                </label>
              ) : null}
            </div>
          ) : (
            <label
              className="moment-photo-drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                choosePhotos(event.dataTransfer.files);
              }}
            >
              <span className="moment-photo-drop-icon"><Images size={24} /></span>
              <strong>添加这一刻的照片</strong>
              <span>点击选择或拖入图片</span>
              <small>JPG、PNG、WebP、GIF · 单张不超过 8MB</small>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => choosePhotos(event.target.files)} />
            </label>
          )}
        </div>
        <TagPicker tags={tags} selected={draft.tagIds} onChange={(tagIds) => setDraft({ ...draft, tagIds })} />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={saving}>
          <Check size={16} />
          <span>{saving ? '保存中…' : '保存高光'}</span>
        </button>
      </form>
    </FormModal>
  );
}

function DeleteMomentModal({ moment, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-moment-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">二次确认</p>
            <h2 id="delete-moment-title">删除「{moment.title}」？</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭"><X size={18} /></button>
        </header>
        <p className="confirm-copy">高光记录和本地照片会一起删除。</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="button" className="danger-button" onClick={onConfirm}><Trash2 size={16} /><span>删除高光</span></button>
        </div>
      </section>
    </div>
  );
}

function ReportsView({ reviews, tags, activeReport, latestReport, onSelectReport, onUpdateReview }) {
  const [reviewType, setReviewType] = useState('all');
  const [reviewQuery, setReviewQuery] = useState('');
  const [editingReview, setEditingReview] = useState(null);
  const generatedReviews = reviews.filter((review) => review.source_report_id);
  const currentRange = completedReviewRange(activeReport);
  const currentReviews = generatedReviews
    .filter((review) => review.review_type === activeReport && reviewOverlapsRange(review, currentRange))
    .slice(0, 1);
  const currentReviewIds = new Set(currentReviews.map((review) => review.review_id));
  const query = reviewQuery.trim().toLowerCase();
  const historyReviews = generatedReviews.filter((review) => {
    if (currentReviewIds.has(review.review_id)) return false;
    const typeMatches = reviewType === 'all' || review.review_type === reviewType;
    if (!typeMatches) return false;
    if (!query) return true;
    return reviewMatchesQuery(review, query);
  });
  const reviewCounts = reviewTypeOrder.reduce((acc, type) => {
    acc[type] = generatedReviews.filter((review) => !currentReviewIds.has(review.review_id) && review.review_type === type).length;
    return acc;
  }, {});

  function selectReportType(period) {
    onSelectReport(period);
    setReviewType(period);
  }

  return (
    <section className="reports-layout">
      <section className="reports-generator">
        <SectionHeader eyebrow="系统生成" title="复盘" />
        <div className="segmented">
          {['day', 'week', 'month'].map((period) => (
            <button key={period} type="button" className={activeReport === period ? 'active' : ''} onClick={() => selectReportType(period)}>
              {periodLabels[period]}
            </button>
          ))}
        </div>
        <article className="report-focus">
          <span>{periodLabels[activeReport]} · {reportTargetLabels[activeReport]}</span>
          <h2>{latestReport?.title || `还没有${reportTargetLabels[activeReport]}的${periodLabels[activeReport]}`}</h2>
          <p>{latestReport?.summary || `${reportTargetLabels[activeReport]}的${periodLabels[activeReport]}还没有生成。`}</p>
        </article>
      </section>

      <section className="panel review-archive-page">
        <header className="review-archive-head">
          <div>
            <p className="eyebrow">历史复盘</p>
            <h2>{historyReviews.length} 条复盘</h2>
          </div>
          <input
            className="review-search"
            value={reviewQuery}
            onChange={(event) => setReviewQuery(event.target.value)}
            placeholder="搜索标题、正文、标签"
          />
        </header>

        <div className="review-filters" aria-label="复盘类型筛选">
          <button type="button" className={reviewType === 'all' ? 'active' : ''} onClick={() => setReviewType('all')}>
            全部 <span>{generatedReviews.length - currentReviews.length}</span>
          </button>
          {reviewTypeOrder.map((type) => (
            <button type="button" className={reviewType === type ? 'active' : ''} key={type} onClick={() => setReviewType(type)}>
              {reviewTypeLabels[type]} <span>{reviewCounts[type] || 0}</span>
            </button>
          ))}
        </div>

        <div className="review-list">
          {historyReviews.map((review) => (
            <ReviewCard key={review.review_id} review={review} onEdit={() => setEditingReview(review)} />
          ))}
          {!historyReviews.length ? <p className="muted-text">还没有历史复盘。</p> : null}
        </div>
      </section>

      {editingReview ? (
        <ReviewFormModal
          draft={makeReviewEditDraft(editingReview)}
          tags={tags}
          onClose={() => setEditingReview(null)}
          onSubmit={async (payload) => {
            await onUpdateReview(editingReview.review_id, payload);
            setEditingReview(null);
          }}
        />
      ) : null}
    </section>
  );
}

function reviewMatchesQuery(review, query) {
  return [
    review.title,
    review.summary,
    review.body,
    review.learnings,
    review.next_actions,
    reviewTypeLabels[review.review_type],
    ...(review.tags || []),
  ].filter(Boolean).join(' ').toLowerCase().includes(query);
}

function momentRangeBounds(range, customStart, customEnd) {
  const date = new Date();
  if (range === 'all') return null;
  if (range === 'custom') {
    if (!customStart && !customEnd) return null;
    return {
      start: customStart || '0000-01-01',
      end: customEnd || '9999-12-31',
    };
  }
  if (range === 'year') {
    return {
      start: localDateKey(new Date(date.getFullYear(), 0, 1)),
      end: localDateKey(new Date(date.getFullYear(), 11, 31)),
    };
  }
  if (range === 'week') {
    const start = startOfWeek(date);
    const end = endOfWeek(date);
    return { start: localDateKey(start), end: localDateKey(end) };
  }
  return {
    start: localDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: localDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

function momentInRange(moment, bounds) {
  if (!bounds) return true;
  const key = dateKey(moment.local_date || moment.happened_at);
  return key >= bounds.start && key <= bounds.end;
}

function formatMomentRange(range, bounds, customStart, customEnd) {
  if (range === 'all') return '全部时间';
  if (range === 'custom') {
    if (customStart && customEnd) return formatReviewRange(bounds);
    if (customStart) return `${formatDateKey(customStart)} 后`;
    if (customEnd) return `${formatDateKey(customEnd)} 前`;
    return '自定义区间';
  }
  return formatReviewRange(bounds);
}

function completedReviewRange(type) {
  const date = new Date();
  if (type === 'month') {
    const lastMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return {
      start: localDateKey(lastMonth),
      end: localDateKey(new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)),
    };
  }
  if (type === 'week') {
    const currentWeekStart = startOfWeek(date);
    const start = new Date(currentWeekStart);
    start.setDate(currentWeekStart.getDate() - 7);
    const end = new Date(currentWeekStart);
    end.setDate(currentWeekStart.getDate() - 1);
    return { start: localDateKey(start), end: localDateKey(end) };
  }
  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  return { start: localDateKey(yesterday), end: localDateKey(yesterday) };
}

function reviewOverlapsRange(review, range) {
  const start = dateKey(review.period_start || review.created_at);
  const end = dateKey(review.period_end || review.created_at);
  return Boolean(start && end && start <= range.end && end >= range.start);
}

function dateKey(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localDateKey(new Date(value));
}

function formatReviewRange(range) {
  if (range.start === range.end) return formatDateKey(range.start);
  return `${formatDateKey(range.start)} - ${formatDateKey(range.end)}`;
}

function formatDateKey(value) {
  return formatDate(dateFromKey(value));
}

function makeReviewEditDraft(review) {
  return {
    title: review.title || '',
    reviewType: review.review_type || 'topic',
    periodStart: review.period_start || '',
    periodEnd: review.period_end || '',
    summary: review.summary || '',
    body: review.body || '',
    learnings: review.learnings || '',
    nextActions: review.next_actions || '',
    sourceReportId: review.source_report_id || null,
    tagIds: review.tagIds || [],
  };
}

function ReviewFormModal({ draft, tags, onClose, onSubmit }) {
  const [form, setForm] = useState(draft);

  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit(form);
  }

  return (
    <FormModal eyebrow="编辑" title="编辑系统复盘" onClose={onClose}>
      <form className="edit-form" onSubmit={submit}>
        <label>
          标题
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label>
          类型
          <select value={form.reviewType} onChange={(event) => setForm({ ...form, reviewType: event.target.value })}>
            {reviewTypeOrder.map((type) => (
              <option value={type} key={type}>{reviewTypeLabels[type]}</option>
            ))}
          </select>
        </label>
        <label>
          系统概览
          <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
        </label>
        <label>
          事实记录
          <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
        </label>
        <label>
          判断与洞察
          <textarea value={form.learnings} onChange={(event) => setForm({ ...form, learnings: event.target.value })} placeholder="可选，写你的感受、判断、取舍或经验" />
        </label>
        <label>
          调整与下一步
          <textarea value={form.nextActions} onChange={(event) => setForm({ ...form, nextActions: event.target.value })} placeholder="可选，写后续动作或生活系统调整" />
        </label>
        <TagPicker tags={tags} selected={form.tagIds} onChange={(tagIds) => setForm({ ...form, tagIds })} />
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button className="primary-button" type="submit">
            <Check size={16} />
            <span>保存修改</span>
          </button>
        </div>
      </form>
    </FormModal>
  );
}

function ReviewCard({ review, onEdit }) {
  return (
    <article className="review-card">
      <div className="review-card-head">
        <div>
          <span>{reviewTypeLabels[review.review_type] || review.review_type}</span>
          <em>{formatDate(review.created_at)}</em>
        </div>
        <button type="button" className="review-edit-button" onClick={onEdit}>
          <Edit3 size={14} />
          <span>编辑</span>
        </button>
      </div>
      <strong title={review.title}>{review.title}</strong>
      <p>{review.summary || review.body || '没有摘要'}</p>
      {review.learnings ? (
        <div className="review-note">
          <span>判断</span>
          <p>{review.learnings}</p>
        </div>
      ) : null}
      {review.next_actions ? (
        <div className="review-note">
          <span>调整</span>
          <p>{review.next_actions}</p>
        </div>
      ) : null}
      <TagPills tags={review.tags} />
    </article>
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

function PeopleRelationsView({ people }) {
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.person_id || '');
  const [sourceFilter, setSourceFilter] = useState('all');
  const peopleWithCounts = useMemo(() => people.map((person) => ({
    person,
    relatedCount: buildPersonRelatedItems(person).length,
  })), [people]);

  useEffect(() => {
    if (people.some((person) => person.person_id === selectedPersonId)) return;
    setSelectedPersonId(people[0]?.person_id || '');
  }, [people, selectedPersonId]);

  const selectedPerson = people.find((person) => person.person_id === selectedPersonId) || people[0] || null;
  const relatedItems = useMemo(
    () => (selectedPerson ? buildPersonRelatedItems(selectedPerson) : []),
    [selectedPerson],
  );
  const filteredItems = sourceFilter === 'all'
    ? relatedItems
    : relatedItems.filter((item) => item.source === sourceFilter);
  const sourceCounts = peopleRelationSources.reduce((acc, source) => {
    acc[source.id] = source.id === 'all'
      ? relatedItems.length
      : relatedItems.filter((item) => item.source === source.id).length;
    return acc;
  }, {});

  return (
    <section className="panel people-relations-page">
      <SectionHeader
        eyebrow="人物关系"
        title={`${people.length} 个人 · ${relatedItems.length} 件相关的事`}
      />

      {!people.length ? (
        <p className="empty-state">还没有人物。后续记录里出现的人，可以归一到人物和别名。</p>
      ) : (
        <div className="people-relation-layout">
          <div className="person-list" aria-label="人物列表">
            {peopleWithCounts.map(({ person, relatedCount }) => {
              const aliases = personAliases(person);
              const active = person.person_id === selectedPerson?.person_id;
              return (
                <button
                  type="button"
                  className={active ? 'person-card active' : 'person-card'}
                  onClick={() => {
                    setSelectedPersonId(person.person_id);
                    setSourceFilter('all');
                  }}
                  key={person.person_id}
                >
                  <span className="person-card-main">
                    <strong>{person.display_name}</strong>
                    <em>{personRoleLabel(person)}</em>
                  </span>
                  {person.note ? <span className="person-note">{person.note}</span> : null}
                  <span className="person-aliases">
                    {aliases.slice(0, 4).map((alias) => <i key={alias}>{alias}</i>)}
                  </span>
                  <span className="person-related-count">{relatedCount} 件相关</span>
                </button>
              );
            })}
          </div>

          {selectedPerson ? (
            <section className="person-detail-panel">
              <header className="person-detail-head">
                <div>
                  <p className="eyebrow">{personRoleLabel(selectedPerson)}</p>
                  <h2>{selectedPerson.display_name}</h2>
                  {selectedPerson.note ? <p>{selectedPerson.note}</p> : null}
                </div>
                <span>{relatedItems.length}</span>
              </header>

              <div className="person-detail-block">
                <p className="eyebrow">别名</p>
                <div className="person-aliases large">
                  {personAliases(selectedPerson).map((alias) => <i key={alias}>{alias}</i>)}
                </div>
              </div>

              <div className="task-board-tabs compact" aria-label="相关事项来源">
                {peopleRelationSources.map((source) => (
                  <button
                    type="button"
                    className={sourceFilter === source.id ? 'active' : ''}
                    onClick={() => setSourceFilter(source.id)}
                    key={source.id}
                  >
                    {source.label} <span>{sourceCounts[source.id] || 0}</span>
                  </button>
                ))}
              </div>

              <div className="person-related-list">
                {filteredItems.map((item) => <PersonRelatedItem item={item} key={item.id} />)}
                {!filteredItems.length ? <p className="muted-text">这个范围还没有相关事项。</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}

function PersonRelatedItem({ item }) {
  const relationMeta = [
    personLinkRoleLabels[item.relationRole] || item.relationRole,
    item.relationMention ? `称呼：${item.relationMention}` : '',
    item.relationNote,
  ].filter(Boolean).join(' · ');

  return (
    <article className={`person-related-item ${item.source}`}>
      <div className="person-related-meta">
        <span>{item.sourceLabel}</span>
        <time>{formatFullDate(item.date) || '未记录日期'}</time>
      </div>
      <strong title={item.title}>{item.title}</strong>
      {item.body ? <p>{item.body}</p> : null}
      {relationMeta ? <em>{relationMeta}</em> : null}
      {item.meta ? <em>{item.meta}</em> : null}
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

function TaskStatusMenu({ value, onChange, label, statuses = taskWorkflowStatusOrder, labels = taskStatusLabels }) {
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
        <span>{labels[value] || value}</span>
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
                <span>{labels[status] || status}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function HabitRow({ habit, onLog, onArchive, readonly = false }) {
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
          <div className="habit-row-meta">
            <span className="habit-count">今天 · {doneToday ? 1 : 0}/1</span>
            {onArchive ? (
              <button type="button" className="habit-archive-button" onClick={onArchive}>
                移入归档
              </button>
            ) : null}
          </div>
        </div>
        <p title={habit.note}>{habit.note}</p>
        <TagPills tags={habit.tags} quality={habit.todayLog?.quality} />
      </div>
    </article>
  );
}

function HabitArchiveRow({ habit, onRestore, onDelete }) {
  return (
    <article className="habit-archive-row">
      <div className="habit-archive-main">
        <div className="habit-archive-title">
          <span>每天一次</span>
          <strong title={habit.title}>{habit.title}</strong>
        </div>
        <p title={habit.note || '没有备注'}>{habit.note || '没有备注'}</p>
        <div className="task-meta">
          <span>每天一次</span>
          <span>{formatDate(habit.created_at)} 创建</span>
        </div>
        <TagPills tags={habit.tags} quality={habit.todayLog?.quality} />
      </div>
      <div className="habit-archive-actions">
        <button type="button" className="habit-restore-button" onClick={onRestore}>恢复</button>
        <button type="button" className="task-delete-trigger" onClick={onDelete} title="删除习惯" aria-label={`删除 ${habit.title}`}>
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

function HabitHeatmap({ habits, logs }) {
  const activeHabitIds = useMemo(() => new Set(habits.map((habit) => habit.habit_id)), [habits]);
  const activeLogs = useMemo(() => logs.filter((log) => activeHabitIds.has(log.habit_id)), [logs, activeHabitIds]);
  const years = useMemo(() => habitHeatmapYears(activeLogs), [activeLogs]);
  const [year, setYear] = useState(() => years[0] || new Date().getFullYear());
  const cells = useMemo(() => buildHabitYearHeatmapCells(activeLogs, year), [activeLogs, year]);
  const weeks = useMemo(() => chunk(cells, 7), [cells]);
  const monthLabels = useMemo(() => habitHeatmapMonthLabels(weeks), [weeks]);
  const totalDone = cells.reduce((sum, cell) => sum + cell.count, 0);
  const activeCells = cells.filter((cell) => cell.count > 0).length;
  const selectedYearIndex = years.indexOf(year);
  const olderYear = selectedYearIndex >= 0 ? years[selectedYearIndex + 1] : null;
  const newerYear = selectedYearIndex > 0 ? years[selectedYearIndex - 1] : null;

  useEffect(() => {
    if (!years.includes(year)) setYear(years[0]);
  }, [years, year]);

  return (
    <section className="habit-heatmap">
      <header className="habit-heatmap-head">
        <div>
          <p className="eyebrow">习惯热力</p>
          <h2>{year} 年 · {totalDone} 次完成 · {activeCells} 天有记录</h2>
        </div>
        <div className="habit-year-picker">
          <span>年份</span>
          <div className="habit-year-switcher" aria-label="选择热力图年份">
            <button type="button" onClick={() => setYear(olderYear)} disabled={!olderYear} aria-label="上一年">
              <ChevronLeft size={15} />
            </button>
            <strong>{year}</strong>
            <button type="button" onClick={() => setYear(newerYear)} disabled={!newerYear} aria-label="下一年">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="habit-year-heatmap">
        <div className="habit-year-months" style={{ '--habit-week-count': weeks.length }} aria-hidden="true">
          {monthLabels.map((label) => (
            <span style={{ gridColumn: `${label.week + 1} / span ${label.span}` }} key={label.key}>{label.text}</span>
          ))}
        </div>
        <div className="habit-year-body">
          <div className="habit-year-weekdays" aria-hidden="true">
            {['', '一', '', '三', '', '五', ''].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="habit-year-weeks" style={{ '--habit-week-count': weeks.length }}>
            {weeks.map((week) => (
              <div className="habit-year-week" key={week[0]?.key}>
                {week.map((cell) => <HabitHeatmapCell cell={cell} key={cell.key} />)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="habit-heatmap-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((level) => <i className={`level-${level}`} key={level} />)}
        <span>多</span>
      </footer>
    </section>
  );
}

function HabitHeatmapCell({ cell }) {
  return (
    <span
      className={`habit-heatmap-cell level-${cell.level}${cell.inYear ? '' : ' outside-year'}`}
      title={`${cell.label} · ${cell.count} 次完成`}
      aria-label={`${cell.label} ${cell.count} 次完成`}
    />
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
  const height = full ? 2400 : 1440;
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

      {timelineEvents.items.map(({ item, top, height: eventHeight, isShort, showTitle, showDetails }) => {
        const visibleTags = full ? item.tags : [];
        const displayType = timelineDisplayType(item);
        const className = [
          item.end_at ? 'day-event' : 'day-event live',
          `type-${displayType}`,
          isShort ? 'short' : '',
          showTitle ? '' : 'compact',
        ].filter(Boolean).join(' ');

        return (
          <button
            type="button"
            className={className}
            style={{ top: `${top}px`, height: `${eventHeight}px` }}
            key={item.timeline_id}
            aria-label={`${formatTime(item.start_at)} - ${item.end_at ? formatTime(item.end_at) : '现在'} ${item.title}`}
            title={`${formatTime(item.start_at)} - ${item.end_at ? formatTime(item.end_at) : '现在'} ${item.title}`}
            onClick={() => onEdit(item)}
          >
            {showDetails ? (
              <span className="day-event-time">
                {formatTime(item.start_at)} - {item.end_at ? formatTime(item.end_at) : '现在'}
              </span>
            ) : null}
            {showTitle ? (
              <div className="row-title">
                <strong>{item.title}</strong>
                <Edit3 size={14} />
              </div>
            ) : null}
            {full && showDetails && item.task_code ? <span className="day-event-link">{item.task_code} · {item.task_title}</span> : null}
            {full && showDetails ? <p>{item.description}</p> : null}
            {showDetails ? <TagPills tags={visibleTags} quality={full ? item.quality : null} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function GoalCard({ goal, onEdit, onStatus, onDelete, compact = false }) {
  const showProgress = shouldShowGoalProgress(goal);
  return (
    <article className={['goal-card', compact ? 'compact' : '', showProgress ? '' : 'no-progress'].filter(Boolean).join(' ')}>
      <div className="goal-topline">
        <span>{levelLabels[goal.level] || goal.level}</span>
        <em>{formatGoalPeriod(goal)}</em>
        <GoalActions goal={goal} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} />
      </div>
      <strong title={goal.title}>{goal.title}</strong>
      <p title={goal.success_criteria || '还没有成功标准'}>{goal.success_criteria || '还没有成功标准'}</p>
      <TagPills tags={goal.tags} />
      {showProgress ? (
        <div className="progress-track">
          <i style={{ width: `${goal.progress || 12}%` }} />
        </div>
      ) : null}
    </article>
  );
}

function GoalFocusRow({ goal, onEdit, onStatus, onDelete }) {
  const showProgress = shouldShowGoalProgress(goal);
  return (
    <article className={showProgress ? 'goal-focus-row' : 'goal-focus-row no-progress'}>
      <div className="goal-focus-row-main">
        <div className="goal-focus-row-title">
          <strong title={goal.title}>{goal.title}</strong>
          <span>{formatGoalPeriod(goal)}</span>
        </div>
        <p title={goal.success_criteria || '还没有成功标准'}>{goal.success_criteria || '还没有成功标准'}</p>
        <TagPills tags={goal.tags} />
      </div>
      {showProgress ? (
        <div className="progress-track">
          <i style={{ width: `${goal.progress || 12}%` }} />
        </div>
      ) : null}
      <GoalActions goal={goal} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} />
    </article>
  );
}

function GoalArchiveRow({ goal, onEdit, onStatus, onDelete }) {
  const archiveStatus = goalArchiveStatus(goal);
  const showProgress = shouldShowGoalProgress(goal);
  return (
    <article className={`goal-archive-row ${archiveStatus}${showProgress ? '' : ' no-progress'}`}>
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
      {showProgress ? (
        <div className="progress-track">
          <i style={{ width: `${goal.progress || 12}%` }} />
        </div>
      ) : null}
      <GoalActions goal={goal} onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} />
    </article>
  );
}

function shouldShowGoalProgress(goal) {
  return goal.level !== 'day';
}

function GoalActions({ goal, onEdit, onStatus, onDelete }) {
  if (!onStatus && !onEdit && !onDelete) return null;
  return (
    <div className="goal-actions">
      {onStatus ? (
        <TaskStatusMenu
          value={goal.status}
          onChange={onStatus}
          label={`更新 ${goal.title} 状态`}
          statuses={goalWorkflowStatusOrder}
          labels={statusLabels}
        />
      ) : null}
      {onEdit ? (
        <button type="button" className="goal-icon-button" onClick={onEdit} title="编辑目标" aria-label={`编辑 ${goal.title}`}>
          <Edit3 size={13} />
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" className="goal-delete-trigger" onClick={onDelete} title="删除目标" aria-label={`删除 ${goal.title}`}>
          <Trash2 size={13} />
        </button>
      ) : null}
    </div>
  );
}

function DeleteGoalModal({ goal, onClose, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-goal-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">二次确认</p>
            <h2 id="delete-goal-title">删除「{goal.title}」？</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>
        <p className="confirm-copy">
          删除后目标会从当前目标和归档中隐藏。
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="button" className="danger-button" onClick={onConfirm}>
            <Trash2 size={16} />
            <span>删除目标</span>
          </button>
        </div>
      </section>
    </div>
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
                  {goalLevelOrder.map((level) => (
                    <option value={level} key={level}>{levelLabels[level]}</option>
                  ))}
                </select>
              </label>
              <label>
                状态
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  {goalWorkflowStatusOrder.map((status) => (
                    <option value={status} key={status}>{statusLabels[status]}</option>
                  ))}
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
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.tag_id, tag])), [tags]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const categories = useMemo(() => orderedTagCategories(tree.byCategory), [tree]);
  const selectedByCategory = useMemo(() => selected.reduce((acc, tagId) => {
    const tag = tagById.get(tagId);
    if (tag) acc[tag.category] = tagId;
    return acc;
  }, {}), [selected, tagById]);
  const selectedTags = useMemo(() => selected.map((tagId) => tagById.get(tagId)).filter(Boolean), [selected, tagById]);
  const [activeCategory, setActiveCategory] = useState(() => (
    selectedTags[0]?.category || categories[0]?.[0] || ''
  ));
  const [expandedByCategory, setExpandedByCategory] = useState({});

  useEffect(() => {
    const nextExpanded = {};
    selected.forEach((tagId) => {
      const tag = tagById.get(tagId);
      if (tag?.parent_tag_id) nextExpanded[tag.category] = tag.parent_tag_id;
      else if (tag && (tree.childrenByParent[tag.tag_id] || []).length) nextExpanded[tag.category] = tag.tag_id;
    });
    setExpandedByCategory((current) => ({ ...current, ...nextExpanded }));
  }, [selected, tagById, tree]);

  useEffect(() => {
    if (!categories.some(([category]) => category === activeCategory)) {
      setActiveCategory(categories[0]?.[0] || '');
    }
  }, [activeCategory, categories]);

  function chooseTag(tag) {
    const sameCategoryIds = tags.filter((item) => item.category === tag.category).map((item) => item.tag_id);
    const next = selected.filter((tagId) => !sameCategoryIds.includes(tagId));
    if (!selectedSet.has(tag.tag_id)) next.push(tag.tag_id);
    onChange(next);
  }

  const activeParents = categories.find(([category]) => category === activeCategory)?.[1] || [];
  const activeSelectedTag = tagById.get(selectedByCategory[activeCategory]);
  const selectedParentId = activeSelectedTag?.parent_tag_id || activeSelectedTag?.tag_id || '';
  const expandedId = expandedByCategory[activeCategory] || selectedParentId;
  const expandedParent = activeParents.find((tag) => (
    expandedId === tag.tag_id
    && (tree.childrenByParent[tag.tag_id] || []).length > 0
  ));
  const expandedChildren = expandedParent ? tree.childrenByParent[expandedParent.tag_id] || [] : [];

  return (
    <fieldset className="tag-picker">
      <legend>
        <span>标签</span>
        <small>{selectedTags.length ? `已选 ${selectedTags.length}` : '按分类选择'}</small>
      </legend>

      {selectedTags.length ? (
        <div className="tag-picker-selected" aria-label="已选标签">
          {selectedTags.map((tag) => (
            <button type="button" key={tag.tag_id} onClick={() => chooseTag(tag)} aria-label={`移除 ${tag.name}`}>
              <span>{tag.name}</span>
              <X size={12} />
            </button>
          ))}
          <button type="button" className="clear" onClick={() => onChange([])}>清空</button>
        </div>
      ) : (
        <p className="tag-picker-empty">选择能帮助后续筛选和复盘的标签。</p>
      )}

      <div className="tag-picker-categories" role="tablist" aria-label="标签分类">
        {categories.map(([category]) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === category}
            className={activeCategory === category ? 'active' : ''}
            onClick={() => setActiveCategory(category)}
            key={category}
          >
            <span>{tagCategoryLabels[category] || category}</span>
            {selectedByCategory[category] ? <i /> : null}
          </button>
        ))}
      </div>

      <div className="tag-picker-options" role="tabpanel">
        <div className="tag-parent-list">
          {activeParents.map((tag) => {
            const children = tree.childrenByParent[tag.tag_id] || [];
            const open = expandedParent?.tag_id === tag.tag_id;
            const tagSelected = selectedSet.has(tag.tag_id);
            const childSelected = children.some((child) => selectedSet.has(child.tag_id));
            const chipClassName = [
              'tag-chip',
              tagSelected ? 'selected' : '',
              childSelected ? 'child-active' : '',
            ].filter(Boolean).join(' ');
            return (
              <button
                type="button"
                className={chipClassName}
                onClick={() => {
                  chooseTag(tag);
                  if (children.length) {
                    setExpandedByCategory((current) => ({ ...current, [activeCategory]: tag.tag_id }));
                  }
                }}
                aria-expanded={children.length ? open : undefined}
                key={tag.tag_id}
              >
                {tag.name}
              </button>
            );
          })}
        </div>

        {expandedParent ? (
          <div className="tag-child-list">
            {expandedChildren.map((child) => (
              <button
                type="button"
                className={selectedSet.has(child.tag_id) ? 'tag-chip child selected' : 'tag-chip child'}
                key={child.tag_id}
                onClick={() => chooseTag(child)}
              >
                {child.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
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

function emptyTagDraft(category = 'activity_type') {
  return {
    name: '',
    tagKey: '',
    category,
    parentTagId: '',
    description: '',
    sortOrder: 100,
    isActive: true,
  };
}

function makeTagKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/[\s-]+/g, '_')
    .slice(0, 40);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('读取照片失败'));
    reader.readAsDataURL(file);
  });
}

function momentImageUrls(moment) {
  const images = (moment.images || []).map((image) => image.image_url).filter(Boolean);
  return images.length ? images : [moment.image_url].filter(Boolean);
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
  const minHeight = full ? 24 : 10;

  const laidOutItems = items.map((item) => {
    const start = clampMinute(minutesOfDay(item.start_at));
    let end = item.end_at ? clampMinute(minutesOfDay(item.end_at)) : clampMinute(minutesOfDay(now));
    if (end <= start) end = item.end_at ? Math.min(1440, start + 15) : 1440;

    const duration = end - start;
    const naturalHeight = Math.max((duration / 1440) * height, minHeight);
    const showTitle = full ? naturalHeight >= 22 : naturalHeight >= 42;
    const showDetails = full ? naturalHeight >= 68 : false;

    return {
      item,
      top: (start / 1440) * height,
      height: naturalHeight,
      isShort: duration < 45,
      showTitle,
      showDetails,
    };
  });

  return {
    items: laidOutItems,
    trackHeight: height,
  };
}

function timelineDisplayType(item) {
  const titleDisplayType = timelineDisplayTypeFromText(item.title, ['health', 'meal', 'rest', 'commute']);
  if (titleDisplayType) return titleDisplayType;

  const tagDisplayType = timelineDisplayTypeFromTags(item);
  if (tagDisplayType) return tagDisplayType;

  return timelineDisplayTypeFromText([
    item.kind,
    item.title,
    item.description,
    ...(item.tags || []),
  ].filter(Boolean).join(' ')) || 'activity';
}

function timelineDisplayTypeFromText(value, allowedTypes = null) {
  const haystack = String(value || '').toLowerCase();
  if (matchesAny(haystack, ['健身', '运动', 'workout', 'training'])) return 'health';
  if (matchesAny(haystack, ['饭', '早餐', '午餐', '晚餐', '吃', 'meal', 'food'])) return 'meal';
  if (matchesAny(haystack, ['休息', '睡', 'nap', 'rest'])) return 'rest';
  if (matchesAny(haystack, ['通勤', '路上', '出发', 'commute'])) return 'commute';
  if (allowedTypes) return null;
  if (matchesAny(haystack, ['openclaw', 'alayabox', 'alayajet', 'b300', 'debug', '代码', '深度工作', '项目推进', '修复', '调试'])) return 'work';
  if (matchesAny(haystack, ['note', 'state_event', 'schedule_event', '记录', '确认'])) return 'note';
  return null;
}

const timelineTagDisplayTypes = {
  work: 'work',
  writing: 'work',
  code: 'work',
  design: 'work',
  docs: 'work',
  research: 'work',
  debug: 'work',
  review: 'work',
  project_progress: 'work',
  study: 'study',
  reading: 'study',
  papers: 'study',
  courses: 'study',
  tech_learning: 'study',
  english: 'study',
  notes: 'study',
  meeting: 'meeting',
  meeting_session: 'meeting',
  ask_help: 'meeting',
  reporting: 'meeting',
  collaboration: 'meeting',
  client_communication: 'meeting',
  personal_communication: 'meeting',
  rest: 'rest',
  sleep: 'rest',
  downtime: 'rest',
  videos: 'rest',
  movie: 'rest',
  travel: 'rest',
  meals: 'meal',
  exercise: 'health',
  workout: 'health',
  running: 'health',
  swimming: 'health',
  stretching: 'health',
  ball_sports: 'health',
  admin: 'admin',
  reimbursement: 'admin',
  organize: 'admin',
  purchase: 'admin',
  appointment: 'admin',
  payment: 'admin',
  admin_process: 'admin',
  commute: 'commute',
};

const timelineTagNameDisplayTypes = {
  工作: 'work',
  写作: 'work',
  代码: 'work',
  设计: 'work',
  文档: 'work',
  调研: 'work',
  debug: 'work',
  复盘: 'work',
  项目推进: 'work',
  学习: 'study',
  看书: 'study',
  论文: 'study',
  课程: 'study',
  技术学习: 'study',
  英语: 'study',
  笔记: 'study',
  沟通: 'meeting',
  会议: 'meeting',
  请教: 'meeting',
  汇报: 'meeting',
  协作讨论: 'meeting',
  客户沟通: 'meeting',
  私人沟通: 'meeting',
  休息: 'rest',
  睡觉: 'rest',
  放空: 'rest',
  看视频: 'rest',
  看电影: 'rest',
  旅行: 'rest',
  吃饭: 'meal',
  运动: 'health',
  健身: 'health',
  跑步: 'health',
  游泳: 'health',
  拉伸: 'health',
  球类: 'health',
  事务: 'admin',
  报销: 'admin',
  整理: 'admin',
  采购: 'admin',
  预约: 'admin',
  缴费: 'admin',
  行政: 'admin',
  通勤: 'commute',
};

function timelineDisplayTypeFromTags(item) {
  for (const tagKey of item.tagKeys || []) {
    const displayType = timelineTagDisplayTypes[String(tagKey).toLowerCase()];
    if (displayType) return displayType;
  }

  for (const tagName of item.tags || []) {
    const displayType = timelineTagNameDisplayTypes[String(tagName).toLowerCase()] || timelineTagNameDisplayTypes[tagName];
    if (displayType) return displayType;
  }

  return null;
}

function matchesAny(value, needles) {
  return needles.some((needle) => value.includes(needle.toLowerCase()));
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

function endOfWeek(value) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function weekDates(value) {
  const start = startOfWeek(typeof value === 'string' ? dateFromKey(value) : value);
  return Array.from({ length: 7 }, (_, index) => (
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  ));
}

function formatWeekday(value) {
  return new Date(value).toLocaleDateString('zh-CN', { weekday: 'short' }).replace('星期', '周');
}

function formatWeekRange(value) {
  const [start, , , , , , end] = weekDates(value);
  const startText = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endText = start.getMonth() === end.getMonth()
    ? `${end.getDate()}日`
    : `${end.getMonth() + 1}月${end.getDate()}日`;
  return `${start.getFullYear()}年 · ${startText}—${endText}`;
}

function weekRelativeLabel(value) {
  const selected = startOfWeek(typeof value === 'string' ? dateFromKey(value) : value);
  const current = startOfWeek(new Date());
  const offset = Math.round((selected.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (offset === 0) return '本周';
  if (offset === -1) return '上周';
  if (offset === 1) return '下周';
  const end = endOfWeek(selected);
  return `${selected.getMonth() + 1}/${selected.getDate()}—${end.getMonth() + 1}/${end.getDate()}`;
}

function taskCoversDate(task, dateKey) {
  return taskWeekDisplayDates(task).includes(dateKey);
}

function sortWeekTaskList(tasks) {
  return [...tasks].sort((a, b) => (
    Number(['done', 'abandoned'].includes(a.status)) - Number(['done', 'abandoned'].includes(b.status))
    || Number(a.status === 'abandoned') - Number(b.status === 'abandoned')
    || taskCurrentStatusOrder.indexOf(a.status) - taskCurrentStatusOrder.indexOf(b.status)
    || Number(a.priority || 3) - Number(b.priority || 3)
    || new Date(a.created_at) - new Date(b.created_at)
  ));
}

function taskWeekDisplayDates(task) {
  if (task.status === 'done') {
    const completedAuditDate = task.completed_at ? localDateKey(task.completed_at) : '';
    return (task.plannedDates || []).filter((dateKey) => !completedAuditDate || dateKey <= completedAuditDate);
  }
  const abandonedDate = task.status === 'abandoned' && task.status_updated_at
    ? localDateKey(task.status_updated_at)
    : '';
  const plannedDates = abandonedDate
    ? (task.plannedDates || []).filter((dateKey) => dateKey <= abandonedDate)
    : (task.plannedDates || []);
  const dates = new Set(plannedDates);
  if (abandonedDate) dates.add(abandonedDate);
  return [...dates].sort();
}

function taskCompletionWorkDate(task) {
  return task.status === 'done' ? taskWeekDisplayDates(task).at(-1) || '' : '';
}

function groupConsecutiveDates(dateKeys) {
  return dateKeys.reduce((ranges, dateKey) => {
    const current = ranges.at(-1);
    if (current && dayDistance(current.end, dateKey) === 1) {
      current.end = dateKey;
    } else {
      ranges.push({ start: dateKey, end: dateKey });
    }
    return ranges;
  }, []);
}

function layoutWeekTaskSpans(tasks, days) {
  const weekStartKey = localDateKey(days[0]);
  const weekEndKey = localDateKey(days[6]);
  const sorted = tasks.flatMap((task) => {
    const terminalDate = task.status === 'done'
      ? taskCompletionWorkDate(task)
      : task.status === 'abandoned' && task.status_updated_at
        ? localDateKey(task.status_updated_at)
        : '';
    return groupConsecutiveDates(taskWeekDisplayDates(task))
      .filter((range) => range.start <= weekEndKey && range.end >= weekStartKey)
      .map((range) => ({ task, range, terminal: Boolean(terminalDate && range.start <= terminalDate && range.end >= terminalDate) }));
  }).sort((a, b) => (
    a.range.start.localeCompare(b.range.start)
    || b.range.end.localeCompare(a.range.end)
    || Number(a.task.status === 'done') - Number(b.task.status === 'done')
    || Number(a.task.priority || 3) - Number(b.task.priority || 3)
  ));
  const laneEnds = [];

  return sorted.map(({ task, range, terminal }) => {
    const startIndex = Math.max(0, dayDistance(weekStartKey, range.start));
    const endIndex = Math.min(6, dayDistance(weekStartKey, range.end));
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < startIndex);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endIndex;
    return { task, range, terminal, startIndex, endIndex, lane, key: `${task.task_id}-${range.start}-${range.end}` };
  });
}

function dayDistance(fromKey, toKey) {
  const from = dateFromKey(fromKey);
  const to = dateFromKey(toKey);
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86400000);
}

function formatWeekTaskBarRange(span) {
  const start = dateFromKey(span.range.start);
  const end = dateFromKey(span.range.end);
  const startText = `${start.getMonth() + 1}/${start.getDate()}`;
  const endText = `${end.getMonth() + 1}/${end.getDate()}`;
  if (span.task.status === 'abandoned' && span.terminal) return `${endText} 放弃`;
  if (span.task.status === 'done' && span.terminal) {
    return startText === endText ? `${endText} 完成` : `${startText}—${endText} 完成`;
  }
  return startText === endText ? `${startText} 进行` : `${startText}—${endText} 进行`;
}

function taskPriorityLevel(priority) {
  const value = Number(priority || 3);
  if (value <= 2) return 'high';
  if (value >= 4) return 'low';
  return 'medium';
}

function taskPriorityLabel(priority) {
  return { high: '高', medium: '中', low: '低' }[taskPriorityLevel(priority)];
}

function habitHeatmapYears(logs) {
  const years = new Set([new Date().getFullYear()]);
  logs.forEach((log) => {
    if (!log.local_date) return;
    const year = dateFromKey(log.local_date).getFullYear();
    if (!Number.isNaN(year)) years.add(year);
  });
  return [...years].sort((a, b) => b - a);
}

function buildHabitYearHeatmapCells(logs, year) {
  const selectedYear = Number(year) || new Date().getFullYear();
  const countByDate = logs.reduce((acc, log) => {
    if (log.status !== 'done') return acc;
    acc[log.local_date] = (acc[log.local_date] || 0) + 1;
    return acc;
  }, {});
  const start = startOfWeek(new Date(selectedYear, 0, 1));
  const end = endOfWeek(new Date(selectedYear, 11, 31));
  const cells = [];

  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const cellDate = new Date(date);
    const key = localDateKey(cellDate);
    const inYear = cellDate.getFullYear() === selectedYear;
    cells.push({
      key,
      date: cellDate,
      inYear,
      label: formatFullDate(cellDate),
      count: inYear ? countByDate[key] || 0 : 0,
    });
  }

  const maxCount = Math.max(1, ...cells.filter((cell) => cell.inYear).map((cell) => cell.count));
  return cells.map((cell) => ({
    ...cell,
    level: cell.inYear ? habitHeatmapLevel(cell.count, maxCount) : 0,
  }));
}

function habitHeatmapMonthLabels(weeks) {
  const labels = [];
  const seen = new Set();
  weeks.forEach((week, weekIndex) => {
    const monthStart = week.find((cell) => cell.inYear && cell.date.getDate() <= 7);
    if (!monthStart) return;
    const key = `${monthStart.date.getFullYear()}-${monthStart.date.getMonth()}`;
    if (seen.has(key)) return;
    seen.add(key);
    labels.push({
      key,
      week: weekIndex,
      span: 4,
      text: `${monthStart.date.getMonth() + 1}月`,
    });
  });
  return labels;
}

function habitHeatmapLevel(count, maxCount) {
  if (!count) return 0;
  return Math.max(1, Math.ceil((count / maxCount) * 4));
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function taskArchiveTime(task) {
  return task.completed_at || task.status_updated_at || task.created_at;
}

function sortTasksByArchiveDate(tasks) {
  return [...tasks].sort((a, b) => new Date(taskArchiveTime(b)) - new Date(taskArchiveTime(a)));
}

function sortTasksByDueDate(tasks) {
  return [...tasks].sort((a, b) => (
    taskDueTime(a) - taskDueTime(b)
    || Number(a.priority || 99) - Number(b.priority || 99)
    || new Date(a.created_at) - new Date(b.created_at)
  ));
}

function taskDueTime(task) {
  return task.due_at ? new Date(task.due_at).getTime() : Number.MAX_SAFE_INTEGER;
}

function buildTaskDueGroups(tasks) {
  const groups = [
    { key: 'overdue', title: '逾期', tasks: [] },
    { key: 'today', title: '今天', tasks: [] },
    { key: 'week', title: '本周', tasks: [] },
    { key: 'later', title: '以后', tasks: [] },
    { key: 'none', title: '无截止', tasks: [] },
  ];
  const byKey = new Map(groups.map((group) => [group.key, group]));
  const todayKey = localDateKey(new Date());
  const weekEnd = endOfWeek(new Date());

  tasks.forEach((task) => {
    if (!task.due_at) {
      byKey.get('none').tasks.push(task);
      return;
    }

    const dueDate = new Date(task.due_at);
    const dueKey = localDateKey(dueDate);
    if (dueKey < todayKey) byKey.get('overdue').tasks.push(task);
    else if (dueKey === todayKey) byKey.get('today').tasks.push(task);
    else if (dueDate <= weekEnd) byKey.get('week').tasks.push(task);
    else byKey.get('later').tasks.push(task);
  });

  groups.forEach((group) => {
    group.tasks = sortTasksByDueDate(group.tasks);
  });
  return groups;
}

function buildTaskGoalGroups(tasks) {
  const byGoal = new Map();
  tasks.forEach((task) => {
    const key = task.goal_id || 'none';
    if (!byGoal.has(key)) {
      byGoal.set(key, {
        key,
        title: task.goal_title || '未关联目标',
        tasks: [],
      });
    }
    byGoal.get(key).tasks.push(task);
  });

  if (!byGoal.size) return [{ key: 'none', title: '未关联目标', tasks: [] }];

  return [...byGoal.values()]
    .map((group) => ({ ...group, tasks: sortTasksByDueDate(group.tasks) }))
    .sort((a, b) => (
      (a.key === 'none') - (b.key === 'none')
      || a.title.localeCompare(b.title, 'zh-CN')
    ));
}

function personAliases(person) {
  return [...new Set([person.display_name, ...(person.aliases || [])]
    .map((alias) => String(alias || '').trim())
    .filter(Boolean))];
}

function personRoleLabel(person) {
  return person.role || personRelationshipLabels[person.relationship_type] || person.relationship_type || '人物';
}

function buildPersonRelatedItems(person) {
  return [...(person.relatedRecords || [])]
    .filter((item) => item.title)
    .sort((a, b) => relationDateValue(b.date) - relationDateValue(a.date));
}

function relationDateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function isCurrentGoal(goal) {
  return goal.status === 'active' && !isPastDate(goal.period_end);
}

function isArchivedGoal(goal) {
  return goalArchiveStatusOrder.includes(goalArchiveStatus(goal));
}

function goalArchiveStatus(goal) {
  if (goal.status === 'done') return 'done';
  if (goal.status === 'not_done') return 'not_done';
  if (goal.status === 'abandoned') return 'abandoned';
  if (goal.status === 'active' && isPastDate(goal.period_end)) return 'not_done';
  return '';
}

function sortGoalsByPeriod(goals) {
  return [...goals].sort((a, b) => new Date(b.period_end || b.created_at) - new Date(a.period_end || a.created_at));
}

function formatGoalLevelSummary(level, count) {
  const names = { all: '当前', day: '今天', week: '本周', month: '本月', year: '今年' };
  return `${names[level] || '当前周期'} ${count} 个进行中`;
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

function formatFullDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

createRoot(document.getElementById('root')).render(<App />);
