/**
 * Pixel-card galactic squirrel, same style as the wizard.
 */
import artUrl from "../assets/models/squirrel-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const SquirrelCharacter = {
  id: "squirrel",
  aliases: ["galactic_squirrel", "chipmunk"],
  name: "Galactic Squirrel",
  emoji: "🐿️",
  description: "Starlight Forager",
  defaultColor: "#ff9900",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
