import { Schema, defineTypes, MapSchema } from "@colyseus/schema";

/**
 * Player Schema representing state synced across all clients.
 * id: Session ID of the player
 * x, y, z: 3D position coordinates in space
 * rotation: Yaw angle (heading) in radians
 * pitch: Pitch angle (elevation) in radians
 * health: Health points (default 100)
 */
export class Player extends Schema {}
defineTypes(Player, {
  id: "string",
  name: "string",
  characterType: "string",
  color: "string",
  avatarUrl: "string",
  x: "number",
  y: "number",
  z: "number",
  rotation: "number",
  pitch: "number",
  health: "number",
  driving: "boolean",
});

/**
 * SpaceState Schema holding the map of active players in the room.
 */
export class SpaceState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(SpaceState, {
  players: { map: Player },
});
