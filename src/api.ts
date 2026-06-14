import type { Alternative, CoachResponse, Exercise, Goal, IntakePreview, Level, MetaOptions, Plan, ProgressSummary, User } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.detail ?? message;
    } catch {
      // Keep the generic status message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export type SetupPayload = {
  name?: string;
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  level: Level;
  goal: Goal;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string[];
  injuries: Array<{ injury_code: string; severity: "mild" | "moderate" | "severe" }>;
  exclusions?: Array<{ exercise_id: string; reason?: string }>;
};

export const api = {
  health: () => request<{ status: string; embeddings: string }>("/health"),
  meta: () => request<MetaOptions>("/meta/options"),
  createUser: (payload: SetupPayload) =>
    request<User>("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getUser: (userId: number) => request<User>(`/users/${userId}`),
  updateUser: (userId: number, payload: Partial<SetupPayload>) =>
    request<User>(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  progress: (userId: number) => request<ProgressSummary>(`/users/${userId}/progress`),
  previewIntake: (text: string) =>
    request<IntakePreview>("/intake/preview", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  applyIntake: (userId: number, text: string) =>
    request<IntakePreview>(`/users/${userId}/intake-text`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  generatePlan: (userId: number, weekIndex = 1) =>
    request<Plan>("/plans/generate", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, week_index: weekIndex }),
    }),
  getPlan: (planId: number) => request<Plan>(`/plans/${planId}`),
  listPlans: (userId: number) => request<Plan[]>(`/plans/user/${userId}`),
  regeneratePlan: (planId: number) =>
    request<Plan>(`/plans/${planId}/regenerate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  activatePlan: (planId: number) =>
    request<Plan>(`/plans/${planId}/activate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  searchExercises: (params: { q?: string; muscle?: string; equipment?: string[]; level?: string }) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.muscle) search.set("muscle", params.muscle);
    if (params.level) search.set("level", params.level);
    params.equipment?.forEach((item) => search.append("equipment", item));
    return request<Exercise[]>(`/exercises/search?${search.toString()}`);
  },
  getExercise: (exerciseId: string) => request<Exercise>(`/exercises/${exerciseId}`),
  adaptPlan: (planId: number) =>
    request<Plan>(`/plans/${planId}/adapt`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  alternatives: (slotId: number, k = 5) => request<Alternative[]>(`/slots/${slotId}/alternatives?k=${k}`),
  swap: (slotId: number, exerciseId: string) =>
    request(`/slots/${slotId}/swap`, {
      method: "POST",
      body: JSON.stringify({ exercise_id: exerciseId }),
    }),
  logSession: (payload: {
    plan_day_id: number;
    rpe: number;
    completed_slot_ids: number[];
    skipped_slot_ids: number[];
    duration_min?: number;
    notes?: string;
  }) =>
    request("/sessions/log", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  coach: (payload: { user_id: number; message: string; history?: Array<{ role: string; content: string }> }) =>
    request<CoachResponse>("/coach/chat", {
      method: "POST",
      body: JSON.stringify({ ...payload, history: payload.history ?? [] }),
    }),
};
