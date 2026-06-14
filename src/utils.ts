import type { Goal, Plan, PlanDay, PlanSlot } from "./types";

const USER_ID_KEY = "fitengine.userId";
const PLAN_ID_KEY = "fitengine.planId";

export function saveSession(userId: number, planId: number) {
  localStorage.setItem(USER_ID_KEY, String(userId));
  localStorage.setItem(PLAN_ID_KEY, String(planId));
}

export function getSession() {
  const userId = Number(localStorage.getItem(USER_ID_KEY));
  const planId = Number(localStorage.getItem(PLAN_ID_KEY));
  return {
    userId: Number.isFinite(userId) && userId > 0 ? userId : null,
    planId: Number.isFinite(planId) && planId > 0 ? planId : null,
  };
}

export function updatePlanId(planId: number) {
  localStorage.setItem(PLAN_ID_KEY, String(planId));
}

export function clearSession() {
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(PLAN_ID_KEY);
}

export function goalLabel(goal: Goal | string) {
  const labels: Record<string, string> = {
    fat_loss: "Lose fat",
    hypertrophy: "Build muscle",
    strength: "Get stronger",
    endurance: "Build endurance",
    mobility: "Move better",
  };
  return labels[goal] ?? goal;
}

export function focusLabel(focus: string) {
  return focus.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function todayDay(plan: Plan | null): PlanDay | null {
  if (!plan?.days.length) return null;
  return plan.days.find((day) => day.slots.some((slot) => slot.status !== "completed")) ?? plan.days[plan.days.length - 1];
}

export function firstImage(slot: PlanSlot | null) {
  return slot?.exercise?.image_urls?.[0] ?? null;
}

export function minutesForDay(day: PlanDay | null) {
  if (!day) return 0;
  return Math.round(
    8 +
      day.slots.reduce((total, slot) => {
        const perSet = slot.exercise?.mechanic === "compound" ? 4 : 3;
        return total + slot.sets * perSet;
      }, 0),
  );
}

export function safetyText(plan: Plan | null) {
  const notes = plan?.params.feasibility_notes ?? [];
  if (notes.length > 0) return notes[0];
  return "FitEngine filtered this plan with your equipment, level, and safety rules.";
}

export function weekBalance(plan: Plan) {
  const totals = {
    Upper: 0,
    Lower: 0,
    Core: 0,
    Cardio: 0,
  };
  const upperGroups = new Set(["chest", "back", "lower_back", "shoulders", "biceps", "triceps"]);
  const lowerGroups = new Set(["quads", "posterior_chain", "calves"]);

  for (const day of plan.days) {
    for (const slot of day.slots) {
      const groups = slot.exercise?.muscle_groups ?? [];
      if (groups.some((group) => upperGroups.has(group))) totals.Upper += slot.sets;
      if (groups.some((group) => lowerGroups.has(group))) totals.Lower += slot.sets;
      if (groups.includes("abs")) totals.Core += slot.sets;
    }
  }

  const conditioning = plan.params.conditioning_blocks ?? [];
  totals.Cardio = conditioning.reduce((total, item) => total + (Number(item.minutes) || 0), 0);

  const max = Math.max(...Object.values(totals), 1);
  return Object.entries(totals).map(([label, value]) => ({
    label,
    value,
    percent: Math.round((value / max) * 100),
  }));
}
