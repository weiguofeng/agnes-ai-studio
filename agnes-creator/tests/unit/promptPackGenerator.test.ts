import { describe, expect, it } from "vitest";
import { generatePromptPack } from "@/lib/promptPackGenerator";
import type { Character, Scene, Shot } from "@/types";

describe("promptPackGenerator", () => {
  it("handles legacy shots without characterIds", () => {
    const shot = {
      id: "shot-legacy",
      sceneId: "scene-1",
      title: "Legacy shot",
      description: "A hero enters a neon city",
      order: 1,
      type: "image",
      prompt: "hero in neon city",
      renderedPrompt: "",
      negativePrompt: "",
      assetIds: [],
      duration: 5,
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Shot;
    const scene = {
      id: "scene-1",
      projectId: "project-1",
      title: "Neon city",
      description: "A neon city scene",
      order: 1,
      shots: [shot],
      assetIds: [],
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Scene;
    const characters = [{
      id: "char-1",
      name: "Hero",
      description: "",
      prompt: "same face, red coat",
      tags: [],
      referenceImages: [],
      references: [],
      profile: { age: "", gender: "", appearance: "", hair: "", clothing: "", personality: "", background: "" },
      dnaBlock: "consistent hero DNA",
      isFavorite: false,
      isLocked: false,
      createdAt: 1,
      updatedAt: 1,
    }] as Character[];

    const pack = generatePromptPack(shot, scene, characters, "cinematic");

    expect(pack.imagePrompt).toContain("A hero enters a neon city");
    expect(pack.characterDna).toContain("consistent hero DNA");
    expect(pack.styleDna).toBe("cinematic");
  });
});
