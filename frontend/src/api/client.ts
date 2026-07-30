export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string | { message?: string } } | null;
    const message =
      typeof payload?.detail === "string" ? payload.detail : (payload?.detail?.message ?? "Erreur réseau");
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}
