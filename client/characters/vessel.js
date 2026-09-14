/**
 * Pixel-card interceptor, same style as the wizard.
 */
import artUrl from "../assets/models/vessel-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const VesselCharacter = {
  id: "vessel",
  aliases: ["ship"],
  name: "Interceptor",
  emoji: "🚀",
  description: "Starfighter Ship",
  defaultColor: "#00f0ff",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
