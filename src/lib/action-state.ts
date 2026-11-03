export type FieldErrors = Record<string, string | undefined>;

export interface ActionState<T = unknown> {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  data?: T;
  /** Monotonic token so that identical consecutive results still trigger effects (toasts). */
  at?: number;
}

export const initialActionState: ActionState = { ok: false };

export function success<T>(message?: string, data?: T): ActionState<T> {
  return { ok: true, message, data, at: Date.now() };
}

export function failure(message: string, fieldErrors?: FieldErrors): ActionState<never> {
  return { ok: false, message, fieldErrors, at: Date.now() };
}
