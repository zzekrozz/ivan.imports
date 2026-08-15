function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stageLessons(program, stage) {
  if (Array.isArray(stage?.lessons) && stage.lessons.every((lesson) => lesson && typeof lesson === "object")) return stage.lessons;
  const lessonById = new Map((program?.lessons || []).map((lesson) => [String(lesson.id), lesson]));
  return (stage?.lessonIds || []).map((id) => lessonById.get(String(id))).filter(Boolean);
}

export function academyCoreStages(program) {
  const stages = Array.isArray(program?.stages) ? program.stages : [];
  return stages.filter((stage, index) => stage.countsTowardProgress !== false
    && stage.kind !== "prologue"
    && !(finite(stage.order, index) === 0 && stages.length === 13));
}

export function academyProgressLessons(program) {
  const lessons = Array.isArray(program?.lessons) ? program.lessons : [];
  if (finite(program?.schemaVersion, 1) >= 2) return lessons.filter((lesson) => lesson.countsTowardProgress !== false);
  const stageIds = new Set(academyCoreStages(program).map((stage) => String(stage.id)));
  return lessons.filter((lesson) => lesson.countsTowardProgress !== false && stageIds.has(String(lesson.stageId)));
}

export function academyDashboardModel(program, state = {}) {
  const coreStages = academyCoreStages(program);
  const programLessons = Array.isArray(program?.lessons) ? program.lessons : [];
  const progressLessons = academyProgressLessons(program);
  const lessonById = new Map(programLessons.flatMap((lesson) => [[String(lesson.id), lesson], [String(lesson.slug), lesson]]));
  const completedIds = new Set((state?.progress?.completedLessonIds || []).map(String));
  const startedIds = new Set((state?.progress?.startedLessonIds || []).map(String));
  const validCompletedIds = new Set(progressLessons.filter((lesson) => completedIds.has(String(lesson.id))).map((lesson) => String(lesson.id)));
  const savedId = String(state?.progress?.currentLessonId || state?.activeLessonId || "");
  const savedLesson = lessonById.get(savedId) || null;
  const savedIncompleteLesson = savedLesson && !validCompletedIds.has(String(savedLesson.id)) ? savedLesson : null;
  const currentLesson = savedIncompleteLesson
    || progressLessons.find((lesson) => !validCompletedIds.has(String(lesson.id)))
    || progressLessons.at(-1)
    || null;
  const completedCount = validCompletedIds.size;
  const totalLessons = progressLessons.length;
  const percentage = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
  const isNew = completedCount === 0 && startedIds.size === 0 && !savedLesson;
  const isComplete = totalLessons > 0 && completedCount === totalLessons;

  const stageModels = coreStages.map((stage, index) => {
    const lessons = stageLessons(program, stage);
    const stageCompletedCount = lessons.filter((lesson) => validCompletedIds.has(String(lesson.id))).length;
    return {
      ...stage,
      lessons,
      number: String(finite(stage.order, index + 1)).padStart(2, "0"),
      completedCount: stageCompletedCount,
      lessonCount: lessons.length,
      percentage: lessons.length ? Math.round((stageCompletedCount / lessons.length) * 100) : 0,
      complete: lessons.length > 0 && stageCompletedCount === lessons.length,
    };
  });

  const currentCoreStageId = currentLesson && stageModels.some((stage) => String(stage.id) === String(currentLesson.stageId))
    ? String(currentLesson.stageId)
    : "";
  const recommendedStage = stageModels.find((stage) => String(stage.id) === currentCoreStageId && !stage.complete)
    || stageModels.find((stage) => !stage.complete)
    || stageModels.at(-1)
    || null;

  const stages = stageModels.map((stage) => ({
    ...stage,
    status: stage.complete
      ? "complete"
      : String(stage.id) === currentCoreStageId
        ? "current"
        : String(stage.id) === String(recommendedStage?.id)
          ? "recommended"
          : "pending",
  }));

  return {
    percentage,
    completedCount,
    totalLessons,
    isNew,
    isComplete,
    currentLesson,
    currentCoreStageId,
    recommendedStage: stages.find((stage) => String(stage.id) === String(recommendedStage?.id)) || null,
    stages,
  };
}

export function selectDashboardTools(program, stageId = "", limit = 6) {
  const tools = Array.isArray(program?.tools) ? program.tools : [];
  const prioritized = [
    ...tools.filter((tool) => String(tool.stageId) === String(stageId)),
    ...tools,
  ];
  return [...new Map(prioritized.filter(Boolean).map((tool) => [String(tool.id || tool.slug), tool])).values()]
    .slice(0, Math.max(0, finite(limit, 6)));
}
