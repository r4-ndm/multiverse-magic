/**
 * Overlay manages user interface modals, HUD updates, event log entries,
 * damage indicators, and ejection announcements.
 */
export class Overlay {
  constructor() {
    this.entryOverlay = document.getElementById("entry-overlay");
    this.enterBtn = document.getElementById("enter-btn");
    this.hud = document.getElementById("hud");
    this.crosshair = document.getElementById("crosshair");
    this.eventLog = document.getElementById("event-log");
    this.ejectionBanner = document.getElementById("ejection-banner");
    this.ejectionDistance = document.getElementById("ejection-distance");
    this.coordsEl = document.getElementById("hud-coords");
    this.playerIdEl = document.getElementById("hud-player-id");
    this.statusDot = document.getElementById("status-dot");
    this.healthBarFill = document.getElementById("health-bar-fill");
    this.healthValue = document.getElementById("health-value");
    this.damageVignette = document.getElementById("damage-vignette");
    this.chatInput = document.getElementById("chat-input");

    this.onEnterCallback = null;
    this.onChatSend = null;
    this.isEntered = false;
  }

  init(onEnter, onChatSend) {
    this.onEnterCallback = onEnter;
    this.onChatSend = onChatSend;

    this.enterBtn.addEventListener("click", async () => {
      if (this.isEntered) return;
      this.isEntered = true;

      // Trigger user activation callback (mic request, audio context, colyseus connect)
      if (this.onEnterCallback) {
        await this.onEnterCallback();
      }

      // Hide entry screen and show HUD
      this.entryOverlay.style.display = "none";
      this.hud.style.display = "block";
    });

    // Chat enter key toggle
    if (this.chatInput) {
      window.addEventListener("keydown", (e) => {
        if (e.code === "Enter") {
          if (document.activeElement === this.chatInput) {
            const text = this.chatInput.value.trim();
            if (text && this.onChatSend) {
              this.onChatSend(text);
            }
            this.chatInput.value = "";
            this.chatInput.blur();
            // Resume pointer lock
            document.getElementById("webgl-canvas")?.requestPointerLock();
          } else if (this.isEntered) {
            if (document.pointerLockElement) {
              document.exitPointerLock();
            }
            this.chatInput.focus();
            e.preventDefault();
          }
        }
      });
    }
  }

  setPlayerInfo(id, roomName = "SPACE") {
    if (this.playerIdEl) this.playerIdEl.innerText = id.slice(0, 8);
    const roomEl = document.getElementById("hud-room-id");
    if (roomEl) roomEl.innerText = roomName.toUpperCase();
  }

  updateHUD(position, health) {
    if (this.coordsEl && position) {
      this.coordsEl.innerText = `X: ${position.x.toFixed(1)} | Y: ${position.y.toFixed(1)} | Z: ${position.z.toFixed(1)}`;
    }

    if (this.healthBarFill && this.healthValue && typeof health === "number") {
      this.healthBarFill.style.width = `${Math.max(0, health)}%`;
      this.healthValue.innerText = `${Math.max(0, health)}%`;

      if (health < 30) {
        this.healthBarFill.classList.add("danger");
        this.damageVignette?.classList.add("critical");
      } else {
        this.healthBarFill.classList.remove("danger");
        this.damageVignette?.classList.remove("critical");
      }
    }
  }

  showEjection(isLocalPlayer, targetId, coords) {
    if (isLocalPlayer) {
      // Local player was ejected
      this.ejectionBanner.style.display = "block";
      this.statusDot?.classList.add("ejected");

      const dist = Math.sqrt(coords.x * coords.x + coords.y * coords.y + coords.z * coords.z);
      if (this.ejectionDistance) {
        this.ejectionDistance.innerText = `Distance to origin: ${Math.round(dist)} units`;
      }

      this.addLogItem(`CRITICAL: You were ejected into deep space by community fire!`, true);

      // Dismiss after 8 seconds (or user flies back)
      setTimeout(() => {
        this.ejectionBanner.style.display = "none";
        this.statusDot?.classList.remove("ejected");
      }, 8000);
    } else {
      // Remote player ejected
      this.addLogItem(`🚨 Pilot [${targetId.slice(0, 6)}] was ejected into deep space!`, true);
    }
  }

  addLogItem(text, isAlert = false) {
    if (!this.eventLog) return;
    const item = document.createElement("div");
    item.className = `log-item ${isAlert ? "alert" : ""}`;
    item.innerText = text;
    this.eventLog.prepend(item);

    // Keep max 6 log items
    while (this.eventLog.children.length > 6) {
      this.eventLog.removeChild(this.eventLog.lastChild);
    }

    // Auto fade log after 6s
    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transition = "opacity 0.6s ease";
      setTimeout(() => item.remove(), 600);
    }, 6000);
  }
}
