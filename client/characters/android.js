/**
 * Pixel-card android, same style as the wizard.
 */
import artUrl from "../assets/models/android-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const AndroidCharacter = {
  id: "android",
  aliases: ["mecha"],
  name: "Android",
  emoji: "🤖",
  description: "Cyber Mecha",
  defaultColor: "#9d00ff",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
