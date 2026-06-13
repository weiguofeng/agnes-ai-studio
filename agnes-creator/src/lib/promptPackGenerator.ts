import type { Shot, Scene, Character, PromptPack } from "@/types";

/**
 * Generate a PromptPack for a given shot, injecting Character DNA and style.
 */
export function generatePromptPack(
  shot: Shot,
  scene: Scene,
  characters: Character[],
  styleDna: string,
): PromptPack {
  // Gather Character DNA blocks for characters in this shot
  const shotCharacters = characters.filter((c) => shot.characterIds.includes(c.id));
  const characterDna = shotCharacters.map((c) => c.dnaBlock || c.prompt).filter(Boolean).join("; ");

  // Build image prompt
  const imageParts: string[] = [shot.description || shot.prompt];
  if (characterDna) imageParts.push(characterDna);
  if (styleDna) imageParts.push(styleDna);
  const imagePrompt = imageParts.join(", ");

  // Build video prompt (slightly different for motion)
  const videoParts: string[] = [shot.description || shot.prompt];
  if (characterDna) videoParts.push(characterDna);
  if (styleDna) videoParts.push(styleDna);
  videoParts.push("cinematic, motion");
  const videoPrompt = videoParts.join(", ");

  // Negative prompt
  const negativeParts: string[] = [
    "blurry, low quality, distorted, deformed",
    "ugly, bad anatomy, bad proportions",
    "extra limbs, cloned face, disfigured",
    "grainy, noisy, dark, overexposed",
  ];
  if (shot.negativePrompt) negativeParts.push(shot.negativePrompt);
  const negativePrompt = negativeParts.join(", ");

  return { shotId: shot.id, imagePrompt, videoPrompt, negativePrompt, characterDna, styleDna };
}

/**
 * Generate prompt packs for all shots in a project.
 */
export function generateAllPromptPacks(
  scenes: Scene[],
  characters: Character[],
  styleDna: string,
): PromptPack[] {
  const packs: PromptPack[] = [];
  for (const scene of scenes) {
    for (const shot of scene.shots) {
      packs.push(generatePromptPack(shot, scene, characters, styleDna));
    }
  }
  return packs;
}

/**
 * Extract scene and shot structure from a story text using simple NLP.
 * This generates a structured storyboard from raw text.
 */
export function parseStoryToScenes(story: string, locale: "zh-CN" | "en-US" = "en-US"): Array<{
  title: string;
  description: string;
  cameraAngle?: string;
  shots: Array<{ title: string; description: string; order: number }>;
}> {
  const sentences = story
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  // Group sentences into scenes (every 1-3 sentences)
  const scenes: Array<{
    title: string;
    description: string;
    cameraAngle?: string;
    shots: Array<{ title: string; description: string; order: number }>;
  }> = [];

  const cameraAngles = ["wide shot", "medium shot", "close up", "extreme close up", "over the shoulder", "low angle", "high angle", "aerial view"];

  let sceneIdx = 0;
  for (let i = 0; i < sentences.length; i += Math.max(1, Math.floor(Math.random() * 3) + 1)) {
    sceneIdx++;
    const group = sentences.slice(i, i + 3);
    if (group.length === 0) continue;

    const sceneTitle = (locale === "zh-CN" ? "场景 " : "Scene ") + sceneIdx + ": " + group[0].substring(0, 40);
    const sceneDesc = group.join(". ");

    // Create 1-3 shots per scene
    const shots: Array<{ title: string; description: string; order: number }> = [];
    for (let j = 0; j < Math.min(group.length, 3); j++) {
      const angle = cameraAngles[Math.floor(Math.random() * cameraAngles.length)];
      shots.push({
        title: (locale === "zh-CN" ? "镜头 " : "Shot ") + (j + 1) + ": " + group[j].substring(0, 30) + "...",
        description: group[j],
        order: j + 1,
      });
    }

    scenes.push({
      title: sceneTitle,
      description: sceneDesc,
      cameraAngle: cameraAngles[Math.floor(Math.random() * cameraAngles.length)],
      shots,
    });
  }

  // Ensure 5-20 scenes
  while (scenes.length < 5 && sentences.length > 0) {
    const idx = scenes.length % sentences.length;
    const sentence = sentences[idx];
    scenes.push({
      title: (locale === "zh-CN" ? "场景 " : "Scene ") + (scenes.length + 1) + ": " + sentence.substring(0, 40) + "..." ,
      description: sentence,
      cameraAngle: cameraAngles[Math.floor(Math.random() * cameraAngles.length)],
      shots: [{
        title: (locale === "zh-CN" ? "镜头 1: " : "Shot 1: ") + sentence.substring(0, 30) + "...",
        description: sentence,
        order: 1,
      }],
    });
  }

  return scenes.slice(0, 20);
}
