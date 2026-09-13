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
    this.pilotNameInput = document.getElementById("pilot-name-input");

    this.onEnterCallback = null;
    this.onChatSend = null;
    this.onMorphCallback = null;
    this.isEntered = false;

    // Character customization state
    this.selectedCharacterType = "astronaut";
    this.selectedColor = "#00f0ff";
    this.selectedAvatarUrl = "";

    this.morphModal = document.getElementById("morph-modal");
    this.hudMorphBtn = document.getElementById("hud-morph-btn");
  }

  init(onEnter, onChatSend, onMorph) {
    this.onEnterCallback = onEnter;
    this.onChatSend = onChatSend;
    this.onMorphCallback = onMorph;

    // Load or generate default pilot callsign
    const savedName = localStorage.getItem("pilot_callsign") || `Pilot-${Math.floor(1000 + Math.random() * 9000)}`;
    if (this.pilotNameInput) {
      this.pilotNameInput.value = savedName;
    }

    // Initialize character selector listeners on entry screen
    this.setupCharacterSelectors();

    // Initialize in-game morph modal
    this.setupMorphModal();

    this.enterBtn.addEventListener("click", async () => {
      if (this.isEntered) return;
      this.isEntered = true;

      const chosenName = this.pilotNameInput?.value.trim() || savedName;
      localStorage.setItem("pilot_callsign", chosenName);

      const avatarUrlInput = document.getElementById("entry-avatar-url");
      if (avatarUrlInput && avatarUrlInput.value.trim()) {
        this.selectedAvatarUrl = avatarUrlInput.value.trim();
      }

      // Trigger user activation callback (mic request, audio context, colyseus connect)
      if (this.onEnterCallback) {
        await this.onEnterCallback(chosenName, this.selectedCharacterType, this.selectedColor, this.selectedAvatarUrl);
      }

      // Hide entry screen and show HUD
      this.entryOverlay.style.display = "none";
      this.hud.style.display = "block";
    });

    // Chat enter key toggle & H key morph toggle
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
      } else if (e.code === "KeyH" && this.isEntered) {
        // Toggle Morph Modal with H key when not typing in chat or input
        if (document.activeElement?.tagName !== "INPUT") {
          this.toggleMorphModal();
          e.preventDefault();
        }
      }
    });
  }

  setupCharacterSelectors() {
    // Entry Screen Avatar Cards
    const entryCards = document.querySelectorAll("#entry-avatar-grid .avatar-card");
    entryCards.forEach((card) => {
      card.addEventListener("click", () => {
        entryCards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        this.selectedCharacterType = card.dataset.type || "astronaut";
      });
    });

    // Entry Screen Color Swatches
    const entrySwatches = document.querySelectorAll("#entry-color-swatches .color-swatch");
    entrySwatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        entrySwatches.forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
        this.selectedColor = swatch.dataset.color || "#00f0ff";
      });
    });
  }

  setupMorphModal() {
    if (this.hudMorphBtn) {
      this.hudMorphBtn.addEventListener("click", () => {
        this.toggleMorphModal();
      });
    }

    // Morph Modal Avatar Cards
    const morphCards = document.querySelectorAll("#morph-avatar-grid .avatar-card");
    morphCards.forEach((card) => {
      card.addEventListener("click", () => {
        morphCards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });

    // Morph Modal Color Swatches
    const morphSwatches = document.querySelectorAll("#morph-color-swatches .color-swatch");
    morphSwatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        morphSwatches.forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
      });
    });

    // Apply button
    const applyBtn = document.getElementById("morph-apply-btn");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        const selectedCard = document.querySelector("#morph-avatar-grid .avatar-card.selected");
        const selectedSwatch = document.querySelector("#morph-color-swatches .color-swatch.selected");
        const urlInput = document.getElementById("morph-avatar-url");

        const newType = selectedCard ? selectedCard.dataset.type : this.selectedCharacterType;
        const newColor = selectedSwatch ? selectedSwatch.dataset.color : this.selectedColor;
        const newUrl = urlInput ? urlInput.value.trim() : "";

        this.selectedCharacterType = newType;
        this.selectedColor = newColor;
        this.selectedAvatarUrl = newUrl;

        if (this.onMorphCallback) {
          this.onMorphCallback(newType, newColor, newUrl);
        }

        this.addLogItem(`✨ Transmuted form into [${newType.toUpperCase()}]`);
        this.closeMorphModal();
      });
    }

    // Close button
    const closeBtn = document.getElementById("morph-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closeMorphModal();
      });
    }
  }

  toggleMorphModal() {
    if (!this.morphModal) return;
    const isVisible = this.morphModal.style.display === "block";
    if (isVisible) {
      this.closeMorphModal();
    } else {
      this.openMorphModal();
    }
  }

  openMorphModal() {
    if (!this.morphModal) return;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Sync modal selection to current active state
    const morphCards = document.querySelectorAll("#morph-avatar-grid .avatar-card");
    morphCards.forEach((c) => {
      if (c.dataset.type === this.selectedCharacterType) c.classList.add("selected");
      else c.classList.remove("selected");
    });

    const morphSwatches = document.querySelectorAll("#morph-color-swatches .color-swatch");
    morphSwatches.forEach((s) => {
      if (s.dataset.color === this.selectedColor) s.classList.add("selected");
      else s.classList.remove("selected");
    });

    const urlInput = document.getElementById("morph-avatar-url");
    if (urlInput) urlInput.value = this.selectedAvatarUrl || "";

    this.morphModal.style.display = "block";
  }

  closeMorphModal() {
    if (!this.morphModal) return;
    this.morphModal.style.display = "none";
    document.getElementById("webgl-canvas")?.requestPointerLock();
  }

  setPlayerInfo(id, roomName = "SPACE", pilotName = null) {
    if (this.playerIdEl) {
      this.playerIdEl.innerText = pilotName ? `${pilotName} [${id.slice(0, 4)}]` : id.slice(0, 8);
    }
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
