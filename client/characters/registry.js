import * as THREE from "three";

/**
 * CharacterRegistry manages modular avatar definitions in Multiverse Magic.
 * 
 * Agents and developers can register new 3D avatars with 1 file:
 * characterRegistry.register({
 *   id: "ninja",
 *   name: "Cyber Ninja",
 *   emoji: "🥷",
 *   description: "Stealth Assassin",
 *   defaultColor: "#00ff66",
 *   createMesh: (THREE, accentColor) => { ... return group; }
 * });
 */
export class CharacterRegistry {
  constructor() {
    this.characters = new Map();
    this.aliases = new Map();
  }

  register(definition) {
    if (!definition || !definition.id) {
      console.warn("[CharacterRegistry] Cannot register character without an 'id'");
      return;
    }
    this.characters.set(definition.id, definition);
    if (Array.isArray(definition.aliases)) {
      definition.aliases.forEach((alias) => this.aliases.set(alias, definition.id));
    }
    console.log(`[CharacterRegistry] Registered avatar: [${definition.id}] (${definition.name || definition.id})`);
  }

  registerAlias(alias, targetId) {
    this.aliases.set(alias, targetId);
  }

  get(id) {
    if (this.characters.has(id)) return this.characters.get(id);
    const resolved = this.aliases.get(id);
    if (resolved && this.characters.has(resolved)) return this.characters.get(resolved);
    return undefined;
  }

  has(id) {
    return this.characters.has(id) || this.aliases.has(id);
  }

  getAll() {
    return Array.from(this.characters.values());
  }

  createMesh(type = "wizard", accentColor = 0x9d00ff) {
    const char = this.characters.get(type) || this.characters.get("wizard") || this.getAll()[0];
    if (char && typeof char.createMesh === "function") {
      return char.createMesh(THREE, accentColor);
    }
    console.warn(`[CharacterRegistry] Character definition for '${type}' not found or missing createMesh. Falling back.`);
    return new THREE.Group();
  }
}

export const characterRegistry = new CharacterRegistry();
