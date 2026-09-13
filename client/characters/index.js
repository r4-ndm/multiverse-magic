import { characterRegistry } from "./registry.js";
import { WizardCharacter } from "./wizard.js";
import { AstronautCharacter } from "./astronaut.js";
import { AndroidCharacter } from "./android.js";
import { CelestialCharacter } from "./celestial.js";
import { VesselCharacter } from "./vessel.js";

import { NinjaCharacter } from "./ninja.js";
import { FrogCharacter } from "./frog.js";

characterRegistry.register(WizardCharacter);
characterRegistry.register(AstronautCharacter);
characterRegistry.register(AndroidCharacter);
characterRegistry.register(CelestialCharacter);
characterRegistry.register(VesselCharacter);
characterRegistry.register(NinjaCharacter);
characterRegistry.register(FrogCharacter);

export { characterRegistry };
export { WizardCharacter, AstronautCharacter, AndroidCharacter, CelestialCharacter, VesselCharacter, NinjaCharacter, FrogCharacter };

