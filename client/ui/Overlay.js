import * as THREE from "three";
import { characterRegistry } from "../characters/index.js";
import { fileToPortrait, uploadPortrait } from "./portrait.js";

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
    this.returnCompass = document.getElementById("return-compass");
    this.returnArrow = document.getElementById("return-arrow");
    this.returnHeading = document.getElementById("return-heading");
    this.returnMeta = document.getElementById("return-meta");
    this.returnPip = document.getElementById("return-pip");
    this.stranded = false;
    this.ejectionTimer = null;
    this._home = new THREE.Vector3();
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
    this.hudStarmapBtn = document.getElementById("hud-starmap-btn");
    this.hudBuildBtn = document.getElementById("hud-build-btn");
    this.hudGravityBtn = document.getElementById("hud-gravity-btn");
    this.hudDriveBtn = document.getElementById("hud-drive-btn");
    this.speedoEl = document.getElementById("hud-speedo");
    this.speedoValueEl = document.getElementById("hud-speedo-value");
    this.hudLinkBtn = document.getElementById("hud-link-btn");
    this.hudMeetBtn = document.getElementById("hud-meet-btn");
    this.meetingModal = document.getElementById("meeting-modal");
    this.starmapModal = document.getElementById("starmap-modal");
    this.planetModal = document.getElementById("planet-modal");
    this.linkGunModal = document.getElementById("link-gun-modal");
    this.onCameraToggle = null;
    this.hyperlaneGate = null;
    this.onBuildPlanetCallback = null;
    this.onToggleBlockGun = null;
    this.onToggleLinkGun = null;
    this.onToggleMeetGun = null;
    this.blockGunArmed = false;
    this.linkGunArmed = false;
    this.meetGunArmed = false;
    this.linkInkUrl = "";
    this.pendingMeeting = null;
  }

  init(onEnter, onChatSend, onMorph, onCameraToggle = null, hyperlaneGate = null, playerSystem = null, audioSystem = null, onBuildPlanet = null, onTuneTV = null) {
    this.onEnterCallback = onEnter;
    this.onChatSend = onChatSend;
    this.onMorphCallback = onMorph;
    this.onCameraToggle = onCameraToggle;
    this.hyperlaneGate = hyperlaneGate;
    this.playerSystem = playerSystem;
    this.audioSystem = audioSystem;
    this.onBuildPlanetCallback = onBuildPlanet;
    this.onTuneTV = onTuneTV;

    // Load default pilot callsign if a real custom name was previously saved
    const savedName = localStorage.getItem("pilot_callsign");
    if (this.pilotNameInput && savedName && !savedName.startsWith("Pilot-")) {
      this.pilotNameInput.value = savedName;
    }

    // Initialize character selector listeners on entry screen
    this.setupCharacterSelectors();

    // Initialize in-game morph modal
    this.setupMorphModal();

    // Initialize in-game planet builder modal
    this.setupPlanetModal();

    this.setupGravity();
    this.setupDrive();
    this.setupLinkGun();
    this.setupMeeting();
    this.setupPortraitPickers();
    this.refreshJoinLinks();
    this.setupJoinLinkCopy();

    this.enterBtn.addEventListener("click", async () => {
      if (this.isEntered) return;
      this.isEntered = true;

      let rawInput = this.pilotNameInput?.value.trim() || "";
      const avatarUrlInput = document.getElementById("entry-avatar-url");
      let rawUrl = avatarUrlInput ? avatarUrlInput.value.trim() : "";
      const picture = document.getElementById("entry-avatar-file")?.files?.[0];
      if (picture) {
        this.enterBtn.textContent = "FITTING PICTURE...";
        try {
          rawUrl = await uploadPortrait(picture);
        } catch (err) {
          console.warn("[Overlay] Portrait upload failed:", err);
          this.addLogItem("⚠️ Picture didn't save. Entered with the chosen form.");
        }
        this.enterBtn.textContent = "CLICK TO ENTER SPACE";
      }

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

      // Explicitly blur any input that might still have focus
      document.activeElement?.blur();
      this.pilotNameInput?.blur();
      this.chatInput?.blur();

      // Request pointer lock right from the entry click gesture
      const canvas = document.getElementById("webgl-canvas");
      canvas?.focus();
      canvas?.requestPointerLock();
    });

    // Chat enter key toggle & HUD key shortcuts
    window.addEventListener("keydown", (e) => {
      const isInput = document.activeElement === this.chatInput || 
                      document.activeElement?.tagName === "INPUT" || 
                      document.activeElement?.tagName === "TEXTAREA";

      if (e.code === "Enter" && document.activeElement?.id !== "tv-url-input") {
        if (document.activeElement === this.chatInput) {
          const text = this.chatInput.value.trim();
          if (text && this.onChatSend) {
            this.onChatSend(text);
          }
          this.chatInput.value = "";
          this.chatInput.blur();
          document.getElementById("webgl-canvas")?.focus();
          document.getElementById("webgl-canvas")?.requestPointerLock();
        } else if (this.isEntered) {
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
          this.chatInput.focus();
          e.preventDefault();
        }
        return;
      }

      if (isInput && (e.code === "Escape" || e.key === "Escape")) {
        if (this.linkGunModal && this.linkGunModal.style.display === "flex") {
          this.closeLinkGunModal();
          e.preventDefault();
        } else if (this.meetingModal && this.meetingModal.style.display === "flex") {
          this.closeMeetingModal();
          e.preventDefault();
        }
        return;
      }

      // If user is actively typing in a text field, do not trigger game modals
      if (isInput) return;

      const isH = e.code === "KeyH" || e.key === "h" || e.key === "H" || e.keyCode === 72;
      const isB = e.code === "KeyB" || e.key === "b" || e.key === "B" || e.keyCode === 66;
      const isE = e.code === "KeyE" || e.key === "e" || e.key === "E" || e.keyCode === 69;
      const isM = e.code === "KeyM" || e.key === "m" || e.key === "M" || e.keyCode === 77;
      const isG = e.code === "KeyG" || e.key === "g" || e.key === "G" || e.keyCode === 71;
      const isV = e.code === "KeyV" || e.key === "v" || e.key === "V" || e.keyCode === 86;
      const isF = e.code === "KeyF" || e.key === "f" || e.key === "F" || e.keyCode === 70;
      const isEsc = e.code === "Escape" || e.key === "Escape" || e.keyCode === 27;

      if (isH) {
        this.toggleMorphModal();
        e.preventDefault();
      } else if (isB) {
        this.toggleBlockGun();
        e.preventDefault();
      } else if (isE) {
        this.toggleLinkGun();
        e.preventDefault();
      } else if (isM) {
        this.toggleMeetingGun();
        e.preventDefault();
      } else if (isG && !e.repeat) {
        this.playerSystem?.toggleGravity();
        e.preventDefault();
      } else if (isV && !e.repeat) {
        this.tryDrive();
        e.preventDefault();
      } else if (isF && !e.repeat && this.playerSystem?.drivingCar) {
        const cabin = this.playerSystem.vehicleSystem?.toggleCabinView?.();
        this.addLogItem(cabin ? "👁️ Cabin view (first person)." : "📹 Chase camera.");
        e.preventDefault();
      } else if (isEsc) {
        if (this.meetingModal && this.meetingModal.style.display === "flex") {
          this.closeMeetingModal();
        } else if (this.linkGunModal && this.linkGunModal.style.display === "flex") {
          this.closeLinkGunModal();
        } else if (this.planetModal && this.planetModal.style.display === "block") {
          this.closePlanetModal();
        } else if (this.morphModal && this.morphModal.style.display === "block") {
          this.closeMorphModal();
        } else if (this.starmapModal && this.starmapModal.style.display === "block") {
          this.closeStarmapModal();
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

  setupPortraitPickers() {
    this.bindPortraitPicker("entry-avatar-file", "entry-avatar-preview");
    this.bindPortraitPicker("morph-avatar-file", "morph-avatar-preview");
  }

  bindPortraitPicker(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        preview.hidden = true;
        preview.removeAttribute("src");
        return;
      }
      try {
        preview.src = await fileToPortrait(file);
        preview.hidden = false;
      } catch (err) {
        preview.hidden = true;
        console.warn("[Overlay] Portrait preview failed:", err);
      }
    });
  }

  setupMorphModal() {
    if (this.hudMorphBtn) {
      this.hudMorphBtn.addEventListener("click", () => {
        this.toggleMorphModal();
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
      applyBtn.addEventListener("click", async () => {
        const selectedCard = document.querySelector("#morph-avatar-grid .avatar-card.selected");
        const selectedSwatch = document.querySelector("#morph-color-swatches .color-swatch.selected");
        const urlInput = document.getElementById("morph-avatar-url");
        let newUrl = urlInput ? urlInput.value.trim() : "";
        const picture = document.getElementById("morph-avatar-file")?.files?.[0];

        const newType = selectedCard ? selectedCard.dataset.type : this.selectedCharacterType;
        const newColor = selectedSwatch ? selectedSwatch.dataset.color : this.selectedColor;
        const nameInput = document.getElementById("morph-pilot-name");
        let newName = nameInput ? nameInput.value.trim() : "";

        if (picture) {
          applyBtn.textContent = "FITTING...";
          try {
            newUrl = await uploadPortrait(picture);
          } catch (err) {
            console.warn("[Overlay] Portrait upload failed:", err);
            this.addLogItem("⚠️ Picture didn't save. Form stayed on the chosen card.");
            newUrl = "";
          }
          applyBtn.textContent = "TRANSMUTE";
        } else if (newUrl && !newUrl.startsWith("http://") && !newUrl.startsWith("https://") && !newUrl.endsWith(".glb") && !newUrl.endsWith(".gltf")) {
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

  getOpenSpaceUrl() {
    const params = new URLSearchParams(window.location.search);
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    const origin = isLocal ? "https://multiverse-magic.fly.dev" : window.location.origin;
    const url = new URL("/", origin);
    url.searchParams.set("system", "sol");
    const room = params.get("room");
    if (room) url.searchParams.set("room", room);
    return url.toString();
  }

  getMeetingUrl(id) {
    const url = new URL(this.getOpenSpaceUrl());
    url.searchParams.set("meet", id);
    return url.toString();
  }

  refreshJoinLinks() {
    const href = this.getOpenSpaceUrl();
    ["entry-join-link", "hud-join-link"].forEach((id) => {
      const link = document.getElementById(id);
      if (!link) return;
      link.href = href;
      link.textContent = href;
    });
    const beaconInput = document.getElementById("my-system-beacon-url");
    if (beaconInput) beaconInput.value = href;
  }

  setupJoinLinkCopy() {
    const copy = async (button) => {
      const href = this.getOpenSpaceUrl();
      try {
        await navigator.clipboard.writeText(href);
      } catch (_) {
        const beaconInput = document.getElementById("my-system-beacon-url");
        if (beaconInput) {
          beaconInput.value = href;
          beaconInput.select();
          document.execCommand("copy");
        }
      }
      if (!button) return;
      const previous = button.textContent;
      button.textContent = "COPIED";
      setTimeout(() => {
        button.textContent = previous;
      }, 1600);
    };

    document.getElementById("entry-copy-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      copy(e.currentTarget);
    });
    document.getElementById("hud-copy-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      copy(e.currentTarget);
    });
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

    this.refreshJoinLinks();

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

  showEjection(isLocalPlayer, targetId, coords, cruise = 32) {
    if (isLocalPlayer) {
      this.stranded = true;
      this.ejectionBanner.style.display = "block";
      this.statusDot?.classList.add("ejected");
      if (this.returnCompass) this.returnCompass.hidden = false;

      const dist = Math.sqrt(coords.x * coords.x + coords.y * coords.y + coords.z * coords.z);
      const burn = this.formatBurn(dist, cruise);
      if (this.ejectionDistance) {
        this.ejectionDistance.innerText = `${Math.round(dist).toLocaleString()} units out. Full burn home is about ${burn}.`;
      }

      this.addLogItem(`CRITICAL: Ejected into deep space. Follow the gold star. About ${burn} at full burn.`, true);

      if (this.ejectionTimer) clearTimeout(this.ejectionTimer);
      this.ejectionTimer = setTimeout(() => {
        if (this.ejectionBanner) this.ejectionBanner.style.display = "none";
      }, 9000);
    } else {
      this.addLogItem(`🚨 Pilot [${targetId.slice(0, 6)}] was ejected into deep space!`, true);
    }
  }

  resumeExile() {
    this.stranded = true;
    this.statusDot?.classList.add("ejected");
    if (this.returnCompass) this.returnCompass.hidden = false;
    this.addLogItem("🌌 Still in deep space. The gold star is the sector. Burn toward it.", true);
  }

  formatBurn(distance, speed) {
    const seconds = Math.max(1, Math.round(distance / Math.max(speed, 1)));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins <= 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  }

  updateReturnBeacon(position, camera, speed) {
    if (!this.stranded || !position || !camera) return;
    const dist = position.length();
    this.sceneBeacon?.(this.stranded, dist);
    if (dist < 380) {
      this.clearReturnBeacon();
      this.addLogItem("🌌 Sector reacquired. You're back in range.");
      return;
    }

    this._home.set(0, 0, 0);
    const toHome = this._home.clone().sub(position).normalize();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const ahead = toHome.dot(forward);
    const side = toHome.dot(right);
    const climb = toHome.dot(up);

    let heading = "BEACON AHEAD";
    if (ahead < -0.25) heading = "BEACON BEHIND";
    else if (Math.abs(side) > 0.35 && Math.abs(side) >= Math.abs(climb)) heading = side > 0 ? "BEACON RIGHT" : "BEACON LEFT";
    else if (climb > 0.35) heading = "BEACON ABOVE";
    else if (climb < -0.35) heading = "BEACON BELOW";
    else if (ahead > 0.92) heading = "BURN DEAD AHEAD";

    if (this.returnHeading) this.returnHeading.textContent = heading;
    if (this.returnMeta) {
      this.returnMeta.textContent = `${Math.round(dist).toLocaleString()}u out · ${this.formatBurn(dist, speed)} at full burn`;
    }
    if (this.returnCompass) this.returnCompass.hidden = false;
    if (this.returnArrow) {
      const angle = Math.atan2(side, climb);
      this.returnArrow.style.transform = `rotate(${angle}rad)`;
    }

    const projected = this._home.clone().project(camera);
    let x = projected.x;
    let y = projected.y;
    const behind = projected.z > 1;
    if (behind) {
      x = -x;
      y = -y;
    }
    const span = Math.hypot(x, y) || 1;
    const edge = 0.86;
    const offscreen = behind || span > edge || Math.abs(x) > 0.92 || Math.abs(y) > 0.92;
    if (offscreen) {
      x = (x / span) * edge;
      y = (y / span) * edge;
    }
    if (this.returnPip) {
      this.returnPip.hidden = false;
      this.returnPip.style.left = `${(x * 0.5 + 0.5) * 100}%`;
      this.returnPip.style.top = `${(-y * 0.5 + 0.5) * 100}%`;
      this.returnPip.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(x, y)}rad)`;
    }
    if (this.ejectionDistance && this.ejectionBanner?.style.display === "block") {
      this.ejectionDistance.innerText = `${Math.round(dist).toLocaleString()} units out. Full burn home is about ${this.formatBurn(dist, speed)}.`;
    }
  }

  clearReturnBeacon() {
    this.stranded = false;
    if (this.ejectionTimer) clearTimeout(this.ejectionTimer);
    if (this.ejectionBanner) this.ejectionBanner.style.display = "none";
    if (this.returnCompass) this.returnCompass.hidden = true;
    if (this.returnPip) this.returnPip.hidden = true;
    this.statusDot?.classList.remove("ejected");
    this.sceneBeacon?.(false, 0);
  }

  setupPlanetModal() {
    if (this.hudBuildBtn) {
      this.hudBuildBtn.addEventListener("click", () => {
        this.toggleBlockGun();
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

  setupGravity() {
    this.hudGravityBtn?.addEventListener("click", () => {
      this.playerSystem?.toggleGravity();
    });
  }

  setupDrive() {
    this.hudDriveBtn?.addEventListener("click", () => {
      this.tryDrive();
    });
  }

  tryDrive() {
    const vehicles = this.playerSystem?.vehicleSystem;
    if (!vehicles) return;
    if (this.playerSystem.drivingCar) {
      vehicles.exitCar();
      return;
    }
    if (!this.playerSystem.gravityOn) {
      this.playerSystem.setGravity(true);
    }
    const entered = vehicles.enterNearest();
    if (!entered) {
      this.addLogItem("🚗 Walk next to a car on a container, then press V.");
    }
  }

  setGravityState(on) {
    if (this.hudGravityBtn) {
      this.hudGravityBtn.textContent = on ? "🚶 WALKING [G]" : "🪐 GRAVITY [G]";
      this.hudGravityBtn.classList.toggle("armed", on);
    }
    this.addLogItem(on
      ? "🚶 Gravity on. You drop onto containers. WASD walks, Q jumps, G flies again."
      : "🪐 Gravity off. You're flying.");
  }

  setDrivingState(on, kind = "car") {
    if (this.hudDriveBtn) {
      this.hudDriveBtn.textContent = on ? "🚪 EXIT CAR [V]" : "🚗 DRIVE [V]";
      this.hudDriveBtn.classList.toggle("armed", on);
    }
    if (this.speedoEl) this.speedoEl.hidden = !on;
    if (on) {
      const label =
        kind === "tractor"
          ? "tractor"
          : kind === "banger"
            ? "old banger"
            : kind === "concept"
              ? "concept car"
              : "supercar";
      this.addLogItem(
        `🚗 In a ${label}. WASD drive, mouse look, Shift skid. F chase cam. V exit.`
      );
    } else {
      this.addLogItem("🚶 Left the car.");
    }
  }

  updateSpeedo(kmh = 0) {
    if (!this.speedoValueEl) return;
    this.speedoValueEl.textContent = String(Math.round(Math.max(0, kmh)));
  }

  toggleBlockGun() {
    this.blockGunArmed = !this.blockGunArmed;
    if (this.hudBuildBtn) {
      this.hudBuildBtn.textContent = this.blockGunArmed ? "📦 PLACING BLOCKS [B]" : "📦 BLOCK GUN [B]";
      this.hudBuildBtn.style.background = this.blockGunArmed ? "rgba(0, 255, 136, 0.22)" : "";
    }
    if (this.blockGunArmed) {
      this.setLinkGunArmed(false);
      this.setMeetGunArmed(false);
    }
    this.refreshWeaponHint();
    this.addLogItem(this.blockGunArmed
      ? "📦 Block gun armed. Shoot to place a container. Blocks snap together."
      : "🔫 Laser armed.");
    if (this.onToggleBlockGun) this.onToggleBlockGun(this.blockGunArmed);
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

  idleWeaponHint() {
    return "WASD: Fly & Strafe | Q/C: Ascend/Descend<br/>Space: Shoot | E: Link Gun | M: Meeting | B: Block Gun | H: Morph";
  }

  refreshWeaponHint() {
    const hint = document.querySelector("#voice-controls-panel .keybind-hint");
    if (!hint) return;
    if (this.meetGunArmed) {
      hint.innerHTML = "WASD: Fly & Strafe | Q/C: Ascend/Descend<br/>Space: Shoot | Left Click / F: Place Meeting | M: Laser | E: Link Gun | B: Block Gun";
    } else if (this.linkGunArmed) {
      hint.innerHTML = "WASD: Fly & Strafe | Q/C: Ascend/Descend<br/>Space: Shoot | Left Click / F: Spray Link | E: Laser | M: Meeting | B: Block Gun | H: Morph";
    } else if (this.blockGunArmed) {
      hint.innerHTML = "WASD: Fly & Strafe | Q/C: Ascend/Descend<br/>Space: Shoot | Left Click / F: Place Container | B: Laser | E: Link Gun | M: Meeting | H: Morph";
    } else {
      hint.innerHTML = this.idleWeaponHint();
    }
  }

  setupLinkGun() {
    this.hudLinkBtn?.addEventListener("click", () => this.toggleLinkGun());
    document.getElementById("link-close-btn")?.addEventListener("click", () => this.closeLinkGunModal());

    const load = () => {
      const raw = document.getElementById("link-url-input")?.value.trim() || "";
      const url = this.normalizeLinkUrl(raw);
      if (!url) {
        this.addLogItem("🔗 That doesn't look like a link.");
        return;
      }
      this.linkInkUrl = url;
      this.closeLinkGunModal();
      this.setBlockGunArmed(false);
      this.setMeetGunArmed(false);
      this.setLinkGunArmed(true);
      this.addLogItem("🔗 Link gun loaded. Shoot a container to tag it. Tags fade in 60 seconds.");
      this.onToggleLinkGun?.(true);
    };

    document.getElementById("link-load-btn")?.addEventListener("click", load);
    document.getElementById("link-url-input")?.addEventListener("keydown", (e) => {
      if (e.code === "Enter") {
        e.preventDefault();
        load();
      }
    });
  }

  normalizeLinkUrl(raw) {
    let finalUrl = String(raw || "").trim();
    if (!finalUrl) return null;
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      if (finalUrl.includes(".") && !finalUrl.includes(" ")) {
        finalUrl = "https://" + finalUrl;
      } else {
        finalUrl = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(finalUrl)}`;
      }
    }
    try {
      const parsed = new URL(finalUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.toString();
    } catch (_) {
      return null;
    }
  }

  setBlockGunArmed(armed) {
    this.blockGunArmed = armed;
    if (this.hudBuildBtn) {
      this.hudBuildBtn.textContent = armed ? "📦 PLACING BLOCKS [B]" : "📦 BLOCK GUN [B]";
      this.hudBuildBtn.style.background = armed ? "rgba(0, 255, 136, 0.22)" : "";
    }
  }

  setLinkGunArmed(armed) {
    this.linkGunArmed = armed;
    if (this.hudLinkBtn) {
      this.hudLinkBtn.textContent = armed ? "🔗 SPRAYING [E]" : "🔗 LINK GUN [E]";
      this.hudLinkBtn.style.background = armed ? "rgba(255, 43, 214, 0.22)" : "";
    }
    this.refreshWeaponHint();
  }

  toggleLinkGun() {
    if (this.linkGunModal?.style.display === "flex") {
      this.closeLinkGunModal();
      return;
    }
    if (!this.linkInkUrl) {
      this.openLinkGunModal();
      return;
    }
    const armed = !this.linkGunArmed;
    if (armed) this.setBlockGunArmed(false);
    this.setLinkGunArmed(armed);
    this.addLogItem(armed
      ? "🔗 Link gun armed. Shoot a container to tag it."
      : "🔫 Laser armed.");
    this.onToggleLinkGun?.(armed);
  }

  openLinkGunModal() {
    if (!this.linkGunModal) return;
    if (document.pointerLockElement) document.exitPointerLock();
    this.closeMorphModal();
    this.closePlanetModal();
    this.linkGunModal.style.display = "flex";
    const input = document.getElementById("link-url-input");
    if (input) {
      input.value = this.linkInkUrl;
      setTimeout(() => input.focus(), 50);
    }
  }

  setMeetGunArmed(armed) {
    this.meetGunArmed = armed;
    if (this.hudMeetBtn) {
      this.hudMeetBtn.textContent = armed ? "📅 PLACING MEETING [M]" : "📅 MEETING [M]";
      this.hudMeetBtn.style.background = armed ? "rgba(255, 215, 0, 0.22)" : "";
    }
    this.refreshWeaponHint();
  }

  setupMeeting() {
    this.hudMeetBtn?.addEventListener("click", () => this.toggleMeetingGun());
    document.getElementById("meeting-close-btn")?.addEventListener("click", () => this.closeMeetingModal());
    document.getElementById("meeting-load-btn")?.addEventListener("click", () => this.loadMeetingFromForm());
    document.getElementById("meeting-title-input")?.addEventListener("keydown", (e) => {
      if (e.code === "Enter") {
        e.preventDefault();
        this.loadMeetingFromForm();
      }
    });
  }

  loadMeetingFromForm() {
    const title = document.getElementById("meeting-title-input")?.value.trim() || "Meeting";
    const when = document.getElementById("meeting-when-input")?.value;
    const startsAt = when ? new Date(when).getTime() : NaN;
    const now = Date.now();
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(startsAt) || startsAt < now - 60 * 1000) {
      this.addLogItem("📅 Pick a meeting time that hasn't passed.");
      return;
    }
    if (startsAt > now + fiveDays) {
      this.addLogItem("📅 Meetings can only be booked up to 5 days ahead.");
      return;
    }
    this.pendingMeeting = { title: title.slice(0, 40), startsAt };
    this.closeMeetingModal();
    this.setBlockGunArmed(false);
    this.setLinkGunArmed(false);
    this.setMeetGunArmed(true);
    this.addLogItem("📅 Meeting loaded. Shoot a container to book it. It stays until that time.");
    this.onToggleMeetGun?.(true);
  }

  toggleMeetingGun() {
    if (this.meetingModal?.style.display === "flex") {
      this.closeMeetingModal();
      return;
    }
    if (!this.pendingMeeting) {
      this.openMeetingModal();
      return;
    }
    const armed = !this.meetGunArmed;
    if (armed) {
      this.setBlockGunArmed(false);
      this.setLinkGunArmed(false);
    }
    this.setMeetGunArmed(armed);
    this.addLogItem(armed
      ? "📅 Meeting gun armed. Shoot a container to book the spot."
      : "🔫 Laser armed.");
    this.onToggleMeetGun?.(armed);
  }

  openMeetingModal() {
    if (!this.meetingModal) return;
    if (document.pointerLockElement) document.exitPointerLock();
    this.closeMorphModal();
    this.closePlanetModal();
    this.closeLinkGunModal();
    const when = document.getElementById("meeting-when-input");
    if (when) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      when.min = local(now);
      when.max = local(new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000));
      if (!when.value) when.value = local(new Date(now.getTime() + 60 * 60 * 1000));
    }
    this.meetingModal.style.display = "flex";
    setTimeout(() => document.getElementById("meeting-title-input")?.focus(), 50);
  }

  closeMeetingModal() {
    if (!this.meetingModal) return;
    this.meetingModal.style.display = "none";
    if (this.isEntered) document.getElementById("webgl-canvas")?.requestPointerLock();
  }

  closeLinkGunModal() {
    if (!this.linkGunModal) return;
    this.linkGunModal.style.display = "none";
    if (this.isEntered) document.getElementById("webgl-canvas")?.requestPointerLock();
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
