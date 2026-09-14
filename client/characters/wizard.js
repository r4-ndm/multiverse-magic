/**
 * The player's wizard drawing, shown as a card.
 */
import artUrl from "../assets/models/wizard-card.png?url";
import { createPixelCard } from "./pixelCard.js";

export const WizardCharacter = {
  id: "wizard",
  aliases: ["evil_wizard", "warlock", "mage"],
  name: "Evil Wizard",
  emoji: "🧙",
  description: "Your wizard drawing",
  defaultColor: "#6d28d9",

  createMesh(THREE) {
    return createPixelCard(THREE, artUrl);
  },
};
