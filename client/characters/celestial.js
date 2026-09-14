/**
 * Pixel-card celestial, same style as the wizard.
 */
import artUrl from "../assets/models/celestial-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const CelestialCharacter = {
  id: "celestial",
  aliases: ["cosmic"],
  name: "Celestial",
  emoji: "✨",
  description: "Cosmic Being",
  defaultColor: "#ffd700",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
