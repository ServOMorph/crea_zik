import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest, ApiError } from "./client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed JSON body on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ id: string }>("/api/projects");

    expect(result).toEqual({ id: "abc" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) }),
    );
  });

  it("merges caller headers with the default content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/projects", { headers: { "X-Test": "1" } });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ headers: { "Content-Type": "application/json", "X-Test": "1" } }),
    );
  });

  it("throws an ApiError with the string detail message on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: "invalid payload" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/projects")).rejects.toMatchObject({
      message: "invalid payload",
      status: 422,
    });
  });

  it("throws an ApiError with the nested detail message on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ detail: { message: "revision conflict" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/projects")).rejects.toMatchObject({
      message: "revision conflict",
      status: 409,
    });
  });

  it("falls back to a generic message when the error body cannot be parsed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/projects")).rejects.toMatchObject({
      message: "Erreur réseau",
      status: 500,
    });
  });

  it("exposes ApiError as a proper Error subclass", () => {
    const error = new ApiError("boom", 400);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
  });
});
