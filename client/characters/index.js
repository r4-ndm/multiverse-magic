import { characterRegistry } from "./registry.js";
import { WizardCharacter } from "./wizard.js";
import { AstronautCharacter } from "./astronaut.js";
import { AndroidCharacter } from "./android.js";
import { CelestialCharacter } from "./celestial.js";
import { VesselCharacter } from "./vessel.js";

// Register all core characters into the unified registry
import { NinjaCharacter } from "./ninja.js";
characterRegistry.register(WizardCharacter);
characterRegistry.register(AstronautCharacter);
characterRegistry.register(AndroidCharacter);
characterRegistry.register(CelestialCharacter);
characterRegistry.register(VesselCharacter);

characterRegistry.register(NinjaCharacter);
export { characterRegistry };
export { WizardCharacter, AstronautCharacter, AndroidCharacter, CelestialCharacter, VesselCharacter, NinjaCharacter };
