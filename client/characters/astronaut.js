/**
 * Pixel-card astronaut, same style as the wizard.
 */
import artUrl from "../assets/models/astronaut-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const AstronautCharacter = {
  id: "astronaut",
  name: "Astronaut",
  emoji: "🧑‍🚀",
  description: "Humanoid Explorer",
  defaultColor: "#00f0ff",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
