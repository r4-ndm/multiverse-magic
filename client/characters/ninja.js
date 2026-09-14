/**
 * Pixel-card cyber ninja, same style as the wizard.
 */
import artUrl from "../assets/models/ninja-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const NinjaCharacter = {
  id: "ninja",
  name: "Cyber Ninja",
  emoji: "🥷",
  description: "Stealth Assassin",
  defaultColor: "#00ff66",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
