import * as THREE from "three";

/**
 * AudioSystem manages WebRTC peer-to-peer spatial proximity voice chat,
 * Three.js PositionalAudio attachments to remote player avatars,
 * and high-fidelity procedural audio synthesis (pew, hit, whoosh, ambient drone).
 */
export class AudioSystem {
  constructor(camera) {
    this.camera = camera;
    this.listener = null;
    this.audioContext = null;
    this.localStream = null;
    this.isMicMuted = false;
    this.hasMicPermission = false;

    // WebRTC connections: targetSessionId -> { pc, stream, positionalAudio, audioEl, inProximity }
    this.peers = new Map();

    this.PROXIMITY_RADIUS = 50.0;
    this.PROXIMITY_RADIUS_SQ = this.PROXIMITY_RADIUS * this.PROXIMITY_RADIUS;

    this.networkSystem = null;
    this.playerSystem = null;

    // Ambient drone node references
    this.ambientNodes = null;

    // WebRTC ICE servers configuration
    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };
  }

  async init(networkSystem, playerSystem) {
    this.networkSystem = networkSystem;
    this.playerSystem = playerSystem;

    // 1. Setup Three.js AudioListener
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.audioContext = this.listener.context;

    // 2. Request user microphone
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.hasMicPermission = true;
      console.log("[AudioSystem] Microphone stream acquired successfully");
    } catch (err) {
      console.warn("[AudioSystem] Mic access denied or not available. Joining as listener:", err);
      this.hasMicPermission = false;
    }

    // 3. Ensure AudioContext is active
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // 4. Start ambient space drone
    this.startAmbientDrone();

    // 5. Setup keyboard shortcuts (M to mute/unmute)
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyM") {
        this.toggleMute();
      }
    });

    return {
      hasMic: this.hasMicPermission,
      isMuted: this.isMicMuted,
    };
  }

  toggleMute() {
    if (!this.localStream) return;
    this.isMicMuted = !this.isMicMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMicMuted;
    });

    const statusEl = document.getElementById("voice-status-text");
    const iconEl = document.getElementById("voice-icon");
    if (statusEl && iconEl) {
      if (this.isMicMuted) {
        statusEl.innerText = "Mic: Muted";
        statusEl.style.color = "#ff5500";
        iconEl.innerText = "🔇";
      } else {
        statusEl.innerText = `Mic: Active (${this.getActiveVoiceCount()} peers)`;
        statusEl.style.color = "var(--neon-green)";
        iconEl.innerText = "🎙️";
      }
    }
  }

  getActiveVoiceCount() {
    let count = 0;
    this.peers.forEach((p) => {
      if (p.inProximity && p.stream) count++;
    });
    return count;
  }

  /**
   * Evaluates proximity between local player and all remote players.
   * Connects WebRTC when entering PROXIMITY_RADIUS (50u), closes when leaving.
   */
  updateProximity() {
    if (!this.playerSystem || !this.playerSystem.position) return;
    const localPos = this.playerSystem.position;

    this.playerSystem.remotePlayers.forEach((remote, sessionId) => {
      const distSq = localPos.distanceToSquared(remote.mesh.position);
      const isNear = distSq <= this.PROXIMITY_RADIUS_SQ;

      let peerData = this.peers.get(sessionId);

      if (isNear && (!peerData || !peerData.inProximity)) {
        // Entered proximity radius: initiate or accept peer connection
        this.connectPeer(sessionId, remote.mesh);
      } else if (!isNear && peerData && peerData.inProximity) {
        // Exited proximity radius: disconnect WebRTC
        this.disconnectPeer(sessionId);
      }
    });

    // Update HUD voice status
    const statusEl = document.getElementById("voice-status-text");
    if (statusEl && !this.isMicMuted && this.hasMicPermission) {
      const activeCount = this.getActiveVoiceCount();
      statusEl.innerText = `Mic: Active (${activeCount} near)`;
      statusEl.style.color = activeCount > 0 ? "var(--neon-green)" : "var(--neon-cyan)";
    }
  }

  async connectPeer(targetSessionId, remoteMesh) {
    if (this.peers.has(targetSessionId) && this.peers.get(targetSessionId).inProximity) {
      return;
    }

    console.log(`[AudioSystem] Entering proximity with ${targetSessionId}, initiating WebRTC...`);

    const pc = new RTCPeerConnection(this.rtcConfig);

    // Create 3D PositionalAudio container
    const positionalAudio = new THREE.PositionalAudio(this.listener);
    positionalAudio.setRefDistance(6);
    positionalAudio.setMaxDistance(this.PROXIMITY_RADIUS);
    positionalAudio.setRolloffFactor(1.6);
    positionalAudio.setDistanceModel("inverse");
    remoteMesh.add(positionalAudio);

    // Dummy audio element to ensure audio track decoding in Chromium
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.muted = true; // muted to prevent duplicate non-spatial audio

    const peerData = {
      pc,
      remoteMesh,
      positionalAudio,
      audioEl,
      stream: null,
      inProximity: true,
    };
    this.peers.set(targetSessionId, peerData);

    // Add local mic track if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle remote track
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      peerData.stream = remoteStream;
      peerData.audioEl.srcObject = remoteStream;

      try {
        peerData.positionalAudio.setMediaStreamSource(remoteStream);
        console.log(`[AudioSystem] Attached spatial voice stream for ${targetSessionId}`);
      } catch (e) {
        console.warn("[AudioSystem] Failed setting spatial media stream:", e);
      }
    };

    // ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.networkSystem) {
        this.networkSystem.sendSignal(targetSessionId, { candidate: event.candidate });
      }
    };

    // Polite-peer negotiation pattern: deterministic initiator
    const isInitiator = (this.networkSystem.sessionId || "") > targetSessionId;
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.networkSystem.sendSignal(targetSessionId, { sdp: pc.localDescription });
      } catch (err) {
        console.error("[AudioSystem] Error creating WebRTC offer:", err);
      }
    }
  }

  async handleSignal(fromSessionId, signal) {
    let peerData = this.peers.get(fromSessionId);

    // If signal arrived before proximity check triggered locally, create peer container
    if (!peerData) {
      const remote = this.playerSystem?.remotePlayers.get(fromSessionId);
      if (!remote) return;

      const pc = new RTCPeerConnection(this.rtcConfig);
      const positionalAudio = new THREE.PositionalAudio(this.listener);
      positionalAudio.setRefDistance(6);
      positionalAudio.setMaxDistance(this.PROXIMITY_RADIUS);
      positionalAudio.setRolloffFactor(1.6);
      positionalAudio.setDistanceModel("inverse");
      remote.mesh.add(positionalAudio);

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.muted = true;

      peerData = {
        pc,
        remoteMesh: remote.mesh,
        positionalAudio,
        audioEl,
        stream: null,
        inProximity: true,
      };
      this.peers.set(fromSessionId, peerData);

      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
      }

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        peerData.stream = remoteStream;
        peerData.audioEl.srcObject = remoteStream;
        try {
          peerData.positionalAudio.setMediaStreamSource(remoteStream);
        } catch (e) {}
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && this.networkSystem) {
          this.networkSystem.sendSignal(fromSessionId, { candidate: event.candidate });
        }
      };
    }

    const { pc } = peerData;

    try {
      if (signal.sdp) {
        if (signal.sdp.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.networkSystem.sendSignal(fromSessionId, { sdp: pc.localDescription });
        } else if (signal.sdp.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn("[AudioSystem] Error handling signal:", err);
    }
  }

  disconnectPeer(targetSessionId) {
    const peerData = this.peers.get(targetSessionId);
    if (!peerData) return;

    console.log(`[AudioSystem] Disconnecting proximity audio with ${targetSessionId}`);
    try {
      if (peerData.pc) peerData.pc.close();
      if (peerData.remoteMesh && peerData.positionalAudio) {
        peerData.remoteMesh.remove(peerData.positionalAudio);
      }
      if (peerData.audioEl) {
        peerData.audioEl.srcObject = null;
        peerData.audioEl.remove();
      }
    } catch (err) {
      console.warn("[AudioSystem] Error cleaning up peer:", err);
    }
    this.peers.delete(targetSessionId);
  }

  // ==========================================
  // PROCEDURAL AUDIO SYNTHESIZERS (SFX)
  // ==========================================

  playPewSound() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playHitSound() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    // 1. Noise impact burst
    const bufferSize = this.audioContext.sampleRate * 0.2;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18));
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.2);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    // 2. Sub thump
    const subOsc = this.audioContext.createOscillator();
    const subGain = this.audioContext.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
    subGain.gain.setValueAtTime(0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    subOsc.connect(subGain);
    subGain.connect(this.audioContext.destination);

    noise.start(now);
    subOsc.start(now);
    noise.stop(now + 0.22);
    subOsc.stop(now + 0.24);
  }

  playWhooshSound() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const duration = 1.4;

    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 4.0;
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.6);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.7, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  startAmbientDrone() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    // Sub-bass drone: dual oscillators creating 3Hz beating
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const masterDroneGain = this.audioContext.createGain();

    osc1.type = "sine";
    osc1.frequency.value = 55; // A1
    osc2.type = "sine";
    osc2.frequency.value = 58; // 3Hz beating

    masterDroneGain.gain.setValueAtTime(0.0, now);
    masterDroneGain.gain.linearRampToValueAtTime(0.12, now + 3.0);

    osc1.connect(masterDroneGain);
    osc2.connect(masterDroneGain);
    masterDroneGain.connect(this.audioContext.destination);

    osc1.start(now);
    osc2.start(now);

    this.ambientNodes = { osc1, osc2, masterDroneGain };
  }

  /**
   * Scifi radio chirp / comms tone before synthetic voice
   */
  playRadioChirp() {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.setValueAtTime(2200, now + 0.03);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Scifi robotic vocoder synthesizer using Web Audio API.
   * Guaranteed to produce audible scifi voice comms even if browser TTS is blocked by Brave shields or Linux drivers.
   */
  playRoboVoice(text, volume = 0.5) {
    if (!this.audioContext) return;
    const words = text.split(" ").slice(0, 10);
    const now = this.audioContext.currentTime;

    words.forEach((word, idx) => {
      const startTime = now + idx * 0.14;
      const duration = 0.11;

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      // Formant frequency based on word characters
      const hash = word.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const baseFreq = 220 + (hash % 280);

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(baseFreq, startTime);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.25, startTime + duration);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(baseFreq * 2.2, startTime);
      filter.Q.value = 5.0;

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Speaks text with 3D spatial proximity volume attenuation.
   * Uses browser SpeechSynthesis with automatic Web Audio vocoder backup.
   */
  speakSpatial(text, sourcePosition, options = {}) {
    // 1. Calculate distance-based volume
    let volume = 0.85;
    if (sourcePosition && this.playerSystem?.position) {
      const dist = this.playerSystem.position.distanceTo(sourcePosition);
      // Soft attenuation up to 100 units
      volume = Math.max(0.12, Math.min(1.0, 1.0 - (dist / 100.0)));
    }

    // 2. Play scifi radio comms chirp
    this.playRadioChirp();

    // 3. Attempt browser SpeechSynthesis
    let ttsWorked = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel(); // Clear any stalled queue

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = volume;
        utterance.rate = options.rate || 1.05;
        utterance.pitch = options.pitch || 1.1;
        utterance.lang = "en-US";

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const enVoice = voices.find(v => v.lang.startsWith("en")) || voices[0];
          if (enVoice) utterance.voice = enVoice;
        }

        utterance.onstart = () => {
          ttsWorked = true;
        };

        utterance.onerror = (e) => {
          console.warn("[AudioSystem] Speech error, using vocoder:", e);
          this.playRoboVoice(text, volume);
        };

        window.speechSynthesis.speak(utterance);

        // Fallback check: if browser doesn't start speaking in 350ms, play vocoder
        setTimeout(() => {
          if (!ttsWorked && window.speechSynthesis.speaking === false) {
            this.playRoboVoice(text, volume);
          }
        }, 350);

        return;
      } catch (err) {
        console.warn("[AudioSystem] Speech synthesis failed:", err);
      }
    }

    // Fallback if SpeechSynthesis is unavailable
    this.playRoboVoice(text, volume);
  }
}

