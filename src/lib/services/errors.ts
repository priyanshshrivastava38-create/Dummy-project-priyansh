export class ServiceError extends Error {
  constructor(
    message: string,
    public code: "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "CONFLICT" = "INVALID",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
