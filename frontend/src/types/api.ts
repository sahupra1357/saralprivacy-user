export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ApiError {
  detail: string | ValidationError[];
}

export function isValidationErrors(d: string | ValidationError[]): d is ValidationError[] {
  return Array.isArray(d);
}
