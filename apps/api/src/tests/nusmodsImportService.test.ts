import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNusmodsModules, normalizeNusmodsModule } from "../services/nusmodsImportService.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeNusmodsModule", () => {
  it("maps NUSMods module info into the internal module schema", () => {
    const module = normalizeNusmodsModule("2025-2026", {
      moduleCode: "CS2100",
      title: "Computer Organisation",
      moduleCredit: "4",
      department: "Computer Science",
      faculty: "School of Computing",
      description: "Computer organisation and architecture.",
      prerequisite: "CS1101S",
      prereqTree: { or: ["CS1101S"] }
    });

    expect(module).toEqual({
      acadYear: "2025-2026",
      moduleCode: "CS2100",
      title: "Computer Organisation",
      units: 4,
      department: "Computer Science",
      faculty: "School of Computing",
      description: "Computer organisation and architecture.",
      prerequisite: "CS1101S",
      prereqTree: { or: ["CS1101S"] }
    });
  });

  it("defaults missing or invalid module credits to 4 units", () => {
    expect(
      normalizeNusmodsModule("2025-2026", {
        moduleCode: "CS9999",
        title: "Special Topics",
        moduleCredit: undefined
      }).units
    ).toBe(4);
  });

  it("merges prereqTree from per-module NUSMods detail payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            moduleCode: "CS2100",
            title: "Computer Organisation",
            moduleCredit: "4"
          }
        ]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          moduleCode: "CS2100",
          title: "Computer Organisation",
          moduleCredit: "4",
          prerequisite: "CS1231S",
          prereqTree: { or: ["CS1231S", "MA1521"] }
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    const modules = await fetchNusmodsModules("2025-2026");

    expect(fetchMock).toHaveBeenCalledWith("https://api.nusmods.com/v2/2025-2026/moduleInfo.json");
    expect(fetchMock).toHaveBeenCalledWith("https://api.nusmods.com/v2/2025-2026/modules/CS2100.json");
    expect(modules[0]?.prereqTree).toEqual({ or: ["CS1231S", "MA1521"] });
  });
});
