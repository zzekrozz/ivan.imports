export const CONTROL_TIME_ZONE = "Europe/Madrid";
export const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeTimeZone(value, fallback = CONTROL_TIME_ZONE) {
  const candidate = String(value || "").trim().slice(0, 80);
  try {
    if (candidate) new Intl.DateTimeFormat("en", { timeZone: candidate }).format();
    return candidate || fallback;
  } catch {
    return fallback;
  }
}

function zonedParts(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  return Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function dateKey(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function monthKey(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  return dateKey(value, timeZone).slice(0, 7);
}

export function weekdayNumber(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const weekday = zonedParts(value, timeZone).weekday;
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[weekday] || 1;
}

export function weekKey(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const currentKey = dateKey(value, timeZone);
  const noonUtc = new Date(`${currentKey}T12:00:00Z`);
  noonUtc.setUTCDate(noonUtc.getUTCDate() - (weekdayNumber(value, timeZone) - 1));
  return dateKey(noonUtc, "UTC");
}

export function addDaysToDateKey(key, days) {
  const date = new Date(`${String(key).slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function zonedDateTimeToUtc(date, time, timeZone = CONTROL_TIME_ZONE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) return null;
  const [year, month, day] = String(date).split("-").map(Number);
  const [hour, minute] = String(time).split(":").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const zone = normalizeTimeZone(timeZone);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let estimate = target;
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = zonedParts(estimate, zone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    estimate += target - represented;
  }
  const final = zonedParts(estimate, zone);
  if (Number(final.year) !== year || Number(final.month) !== month || Number(final.day) !== day || Number(final.hour) !== hour || Number(final.minute) !== minute) return null;
  return new Date(estimate).toISOString();
}

function recurrenceStart(quest, timeZone) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(quest?.scheduled_date || "")) return quest.scheduled_date;
  if (quest?.due_date) return dateKey(quest.due_date, timeZone);
  if (quest?.created_at) return dateKey(quest.created_at, timeZone);
  return dateKey(Date.now(), timeZone);
}

function daysBetween(left, right) {
  const first = new Date(`${left}T12:00:00Z`).getTime();
  const second = new Date(`${right}T12:00:00Z`).getTime();
  return Math.round((second - first) / DAY_MS);
}

export function questPeriodKey(quest, value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const zone = normalizeTimeZone(quest?.timezone || timeZone);
  const recurrence = quest?.recurrence_type || "once";
  if (recurrence === "daily" || recurrence === "interval") return `day:${dateKey(value, zone)}`;
  if (recurrence === "weekly") {
    const days = Array.isArray(quest?.recurrence_config?.days) ? quest.recurrence_config.days : [];
    return days.length > 1 ? `day:${dateKey(value, zone)}` : `week:${weekKey(value, zone)}`;
  }
  if (recurrence === "monthly") return `month:${monthKey(value, zone)}`;
  return `once:${quest?.id || "unknown"}`;
}

export function questIsDueOn(quest, value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  if (!quest || ["ARCHIVED", "CANCELLED"].includes(quest.status) || quest.deleted_at) return false;
  const zone = normalizeTimeZone(quest.timezone || timeZone);
  const target = dateKey(value, zone);
  const start = recurrenceStart(quest, zone);
  const end = /^\d{4}-\d{2}-\d{2}$/.test(quest.recurrence_end_date || "") ? quest.recurrence_end_date : null;
  if (target < start || (end && target > end)) return false;
  const recurrence = quest.recurrence_type || "once";
  if (!quest.scheduled_date && !quest.due_date) return false;
  if (recurrence === "daily") return true;
  if (recurrence === "weekly") {
    const configured = Array.isArray(quest.recurrence_config?.days) ? quest.recurrence_config.days.map(Number).filter((day) => day >= 1 && day <= 7) : [];
    const days = configured.length ? configured : [weekdayNumber(`${start}T12:00:00Z`, "UTC")];
    return days.includes(weekdayNumber(value, zone));
  }
  if (recurrence === "monthly") {
    const day = Math.min(31, Math.max(1, Number(quest.recurrence_config?.day || start.slice(-2))));
    return Number(target.slice(-2)) === day;
  }
  if (recurrence === "interval") {
    const interval = Math.min(365, Math.max(1, Number(quest.recurrence_config?.interval || 1)));
    const unit = ["days", "weeks", "months"].includes(quest.recurrence_config?.unit) ? quest.recurrence_config.unit : "days";
    if (unit === "months") {
      const [startYear, startMonth, startDay] = start.split("-").map(Number);
      const [targetYear, targetMonth, targetDay] = target.split("-").map(Number);
      const monthDelta = ((targetYear - startYear) * 12) + targetMonth - startMonth;
      return monthDelta >= 0 && monthDelta % interval === 0 && targetDay === startDay;
    }
    const delta = daysBetween(start, target);
    const step = unit === "weeks" ? interval * 7 : interval;
    return delta >= 0 && delta % step === 0;
  }
  return target === start;
}

export function questCompletedForPeriod(state, quest, value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const periodKey = questPeriodKey(quest, value, quest?.timezone || timeZone);
  return state.quest_completions.some((completion) => completion.quest_id === quest.id && completion.period_key === periodKey);
}

export function questOccurrence(quest, date, timeZone = CONTROL_TIME_ZONE) {
  const zone = normalizeTimeZone(quest?.timezone || timeZone);
  const key = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? String(date) : dateKey(date, zone);
  if (!questIsDueOn(quest, `${key}T12:00:00Z`, zone)) return null;
  const dueAt = quest.scheduled_time ? zonedDateTimeToUtc(key, quest.scheduled_time, zone) : null;
  return { date: key, due_at: dueAt, period_key: questPeriodKey(quest, `${key}T12:00:00Z`, zone), timezone: zone };
}

export function questIsOverdue(state, quest, now = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  if (!quest || ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(quest.status)) return false;
  const zone = normalizeTimeZone(quest.timezone || timeZone);
  const today = dateKey(now, zone);
  if ((quest.recurrence_type || "once") === "once") {
    const scheduled = recurrenceStart(quest, zone);
    if (scheduled < today) return !questCompletedForPeriod(state, quest, `${scheduled}T12:00:00Z`, zone);
  }
  if (!questIsDueOn(quest, now, zone) || questCompletedForPeriod(state, quest, now, zone)) return false;
  if (!quest.scheduled_time) return false;
  const dueAt = zonedDateTimeToUtc(today, quest.scheduled_time, zone);
  return Boolean(dueAt && new Date(dueAt).getTime() < new Date(now).getTime());
}

export function getTodaySummary(state, now = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const zone = normalizeTimeZone(state?.preferences?.timezone || timeZone);
  const today = dateKey(now, zone);
  const relevant = [];
  for (const quest of state?.quests || []) {
    if (questIsDueOn(quest, now, zone) || questIsOverdue(state, quest, now, zone)) relevant.push(quest);
  }
  const missions = [...new Map(relevant.map((quest) => [quest.id, quest])).values()];
  const completed = missions.filter((quest) => {
    const occurrenceDate = questIsDueOn(quest, now, zone) ? today : recurrenceStart(quest, zone);
    return questCompletedForPeriod(state, quest, `${occurrenceDate}T12:00:00Z`, zone) || (quest.recurrence_type === "once" && quest.status === "COMPLETED");
  });
  const overdue = missions.filter((quest) => questIsOverdue(state, quest, now, zone) && !completed.includes(quest));
  return {
    date: today,
    timezone: zone,
    total: missions.length,
    completed: completed.length,
    pending: Math.max(0, missions.length - completed.length),
    overdue: overdue.length,
    missions,
    completed_missions: completed,
    overdue_missions: overdue,
  };
}

function planningMissions(state, { includeCompleted = false } = {}) {
  return (state?.quests || []).filter((quest) => {
    if (!quest || quest.deleted_at || ["ARCHIVED", "CANCELLED"].includes(quest.status)) return false;
    if (!includeCompleted && quest.status === "COMPLETED") return false;
    return true;
  });
}

export function getUnscheduledMissions(state, options = {}) {
  const { projectId, rootsOnly = false } = options;
  return planningMissions(state, options).filter((quest) => {
    if (projectId !== undefined && (quest.project_id || null) !== (projectId || null)) return false;
    if (rootsOnly && quest.parent_id) return false;
    return !quest.scheduled_date && !quest.due_date;
  });
}

export function getProjectUnscheduledMissions(state, projectId, options = {}) {
  return getUnscheduledMissions(state, { ...options, projectId });
}

export function getScheduledMissions(state, options = {}) {
  const { projectId, rootsOnly = false } = options;
  return planningMissions(state, options).filter((quest) => {
    if (projectId !== undefined && (quest.project_id || null) !== (projectId || null)) return false;
    if (rootsOnly && quest.parent_id) return false;
    return Boolean(quest.scheduled_date || quest.due_date);
  });
}

export function getMissionBuckets(state, now = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const zone = normalizeTimeZone(state?.preferences?.timezone || timeZone);
  const todaySummary = getTodaySummary(state, now, zone);
  const todayIds = new Set(todaySummary.missions.map((quest) => quest.id));
  const overdueIds = new Set(todaySummary.overdue_missions.map((quest) => quest.id));
  const scheduled = getScheduledMissions(state);
  return {
    today: todaySummary.missions,
    upcoming: scheduled.filter((quest) => !todayIds.has(quest.id) && !overdueIds.has(quest.id)),
    unscheduled: getUnscheduledMissions(state),
    scheduled,
    overdue: todaySummary.overdue_missions,
  };
}

export function reminderScheduleAt(occurrence, offsetMinutes) {
  if (!occurrence?.due_at) return null;
  const timestamp = new Date(occurrence.due_at).getTime() - (Math.max(0, Number(offsetMinutes || 0)) * 60 * 1000);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function buildReminderCandidates(state, now = Date.now(), { horizonDays = null, lookbackHours = 48 } = {}) {
  const zone = normalizeTimeZone(state?.preferences?.timezone || CONTROL_TIME_ZONE);
  const nowMs = new Date(now).getTime();
  const startDate = addDaysToDateKey(dateKey(now, zone), -1);
  const maximumOffsetMinutes = (state?.quests || []).flatMap((quest) => quest.reminders || []).reduce((maximum, reminder) => Math.max(maximum, Number(reminder.offset_minutes || 0)), 0);
  const scanDays = horizonDays === null ? Math.min(32, Math.max(2, Math.ceil(maximumOffsetMinutes / (24 * 60)) + 2)) : Math.min(32, Math.max(1, Number(horizonDays) || 1));
  const candidates = [];
  for (const quest of state?.quests || []) {
    if (!quest.scheduled_time || !Array.isArray(quest.reminders) || !quest.reminders.length || ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(quest.status)) continue;
    for (let dayOffset = 0; dayOffset <= scanDays; dayOffset += 1) {
      const occurrenceDate = addDaysToDateKey(startDate, dayOffset);
      const occurrence = questOccurrence(quest, occurrenceDate, zone);
      if (!occurrence || questCompletedForPeriod(state, quest, `${occurrenceDate}T12:00:00Z`, zone)) continue;
      for (const reminder of quest.reminders.filter((item) => item.enabled !== false)) {
        const scheduledAt = reminderScheduleAt(occurrence, reminder.offset_minutes);
        if (!scheduledAt) continue;
        const scheduleKey = `${quest.id}:${occurrence.period_key}:${reminder.id}:${scheduledAt}`;
        const existing = (state.reminder_deliveries || []).find((delivery) => delivery.schedule_key === scheduleKey);
        const effectiveAt = existing?.status === "SNOOZED" && existing.snoozed_until ? existing.snoozed_until : scheduledAt;
        const effectiveMs = new Date(effectiveAt).getTime();
        if (effectiveMs > nowMs || effectiveMs < nowMs - (lookbackHours * 60 * 60 * 1000)) continue;
        if (existing && !["SNOOZED", "PENDING"].includes(existing.status)) continue;
        candidates.push({
          id: existing?.id || `delivery_${scheduleKey}`,
          quest_id: quest.id,
          reminder_id: reminder.id,
          occurrence_key: occurrence.period_key,
          schedule_key: scheduleKey,
          scheduled_at: scheduledAt,
          effective_at: effectiveAt,
          due_at: occurrence.due_at,
          title: quest.title,
        });
      }
    }
  }
  return candidates.sort((left, right) => new Date(left.effective_at) - new Date(right.effective_at));
}

export function getActionableReminders(state, now = Date.now()) {
  const cutoff = new Date(now).getTime() - (3 * DAY_MS);
  return (state?.reminder_deliveries || []).filter((delivery) => {
    if (!["DELIVERED", "SNOOZED"].includes(delivery.status)) return false;
    const quest = (state.quests || []).find((item) => item.id === delivery.quest_id);
    if (!quest || ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(quest.status)) return false;
    if (questCompletedForPeriod(state, quest, delivery.due_at || now, quest.timezone)) return false;
    return new Date(delivery.delivered_at || delivery.snoozed_until || delivery.scheduled_at).getTime() >= cutoff;
  }).sort((left, right) => new Date(left.snoozed_until || left.delivered_at || left.scheduled_at) - new Date(right.snoozed_until || right.delivered_at || right.scheduled_at));
}
