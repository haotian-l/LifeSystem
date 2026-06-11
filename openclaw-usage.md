# OpenClaw 使用个人工作台协议

这份文档给 OpenClaw 智能体使用。OpenClaw 接收自然语言，负责理解、拆解和编排；个人工作台只接受确定性的结构化 API 写入。

核心边界：

- OpenClaw 可以读自然语言。
- 本系统不解析自然语言。
- 本系统没有 `/api/chat` 自然语言入口。
- OpenClaw 必须把自然语言转成结构化 operations，再调用确定性 API。
- 所有值得留存的数据都默认写入 LifeSystem，包括原始输入、时间线、任务、目标、习惯、日程、人物、高光、复盘和提醒。
- 外部系统不再作为默认账本；除非用户明确要求导出或同步，否则不要写 Notion、Markdown 账本或其他外部存储。

默认服务地址：`http://127.0.0.1:4173`

## 1. OpenClaw 总工作流

每次用户给 OpenClaw 一段话时，按这个流程处理：

1. 读取上下文：`GET /api/dashboard`。
2. 保存证据：把用户原话作为 `source_input`；只要这句话触发任何留存写入，就必须保留原始输入。
3. 判断相关模块：目标、任务、时间线、习惯、日程、标签、人物、高光、复盘、提醒。
4. 解析结构化字段：时间、标题、状态、对象、人物、标签、关联 ID。
5. 生成写入计划：一个或多个 operations。
6. 调用 `POST /api/ingest` 批量写入。
7. 再读 dashboard 或使用返回值校验结果。
8. 向用户说明写入了哪些模块、哪些地方因不确定而没有写。

不要跳过第 1 步。很多话需要上下文才能判断是在更新已有任务、关闭当前 timeline，还是创建新记录。

## 2. 什么时候关联哪些模块

OpenClaw 应从一句话里识别多个模块，而不是只选一个。

| 用户表达 | 应考虑模块 | 说明 |
| --- | --- | --- |
| “刚才 10 点到 11 点写方案” | `source_input` + `timeline` | 已发生事实，写时间线。 |
| “开始写 OpenClaw 文档” | `source_input` + `timeline`，可能 `task` | 如果已有任务，关联任务；否则只记事实，除非用户明确要建任务。 |
| “把整理文档这个任务做完了” | `source_input` + `task:update`，可能 `timeline` | 先在 dashboard 找匹配任务，再改状态。 |
| “明天 10 点和游老师复盘目标” | `source_input` + `schedule` + `person` | 未来计划写日程；先用 alias 定位 person_id，再把 personRefs 写到日程。 |
| “游老师就是游正新” | `source_input` + `person:update` | 更新已有人物 alias，不要建 tag。 |
| “这个算今天高光，配图是 xxx” | `source_input` + `moment`，可能 `timeline` | 高光是画册项，独立于 tag。 |
| “这个月目标是稳定记录 20 天” | `source_input` + `goal` | 创建或更新月目标。 |
| “每天睡前复盘一下” | `source_input` + `habit` | 习惯默认每天一次。 |
| “提醒我周五前确认方案” | `source_input` + `reminder`，可能 `task` | 如果是一次性行动，通常建任务或提醒。 |
| “昨天状态很好，但是下午被打断” | `source_input` + `timeline` 或 `review`，可能 `tag` | 状态是事实或复盘内容；tag 只能用已有受控集合。 |

## 3. 上下文读取规则

先调用：

```bash
curl -s http://127.0.0.1:4173/api/dashboard
```

重点检查：

- `timeline`：是否有未结束 timeline、是否有同日相近记录。
- `tasks`：是否已有同名或近似任务、任务状态、关联目标。
- `goals`：当前日/周/月/年目标和归档目标。
- `people`：人物主名、aliases、relatedRecords。alias 只用于识别人物，不代表已经建立关系。
- `moments`：同一天是否已经有类似高光。
- `schedule`：未来日程是否重复。
- `habits` / `habitLogs`：习惯是否存在、今天是否已记录。
- `allTags`：可用标签集合。不要随意造标签。
- `reviews`：已有日报/周报/月报，不要因查看而新建。
- `reminders`：待提醒事项。

上下文不足时：

- 能确定的事实先写。
- 不能确定的关联留空。
- 不要臆造目标、人物、标签或任务。
- 对高风险歧义向用户确认，例如同名任务、多人同 alias、时间不明确。

## 4. 推荐入口：批量 ingest

一段自然语言通常会影响多个模块。OpenClaw 应优先使用：

```bash
POST /api/ingest
```

请求结构：

```json
{
  "rawText": "用户原话",
  "happenedAt": "2026-06-09T10:00:00.000Z",
  "operations": [
    {
      "ref": "main_timeline",
      "entity": "timeline",
      "action": "create",
      "data": {
        "title": "和游老师讨论目标系统",
        "description": "确认人物关系要显式挂载",
        "startAt": "2026-06-09T10:00:00.000Z",
        "endAt": "2026-06-09T11:00:00.000Z",
        "kind": "activity_block",
        "quality": 5,
        "personRefs": [
          {
            "personId": "person_you_zhengxin",
            "role": "participant",
            "mentionText": "游老师",
            "note": "目标系统讨论对象"
          }
        ],
        "tagKeys": ["meeting", "high_value"]
      }
    },
    {
      "ref": "highlight",
      "entity": "moment",
      "action": "create",
      "data": {
        "title": "确认人物显式挂载",
        "story": "和游老师讨论后，确认人物关系用 personRefs 显式写入，而不是混进标签。",
        "importance": 5,
        "timelineRef": "main_timeline",
        "personRefs": [
          {
            "personId": "person_you_zhengxin",
            "role": "participant",
            "mentionText": "游老师"
          }
        ],
        "tagKeys": ["high_value"]
      }
    }
  ]
}
```

返回值会包含：

- 普通 dashboard 字段。
- `ingest.sourceInputId`：本次用户原话对应的 source input。
- `ingest.results[]`：每个 operation 的创建 ID。

`ref` 用于串联同一批写入。比如先创建 `main_timeline`，后面的高光可用 `"timelineRef": "main_timeline"` 关联。

## 5. Operation 协议

每个 operation 使用统一格式：

```json
{
  "ref": "本批次内部引用名，可选",
  "entity": "模块名",
  "action": "create | update | log",
  "targetId": "更新目标 ID，可选",
  "data": {}
}
```

支持的 `entity`：

- `source_input`
- `timeline`
- `goal`
- `task`
- `habit`
- `habit_log`
- `schedule`
- `reminder`
- `tag`
- `review`
- `moment`
- `person`

支持的 ref 字段：

- `sourceInputRef` -> `sourceInputId`
- `timelineRef` -> `timelineId`
- `taskRef` -> `taskId`
- `goalRef` -> `goalId`
- `habitRef` -> `habitId`
- `momentRef` -> `momentId`
- `personRef` -> `personId`
- `eventRef` -> `eventId`
- `reminderRef` -> `reminderId`
- `reviewRef` -> `reviewId`

默认规则：

- 顶层 `rawText` 会自动创建一次 `source_input`。
- `timeline` 和 `moment` 如果没有显式 `sourceInputId`，会自动关联顶层 source input。
- `action` 不写时默认 `create`。
- `entity=habit_log` 默认 `action=log`。

## 6. 单实体 API

批量入口用于一段话的整体落库；单实体 API 用于精确编辑或补录。

### Source Input

```bash
curl -s http://127.0.0.1:4173/api/source-inputs \
  -H 'Content-Type: application/json' \
  -d '{"rawText":"用户原话","happenedAt":"2026-06-09T10:00:00.000Z","channel":"openclaw","author":"user"}'
```

### Timeline

```bash
curl -s http://127.0.0.1:4173/api/timeline \
  -H 'Content-Type: application/json' \
  -d '{"title":"写 OpenClaw 文档","startAt":"2026-06-09T10:00:00.000Z","endAt":"2026-06-09T11:00:00.000Z","kind":"activity_block","tagKeys":["work","writing"]}'
```

更新：

```bash
curl -s -X PATCH http://127.0.0.1:4173/api/timeline/<timeline_id> \
  -H 'Content-Type: application/json' \
  -d '{"quality":5,"description":"补充说明"}'
```

Timeline `kind`：

- `activity_block`：活动块。
- `state_event`：状态事件。
- `gap`：空档。
- `note`：备注。
- `schedule_event`：由日程转成的记录。

### Goal

```bash
curl -s http://127.0.0.1:4173/api/goals \
  -H 'Content-Type: application/json' \
  -d '{"title":"稳定记录 20 天","level":"month","successCriteria":"每天至少一条 timeline","tagKeys":["high_value"]}'
```

`level`：`day`、`week`、`month`、`year`。

### Task

```bash
curl -s http://127.0.0.1:4173/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"整理 OpenClaw 使用文档","description":"写清楚模块识别和 API","status":"todo","dueAt":"2026-06-10T12:00:00.000Z","goalId":"<goal_id>","tagKeys":["work","high_value"]}'
```

`status`：`todo`、`doing`、`blocked`、`done`、`abandoned`、`deleted`。

### Habit / Habit Log

习惯默认每天一次，不区分每周几次。

```bash
curl -s http://127.0.0.1:4173/api/habits \
  -H 'Content-Type: application/json' \
  -d '{"title":"每天记录一句 timeline","note":"保持低负担","tagKeys":["writing","review"]}'
```

记录完成：

```bash
curl -s http://127.0.0.1:4173/api/habits/<habit_id>/log \
  -H 'Content-Type: application/json' \
  -d '{"localDate":"2026-06-09","status":"done","quality":4,"note":"今天已记录"}'
```

### Schedule

```bash
curl -s http://127.0.0.1:4173/api/schedule \
  -H 'Content-Type: application/json' \
  -d '{"title":"和游老师复盘目标系统","startAt":"2026-06-10T10:00:00.000Z","endAt":"2026-06-10T11:00:00.000Z","location":"线上","note":"确认目标和提醒规则","tagKeys":["meeting","high_value"]}'
```

### Reminder

```bash
curl -s http://127.0.0.1:4173/api/reminders \
  -H 'Content-Type: application/json' \
  -d '{"title":"周五前确认方案","reminderType":"follow_up","reason":"用户要求周五前确认","suggestedAction":"检查任务进度并提醒用户","taskId":"<task_id>"}'
```

`status`：`pending`、`reminded`、`done`、`ignored`、`snoozed`。

### Tag

先读 `allTags`，能映射到已有标签就不要新建。

```bash
curl -s http://127.0.0.1:4173/api/tags \
  -H 'Content-Type: application/json' \
  -d '{"name":"深度工作","tagKey":"deep_work","category":"work_mode"}'
```

标签分类：

- `activity_type`：活动。
- `work_mode`：工作模式。
- `value_signal`：价值。
- `state_signal`：过程状态。
- `energy_state`：身体精力。
- `mood_state`：情绪。
- `environment`：场景。
- `life_area`：领域。

同一分类尽量互斥。例如“工作”和“游戏”不要同时用于同一条记录；“精力足”和“疲惫”不要同时用于同一条记录。

### Review

```bash
curl -s http://127.0.0.1:4173/api/reviews \
  -H 'Content-Type: application/json' \
  -d '{"title":"昨日复盘","reviewType":"day","periodStart":"2026-06-08","periodEnd":"2026-06-08","summary":"昨天完成了...","learnings":"...","nextActions":"..."}'
```

日报、周报、月报应指向已结束周期：

- 日报：昨天。
- 周报：上周。
- 月报：上个月。

切换日报/周报/月报只是查看，不要创建复盘。

### Moment

```bash
curl -s http://127.0.0.1:4173/api/moments \
  -H 'Content-Type: application/json' \
  -d '{"title":"确认系统主线","story":"目标决定方向，timeline 证明真实投入。","importance":5,"imageUrl":"https://example.com/photo.jpg","timelineId":"<timeline_id>","tagKeys":["high_value"]}'
```

Moment 是高光画册项，不是普通标签。

### Person

```bash
curl -s http://127.0.0.1:4173/api/people \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"游正新","role":"老师","relationshipType":"mentor","note":"目标系统讨论对象","aliases":["游正新","游老师","正新"]}'
```

更新 alias：

```bash
curl -s -X PATCH http://127.0.0.1:4173/api/people/<person_id> \
  -H 'Content-Type: application/json' \
  -d '{"aliases":["游正新","游老师","正新"]}'
```

人物不要写进 tag。alias 只用于把自然语言里的称呼解析成稳定 `person_id`；如果一条记录和人有关，OpenClaw 必须在这条记录的 `personRefs` / `personIds` / `people` 字段里显式写入人物关系。

关系方向：

- Person 是人物索引的根。
- Timeline、task、schedule、moment、review、goal、habit、reminder 等记录通过 `personRefs` 挂到 Person。
- 人物页只读取这些显式关系，不再扫描文本匹配 `displayName` 或 aliases。
- 如果一件事和某个人有关，事件挂载到人上；不要把人当 tag，也不要只把人名留在时间文本里。

`personRefs` 支持字符串 ID，也支持对象：

```json
[
  {
    "personId": "person_you_zhengxin",
    "role": "participant",
    "mentionText": "游老师",
    "confidence": 1,
    "note": "目标系统讨论对象"
  }
]
```

如果同一批 ingest 里先创建人物，可以用 operation 的 `ref` 串联：

```json
{
  "operations": [
    {
      "ref": "teacher",
      "entity": "person",
      "data": {
        "displayName": "游正新",
        "role": "老师",
        "relationshipType": "mentor",
        "aliases": ["游正新", "游老师"]
      }
    },
    {
      "entity": "timeline",
      "data": {
        "title": "和游老师讨论目标系统",
        "personRefs": [
          {
            "personRef": "teacher",
            "role": "participant",
            "mentionText": "游老师"
          }
        ]
      }
    }
  ]
}
```

## 7. 自然语言到 operations 示例

用户说：

> 10 点到 11 点和游老师讨论目标系统，确认人物要显式挂载，这个算今天高光。顺便提醒我周五前把 OpenClaw 文档补完。

OpenClaw 应先读 dashboard，发现 `people` 里已有 `游老师 -> 游正新`。然后提交：

```json
{
  "rawText": "10 点到 11 点和游老师讨论目标系统，确认人物要显式挂载，这个算今天高光。顺便提醒我周五前把 OpenClaw 文档补完。",
  "happenedAt": "2026-06-09T11:00:00.000Z",
  "operations": [
    {
      "ref": "discussion",
      "entity": "timeline",
      "data": {
        "title": "和游老师讨论目标系统",
        "description": "确认人物关系要通过 personRefs 显式挂载。",
        "startAt": "2026-06-09T10:00:00.000Z",
        "endAt": "2026-06-09T11:00:00.000Z",
        "kind": "activity_block",
        "quality": 5,
        "personRefs": [
          {
            "personId": "person_you_zhengxin",
            "role": "participant",
            "mentionText": "游老师",
            "note": "目标系统讨论对象"
          }
        ],
        "tagKeys": ["meeting", "high_value"]
      }
    },
    {
      "ref": "relation_moment",
      "entity": "moment",
      "data": {
        "title": "确认人物显式挂载",
        "story": "和游老师讨论目标系统后，确认事件如果和人有关，就通过 personRefs 挂到人物上，而不是混进标签或只靠文本。",
        "importance": 5,
        "timelineRef": "discussion",
        "personRefs": [
          {
            "personId": "person_you_zhengxin",
            "role": "participant",
            "mentionText": "游老师"
          }
        ],
        "tagKeys": ["high_value"]
      }
    },
    {
      "ref": "doc_task",
      "entity": "task",
      "data": {
        "title": "补完 OpenClaw 使用文档",
        "description": "写清楚自然语言如何拆模块并调用确定性接口。",
        "status": "todo",
        "dueAt": "2026-06-12T23:59:00.000Z",
        "tagKeys": ["work", "writing"]
      }
    },
    {
      "ref": "doc_reminder",
      "entity": "reminder",
      "data": {
        "title": "周五前补完 OpenClaw 文档",
        "reminderType": "follow_up",
        "reason": "用户要求周五前补完。",
        "suggestedAction": "检查任务进度，必要时提醒用户继续补文档。",
        "taskRef": "doc_task"
      }
    }
  ]
}
```

## 8. 决策细则

### 创建还是更新

- 有明确“完成、推进、阻塞、放弃、删除”且 dashboard 能匹配到任务：更新任务。
- 找不到匹配任务，但用户表达的是具体行动：创建任务。
- 表达是实际发生的时间段：创建 timeline。
- 表达是系统规则、账本选择、技能设计或决策确认：先保存 `source_input`，必要时创建 `moment`、`review` 或短 `note`；不要默认创建未结束 timeline。
- 表达是未来时间：创建 schedule 或 reminder。
- 表达是长期方向或成功标准：创建或更新 goal。
- 表达是每天重复承诺：创建 habit。
- 表达是人物别名、身份、关系：创建或更新 person。
- 表达是值得保存的时刻、照片、故事：创建 moment。

### 时间处理

- 已发生事实用 `timeline.startAt/endAt`。
- 只有真实占用时间的行动才写成持续 timeline；决策确认、状态声明、配置变更不应伪装成持续工作块。
- 正在进行的 timeline 必须能回答“现在实际在做什么”；切换事项或开始休息时，要关闭上一条未结束 timeline。
- 未来安排用 `schedule.startAt/endAt`。
- 只有日期没有时间，能确定日期就写日期相关字段；不能确定具体时间时不要编造小时。
- 用户说“昨天/上周/上个月”时，按当前日期换算成绝对日期后写入。

### 人物处理

- 先查 `people.aliases`。
- 命中 alias：引用已有人物，不新建。
- 用户明确说“X 就是 Y / X 也叫 Y”：更新同一人物 aliases。
- 用户只是提到陌生名字：如果这条记录需要人物关系，可创建 person；如果不确定，先只在文本里保留名字。
- 只要记录和人有关，就在对应 operation 的 `data.personRefs` 里写入 `personId`、`role`、`mentionText` 和必要备注。
- 不要通过扫描 timeline/task/moment/review 文本来补关系；关系必须由 OpenClaw 确定后显式写入。

### 标签处理

- 先用 `allTags` 映射。
- 不确定时不打标签。
- 不要把人名、项目名当 tag。
- 不要为了覆盖所有信息而新建标签。

### 高光处理

- 高光需要标题和故事。
- 有图片时填 `imageUrl`。
- 能关联 timeline 时用 `timelineRef` 或 `timelineId`。
- 高光可以和 timeline 同源，但不是 timeline 的标签。

## 9. 校验要求

每次写入后，OpenClaw 至少检查：

- `ingest.results` 是否包含预期 entity。
- dashboard 中是否出现新记录或更新后的状态。
- 任务/目标/习惯是否没有重复创建。
- 人物 alias 是否没有拆成多个重复人物。
- 和人物有关的记录是否出现在对应 `people[].relatedRecords`。
- 高光是否能在 `moments` 里看到。
- 若使用 ref，后续记录是否正确关联前序 ID。

如果接口返回成功但 dashboard 不符合预期，OpenClaw 应停止继续写入，并把差异报告给用户。

## 10. 禁止事项

- 不要调用不存在的自然语言入口。
- 不要让系统解析自然语言。
- 不要直接编辑 SQLite。
- 不要把可留存数据只写进聊天回复、临时记忆、Markdown 文件或 Notion；默认事实主账本是 LifeSystem。
- 不要为了 UI 有内容而制造事实。
- 不要因为查看日报/周报/月报而创建复盘。
- 不要新建重复目标、任务、习惯、人物。
- 不要随意新增 tag。
- 不要把人物、状态、项目混成同一个 tag。
- 不要让人物页靠别名扫描文本生成关系。
- 不要把和人有关的事件只挂在时间线上而没有 `personRefs`。
- 不要把未来计划写成已经发生的 timeline。
