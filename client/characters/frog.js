/**
 * Pixel-card cosmic frog, same style as the wizard.
 */
import artUrl from "../assets/models/frog-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const FrogCharacter = {
  id: "frog",
  aliases: ["cosmic_frog", "toad"],
  name: "Cosmic Frog",
  emoji: "🐸",
  description: "Void Hopper",
  defaultColor: "#00ff88",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
