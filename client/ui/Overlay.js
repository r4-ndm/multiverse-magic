import { characterRegistry } from "../characters/index.js";

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
    this.selectedCharacterType = "wizard";
    this.selectedColor = "#9d00ff";
    this.selectedAvatarUrl = "";

    this.morphModal = document.getElementById("morph-modal");
    this.hudMorphBtn = document.getElementById("hud-morph-btn");
    this.hudCameraBtn = document.getElementById("hud-camera-btn");
    this.hudStarmapBtn = document.getElementById("hud-starmap-btn");
    this.hudBuildBtn = document.getElementById("hud-build-btn");
    this.starmapModal = document.getElementById("starmap-modal");
    this.planetModal = document.getElementById("planet-modal");
    this.onCameraToggle = null;
    this.hyperlaneGate = null;
    this.onBuildPlanetCallback = null;
  }

  init(onEnter, onChatSend, onMorph, onCameraToggle = null, hyperlaneGate = null, playerSystem = null, audioSystem = null, onBuildPlanet = null) {
    this.onEnterCallback = onEnter;
    this.onChatSend = onChatSend;
    this.onMorphCallback = onMorph;
    this.onCameraToggle = onCameraToggle;
    this.hyperlaneGate = hyperlaneGate;
    this.playerSystem = playerSystem;
    this.audioSystem = audioSystem;
    this.onBuildPlanetCallback = onBuildPlanet;

    // Load default pilot callsign if a real custom name was previously saved
    const savedName = localStorage.getItem("pilot_callsign");
    if (this.pilotNameInput && savedName && !savedName.startsWith("Pilot-")) {
      this.pilotNameInput.value = savedName;
    }

    // Initialize character selector listeners on entry screen
    this.setupCharacterSelectors();

    // Initialize in-game morph modal
    this.setupMorphModal();

    // Initialize in-game interstellar starmap modal
    this.setupStarmapModal();

    // Initialize in-game planet builder modal
    this.setupPlanetModal();

    this.enterBtn.addEventListener("click", async () => {
      if (this.isEntered) return;
      this.isEntered = true;

      let rawInput = this.pilotNameInput?.value.trim() || "";
      const avatarUrlInput = document.getElementById("entry-avatar-url");
      let rawUrl = avatarUrlInput ? avatarUrlInput.value.trim() : "";

      // Smart detection: if someone typed their username into the avatar URL field by mistake
      if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://") && !rawUrl.endsWith(".glb") && !rawUrl.endsWith(".gltf")) {
        if (!rawInput) {
          rawInput = rawUrl;
          rawUrl = "";
        }
      }

      const chosenName = rawInput || (savedName && !savedName.startsWith("Pilot-") ? savedName : `Pilot-${Math.floor(1000 + Math.random() * 9000)}`);
      if (rawInput) {
        localStorage.setItem("pilot_callsign", rawInput);
      }
      this.currentPilotName = chosenName;
      this.selectedAvatarUrl = rawUrl;

      // Trigger user activation callback (mic request, audio context, colyseus connect)
      if (this.onEnterCallback) {
        await this.onEnterCallback(chosenName, this.selectedCharacterType, this.selectedColor, this.selectedAvatarUrl);
      }

      // Hide entry screen and show HUD
      this.entryOverlay.style.display = "none";
      this.hud.style.display = "block";
      if (this.crosshair) this.crosshair.style.display = "block";

      // Request pointer lock right from the entry click gesture
      document.getElementById("webgl-canvas")?.requestPointerLock();
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
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          this.toggleMorphModal();
          e.preventDefault();
        }
      } else if (e.code === "KeyB" && this.isEntered) {
        // Toggle Planet Forge Modal with B key when not typing in chat or input
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          this.togglePlanetModal();
          e.preventDefault();
        }
      }
    });
  }

  renderCharacterGrids() {
    const characters = characterRegistry.getAll();
    const entryGrid = document.getElementById("entry-avatar-grid");
    const morphGrid = document.getElementById("morph-avatar-grid");

    const populate = (container, isMorph = false) => {
      if (!container) return;
      container.innerHTML = "";
      characters.forEach((char) => {
        const isSelected = char.id === this.selectedCharacterType;
        const card = document.createElement("div");
        card.className = `avatar-card ${isSelected ? "selected" : ""}`;
        card.dataset.type = char.id;
        card.innerHTML = `
          <span class="icon">${char.emoji || "👤"}</span>
          <span class="name">${char.name || char.id}</span>
          <span class="desc">${char.description || "Custom Form"}</span>
        `;
        card.addEventListener("click", () => {
          container.querySelectorAll(".avatar-card").forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          if (!isMorph) {
            this.selectedCharacterType = char.id;
            if (char.defaultColor) {
              this.selectColor(char.defaultColor, false);
            }
          }
        });
        container.appendChild(card);
      });
    };

    populate(entryGrid, false);
    populate(morphGrid, true);
  }

  selectColor(colorHex, isMorph = false) {
    const prefix = isMorph ? "#morph-color-swatches" : "#entry-color-swatches";
    const swatches = document.querySelectorAll(`${prefix} .color-swatch`);
    swatches.forEach((s) => {
      if (s.dataset.color.toLowerCase() === colorHex.toLowerCase()) {
        s.classList.add("selected");
      } else {
        s.classList.remove("selected");
      }
    });
    if (!isMorph) this.selectedColor = colorHex;
  }

  setupCharacterSelectors() {
    this.renderCharacterGrids();

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

    if (this.hudCameraBtn) {
      this.hudCameraBtn.addEventListener("click", () => {
        if (this.onCameraToggle) {
          this.onCameraToggle();
        }
      });
    }

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
        let newUrl = urlInput ? urlInput.value.trim() : "";

        const newType = selectedCard ? selectedCard.dataset.type : this.selectedCharacterType;
        const newColor = selectedSwatch ? selectedSwatch.dataset.color : this.selectedColor;
        const nameInput = document.getElementById("morph-pilot-name");
        let newName = nameInput ? nameInput.value.trim() : "";

        // Smart name detection: if someone typed their username into the avatar URL field by mistake
        if (newUrl && !newUrl.startsWith("http://") && !newUrl.startsWith("https://") && !newUrl.endsWith(".glb") && !newUrl.endsWith(".gltf")) {
          if (!newName) {
            newName = newUrl;
            newUrl = "";
          }
        }

        if (newName) {
          this.currentPilotName = newName;
          localStorage.setItem("pilot_callsign", newName);
        }

        this.selectedCharacterType = newType;
        this.selectedColor = newColor;
        this.selectedAvatarUrl = newUrl;

        if (this.onMorphCallback) {
          this.onMorphCallback(newType, newColor, newUrl, newName);
        }

        const displayName = newName || this.currentPilotName || "Pilot";
        this.addLogItem(`✨ [${displayName}] transmuted form into [${newType.toUpperCase()}]`);
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

    // Pre-fill pilot name
    const nameInput = document.getElementById("morph-pilot-name");
    if (nameInput) {
      nameInput.value = this.currentPilotName || localStorage.getItem("pilot_callsign") || "";
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

  setupStarmapModal() {
    if (this.hudStarmapBtn) {
      this.hudStarmapBtn.addEventListener("click", () => {
        this.toggleStarmapModal();
      });
    }

    const closeBtn = document.getElementById("starmap-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.closeStarmapModal();
      });
    }

    // Custom system jump button
    const customJumpBtn = document.getElementById("custom-system-jump-btn");
    const customUrlInput = document.getElementById("custom-system-url");
    if (customJumpBtn && customUrlInput) {
      customJumpBtn.addEventListener("click", () => {
        const rawUrl = customUrlInput.value.trim();
        if (!rawUrl) return;

        let targetUrl = rawUrl;
        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
          targetUrl = "https://" + targetUrl;
        }

        if (this.hyperlaneGate) {
          this.hyperlaneGate.setDestination("FEDERATED SYSTEM", targetUrl, 25.0);
          this.closeStarmapModal();
          this.hyperlaneGate.engageJump(this.playerSystem, this.audioSystem, this);
        }
      });
    }

    // Copy my beacon URL button
    const copyBtn = document.getElementById("copy-beacon-btn");
    const beaconInput = document.getElementById("my-system-beacon-url");
    if (copyBtn && beaconInput) {
      copyBtn.addEventListener("click", () => {
        beaconInput.select();
        navigator.clipboard.writeText(beaconInput.value).then(() => {
          copyBtn.innerText = "COPIED! ✓";
          setTimeout(() => {
            copyBtn.innerText = "COPY BEACON";
          }, 2000);
        }).catch(() => {
          document.execCommand("copy");
          copyBtn.innerText = "COPIED! ✓";
        });
      });
    }
  }

  toggleStarmapModal() {
    if (!this.starmapModal) return;
    const isVisible = this.starmapModal.style.display === "block";
    if (isVisible) {
      this.closeStarmapModal();
    } else {
      this.openStarmapModal();
    }
  }

  openStarmapModal() {
    if (!this.starmapModal) return;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Populate current URL into beacon input
    const beaconInput = document.getElementById("my-system-beacon-url");
    if (beaconInput) {
      beaconInput.value = window.location.origin;
    }

    // Render system cards
    const grid = document.getElementById("starmap-system-grid");
    if (grid) {
      grid.innerHTML = "";

      const urlParams = new URLSearchParams(window.location.search);
      const activeSystem = urlParams.get("system") || "sol";

      const systems = [
        {
          id: "sol",
          name: "Sol Prime",
          tag: "NEXUS HUB",
          desc: "Central deep space citadel with celestial beacon & fighter docks.",
          meta: "0.0 LY // HOME SECTOR",
          url: "/?system=sol",
          icon: "☀️",
        },
        {
          id: "vega",
          name: "Vega Outpost",
          tag: "ICE MINING BELT",
          desc: "Frosty sapphire star field with crystalline ice asteroid deposits.",
          meta: "14.2 LY // FEDERATED NODE",
          url: "/?system=vega",
          icon: "🪐",
        },
        {
          id: "kepler",
          name: "Kepler Void",
          tag: "PULSAR GRAVITY WELL",
          desc: "Radioactive binary pulsar sector with dense plasma radiation belt.",
          meta: "48.7 LY // UNCHARTED",
          url: "/?system=kepler",
          icon: "☄️",
        },
        {
          id: "centauri",
          name: "Alpha Centauri",
          tag: "ORBITAL CITADEL",
          desc: "Golden binary star system hosting high-speed dogfight arenas.",
          meta: "4.3 LY // FEDERATED HUB",
          url: "/?system=centauri",
          icon: "🛰️",
        },
      ];

      systems.forEach((sys) => {
        const isCurrent = sys.id === activeSystem;
        const card = document.createElement("div");
        card.className = `system-card ${isCurrent ? "current" : ""}`;
        card.innerHTML = `
          <div class="sys-title">
            <span>${sys.icon}</span>
            <span>${sys.name}</span>
            ${isCurrent ? '<span style="color:var(--neon-green); font-size:10px; margin-left:auto;">[CURRENT]</span>' : ''}
          </div>
          <div class="sys-desc">${sys.desc}</div>
          <div class="sys-meta">${sys.meta}</div>
        `;

        if (!isCurrent) {
          card.addEventListener("click", () => {
            if (this.hyperlaneGate) {
              this.hyperlaneGate.setDestination(sys.name, sys.url, parseFloat(sys.meta) || 12.0);
              this.closeStarmapModal();
              this.hyperlaneGate.engageJump(this.playerSystem, this.audioSystem, this);
            }
          });
        }

        grid.appendChild(card);
      });
    }

    this.starmapModal.style.display = "block";
  }

  closeStarmapModal() {
    if (!this.starmapModal) return;
    this.starmapModal.style.display = "none";
    document.getElementById("webgl-canvas")?.requestPointerLock();
  }

  setPlayerInfo(id, roomName = "SPACE", pilotName = null) {
    const displayName = pilotName || this.currentPilotName || id.slice(0, 8);
    if (this.playerIdEl) {
      this.playerIdEl.innerText = displayName;
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

  setupPlanetModal() {
    if (this.hudBuildBtn) {
      this.hudBuildBtn.addEventListener("click", () => {
        this.togglePlanetModal();
      });
    }

    // Form cards selector
    const formCards = document.querySelectorAll("#planet-form-grid .planet-form-card");
    formCards.forEach((card) => {
      card.addEventListener("click", () => {
        formCards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
      });
    });

    // Color Swatches
    const colorSwatches = document.querySelectorAll("#planet-color-swatches .color-swatch");
    colorSwatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        colorSwatches.forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
      });
    });

    // Atmosphere Swatches
    const atmoSwatches = document.querySelectorAll("#planet-atmo-swatches .color-swatch");
    atmoSwatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        atmoSwatches.forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
      });
    });

    // Size Pills
    const sizePills = document.querySelectorAll("#planet-size-pills .option-pill");
    sizePills.forEach((pill) => {
      pill.addEventListener("click", () => {
        sizePills.forEach((p) => p.classList.remove("selected"));
        pill.classList.add("selected");
      });
    });

    // Ring Pills
    const ringPills = document.querySelectorAll("#planet-ring-pills .option-pill");
    ringPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        ringPills.forEach((p) => p.classList.remove("selected"));
        pill.classList.add("selected");
      });
    });

    // Moon Pills
    const moonPills = document.querySelectorAll("#planet-moon-pills .option-pill");
    moonPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        moonPills.forEach((p) => p.classList.remove("selected"));
        pill.classList.add("selected");
      });
    });

    // Placement Pills
    const placementPills = document.querySelectorAll("#planet-placement-pills .option-pill");
    placementPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        placementPills.forEach((p) => p.classList.remove("selected"));
        pill.classList.add("selected");
      });
    });

    // Forge Button
    const forgeBtn = document.getElementById("planet-forge-btn");
    if (forgeBtn) {
      forgeBtn.addEventListener("click", () => {
        const nameInput = document.getElementById("planet-name-input");
        const customUrlInput = document.getElementById("planet-custom-url");
        const selectedFormCard = document.querySelector("#planet-form-grid .planet-form-card.selected");
        const selectedColorSwatch = document.querySelector("#planet-color-swatches .color-swatch.selected");
        const selectedAtmoSwatch = document.querySelector("#planet-atmo-swatches .color-swatch.selected");
        const selectedSizePill = document.querySelector("#planet-size-pills .option-pill.selected");
        const selectedRingPill = document.querySelector("#planet-ring-pills .option-pill.selected");
        const selectedMoonPill = document.querySelector("#planet-moon-pills .option-pill.selected");
        const selectedPlacementPill = document.querySelector("#planet-placement-pills .option-pill.selected");

        const planetName = nameInput?.value.trim() || `World-${Math.floor(100 + Math.random() * 900)}`;
        const form = selectedFormCard?.dataset.form || "terrestrial";
        const primaryColor = selectedColorSwatch?.dataset.color || "#00f0ff";
        const secondaryColor = selectedAtmoSwatch?.dataset.color || "#9d00ff";
        const radius = Number(selectedSizePill?.dataset.radius) || 35;
        const rings = selectedRingPill?.dataset.rings || "single";
        const moons = Number(selectedMoonPill?.dataset.moons) || 1;
        const placement = selectedPlacementPill?.dataset.placement || "forward";
        const customModelUrl = customUrlInput?.value.trim() || "";

        const config = {
          name: planetName,
          form,
          primaryColor,
          secondaryColor,
          radius,
          rings,
          moons,
          placement,
          hasAtmosphere: true,
          customModelUrl,
        };

        if (this.onBuildPlanetCallback) {
          this.onBuildPlanetCallback(config);
        }

        this.addLogItem(`🪐 Initiating cosmic genesis: "${planetName}" [${form.toUpperCase()}]...`);
        this.closePlanetModal();
      });
    }

    const closeBtn = document.getElementById("planet-close-btn");
    const cancelBtn = document.getElementById("planet-cancel-btn");
    [closeBtn, cancelBtn].forEach((btn) => {
      if (btn) btn.addEventListener("click", () => this.closePlanetModal());
    });
  }

  togglePlanetModal() {
    if (!this.planetModal) return;
    if (this.planetModal.style.display === "block") {
      this.closePlanetModal();
    } else {
      this.openPlanetModal();
    }
  }

  openPlanetModal() {
    if (!this.planetModal) return;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.closeMorphModal();
    this.closeStarmapModal();
    this.planetModal.style.display = "block";
    const nameInput = document.getElementById("planet-name-input");
    if (nameInput && !nameInput.value) {
      const presets = ["Nova Prime", "Aethelgard", "Cyberia", "Verdant Echo", "Chronos Ring", "Solaris IV", "Opal Oasis"];
      nameInput.value = presets[Math.floor(Math.random() * presets.length)];
    }
  }

  closePlanetModal() {
    if (!this.planetModal) return;
    this.planetModal.style.display = "none";
    if (this.isEntered) {
      document.getElementById("webgl-canvas")?.requestPointerLock();
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
