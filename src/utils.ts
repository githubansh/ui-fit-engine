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
  return plan?.days[0] ?? null;
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
