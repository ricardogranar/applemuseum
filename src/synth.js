    let hudTimeout = null;
    let reverbImpulseBuffer = null;

    function showChimeHud(text, durationMs = 3100) {
      const hud = document.getElementById("chimeHudToast");
      const label = document.getElementById("chimeHudText");
      if (!hud || !label) return;
      label.textContent = text;
      hud.classList.add("visible");
      if (hudTimeout) clearTimeout(hudTimeout);
      hudTimeout = setTimeout(() => {
        hud.classList.remove("visible");
      }, durationMs);
    }

    /**
     * Genera una respuesta al impulso estéreo sintética para dotar de resonancia real de caja/sala
     * a los acordes ROM de Jim Reekes (1998–2015) y a los woofers de Apple Silicon (2020–2026).
     */
    function getStereoReverbNode(ctx, seconds = 2.6, decay = 2.8) {
      const convolver = ctx.createConvolver();
      if (!reverbImpulseBuffer) {
        const rate = ctx.sampleRate;
        const length = Math.floor(rate * seconds);
        const impulse = ctx.createBuffer(2, length, rate);
        for (let ch = 0; ch < 2; ch++) {
          const channelData = impulse.getChannelData(ch);
          for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
          }
        }
        reverbImpulseBuffer = impulse;
      }
      convolver.buffer = reverbImpulseBuffer;
      return convolver;
    }

    /**
     * Crea un impulso corto de ruido filtrado para recrear clics mecánicos, cabezales de disquete Disk II / Sony 400K
     */
    function triggerMechanicalClick(ctx, startTime, freqCenter = 1400, duration = 0.018, volume = 0.22) {
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freqCenter, startTime);
      filter.Q.setValueAtTime(3.2, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(startTime);
      noise.stop(startTime + duration);
    }

    /**
     * SINTETIZADOR HISTÓRICO DE PRECISIÓN PARA LOS SONIDOS DE ARRANQUE DE APPLE (1976–2026)
     */
    function synthChime(chime) {
      const item = { chime };
      const now = audioCtx.currentTime;

      switch (item.chime) {
        case "apple1_1976": {
          // 1976 Apple I: Sin altavoz en placa. Chasquido del interruptor + zumbido de 60 Hz del transformador + carga de ánodo CRT
          triggerMechanicalClick(audioCtx, now, 1800, 0.022, 0.35);
          triggerMechanicalClick(audioCtx, now + 0.025, 950, 0.015, 0.25);

          const hum = audioCtx.createOscillator();
          const humGain = audioCtx.createGain();
          hum.type = "sawtooth";
          hum.frequency.setValueAtTime(60, now + 0.03);
          const lowpass = audioCtx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.setValueAtTime(190, now + 0.03);
          humGain.gain.setValueAtTime(0.001, now + 0.03);
          humGain.gain.linearRampToValueAtTime(0.09, now + 0.12);
          humGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
          hum.connect(lowpass).connect(humGain).connect(audioCtx.destination);
          hum.start(now + 0.03);
          hum.stop(now + 1.18);
          break;
        }

        case "apple2_1977": {
          // 1977 Apple II: Rutina ROM BELL1 ($FF58) -> Onda cuadrada exacta de 1000 Hz durante 0.1s + repiqueteo Disk II buscando Pista 0
          const osc = audioCtx.createOscillator();
          const spkFilter = audioCtx.createBiquadFilter();
          const gain = audioCtx.createGain();

          osc.type = "square";
          osc.frequency.setValueAtTime(1000, now);

          // Filtro de cono de papel de 2 pulgadas del Apple II
          spkFilter.type = "bandpass";
          spkFilter.frequency.setValueAtTime(1250, now);
          spkFilter.Q.setValueAtTime(1.4, now);

          gain.gain.setValueAtTime(0.22, now);
          gain.gain.setValueAtTime(0.22, now + 0.095);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);

          osc.connect(spkFilter).connect(gain).connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.12);

          // Repiqueteo característico del motor paso a paso de la disquetera Disk II (Track 0 recalibration chatter)
          for (let step = 0; step < 9; step++) {
            const t = now + 0.17 + step * 0.028;
            triggerMechanicalClick(audioCtx, t, 1150 + (step % 2) * 240, 0.016, 0.24);
          }
          break;
        }

        case "lisa_1983": {
          // 1983 Apple Lisa: Doble pulso piezoeléctrico de autodiagnóstico ROM + giro de unidades Twiggy
          const notes = [
            { f: 1680, t: now, d: 0.075 },
            { f: 1120, t: now + 0.095, d: 0.14 }
          ];
          notes.forEach(n => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(n.f, n.t);
            gain.gain.setValueAtTime(0.14, n.t);
            gain.gain.exponentialRampToValueAtTime(0.001, n.t + n.d);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(n.t);
            osc.stop(n.t + n.d + 0.01);
          });
          triggerMechanicalClick(audioCtx, now + 0.28, 820, 0.04, 0.18);
          break;
        }

        case "mac128k_1984": {
          // 1984 Macintosh 128K / 1986 Macintosh Plus: Generador PWM de 8 bits a 22,25 kHz (~680 Hz con timbre metálico suave) + Sony 400K step
          const freqs = [680, 1360, 2040];
          const amps = [0.22, 0.065, 0.035];
          freqs.forEach((f, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = idx === 0 ? "triangle" : "square";
            osc.frequency.setValueAtTime(f, now);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(amps[idx], now + 0.008);
            gain.gain.setValueAtTime(amps[idx] * 0.85, now + 0.16);
            gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.29);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.30);
          });
          // Cabezal del disquete Sony de 3,5"
          triggerMechanicalClick(audioCtx, now + 0.34, 1300, 0.02, 0.16);
          triggerMechanicalClick(audioCtx, now + 0.42, 1050, 0.025, 0.14);
          break;
        }

        case "macse30_1989":
        case "pb100_1991": {
          // 1989 Macintosh SE/30 & 1991 PowerBook 100: Apple Sound Chip (ASC) 4-voice wavetable triad arpeggio/chord (Do Mayor: C4, E4, G4, C5)
          const isPortable = item.chime === "pb100_1991";
          const ascNotes = [261.63, 329.63, 392.00, 523.25];
          const masterFilter = audioCtx.createBiquadFilter();
          masterFilter.type = isPortable ? "bandpass" : "lowpass";
          masterFilter.frequency.setValueAtTime(isPortable ? 1850 : 3400, now);
          masterFilter.Q.setValueAtTime(isPortable ? 1.2 : 0.7, now);
          masterFilter.connect(audioCtx.destination);

          ascNotes.forEach((freq, i) => {
            const startOffset = now + i * 0.012; // Ligero escalonado de las 4 voces del ASC
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const voiceGain = audioCtx.createGain();

            osc1.type = "sawtooth";
            osc2.type = "triangle";
            osc1.frequency.setValueAtTime(freq, startOffset);
            osc2.frequency.setValueAtTime(freq * 2, startOffset);

            voiceGain.gain.setValueAtTime(0.001, startOffset);
            voiceGain.gain.linearRampToValueAtTime(0.075, startOffset + 0.015);
            voiceGain.gain.exponentialRampToValueAtTime(0.0008, startOffset + (isPortable ? 0.78 : 1.05));

            osc1.connect(voiceGain);
            osc2.connect(voiceGain);
            voiceGain.connect(masterFilter);

            osc1.start(startOffset);
            osc2.start(startOffset);
            osc1.stop(startOffset + 1.1);
            osc2.stop(startOffset + 1.1);
          });
          break;
        }

        case "tam_1997": {
          // 1997 Twentieth Anniversary Mac (PCI PowerPC ROM + Subwoofer Bose 2.1): Acorde cálido tipo guitarra/sintetizador FM en Sol Mayor/Mi♭
          const tamChord = [98.00, 146.83, 196.00, 246.94, 293.66, 392.00, 587.33];
          const reverb = getStereoReverbNode(audioCtx, 2.2, 2.6);
          const wetGain = audioCtx.createGain();
          wetGain.gain.setValueAtTime(0.32, now);
          reverb.connect(wetGain).connect(audioCtx.destination);

          tamChord.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();

            osc.type = idx < 2 ? "triangle" : "sawtooth";
            osc.frequency.setValueAtTime(freq, now);
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(2400, now);
            filter.frequency.exponentialRampToValueAtTime(650, now + 1.8);

            const peak = idx === 0 ? 0.14 : 0.055;
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(peak, now + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0006, now + 2.1);

            osc.connect(filter).connect(gain);
            gain.connect(audioCtx.destination);
            gain.connect(reverb);

            osc.start(now);
            osc.stop(now + 2.15);
          });
          break;
        }

        case "new_world_fsharp":
        case "intel_unibody_chime": {
          // 1998–2013 Jim Reekes' Iconic New World ROM Startup Chime: Acorde F# Mayor (F#2, C#3, F#3, A#3, C#4, F#4, A#4, C#5, F#5)
          // Combina ataque de martillo de piano con pad coral desafinado (±2 cents) y reverberación estéreo
          const isIntel = item.chime === "intel_unibody_chime";
          const fSharpNotes = [
            { f: 92.50,  amp: 0.13 }, // F#2
            { f: 138.59, amp: 0.10 }, // C#3
            { f: 185.00, amp: 0.11 }, // F#3
            { f: 233.08, amp: 0.075 }, // A#3
            { f: 277.18, amp: 0.085 }, // C#4
            { f: 369.99, amp: 0.09 }, // F#4
            { f: 466.16, amp: 0.06 }, // A#4
            { f: 554.37, amp: 0.055 }, // C#5
            { f: 739.99, amp: 0.045 }  // F#5
          ];

          const reverb = getStereoReverbNode(audioCtx, 2.8, 2.5);
          const reverbGain = audioCtx.createGain();
          reverbGain.gain.setValueAtTime(isIntel ? 0.36 : 0.44, now);
          reverb.connect(reverbGain).connect(audioCtx.destination);

          const masterFilter = audioCtx.createBiquadFilter();
          masterFilter.type = "lowpass";
          masterFilter.frequency.setValueAtTime(isIntel ? 4800 : 3800, now);
          masterFilter.frequency.exponentialRampToValueAtTime(1150, now + 2.5);
          masterFilter.connect(audioCtx.destination);
          masterFilter.connect(reverb);

          fSharpNotes.forEach(note => {
            // 2 osciladores ligeramente desafinados por nota para recrear la riqueza coral del sample ROM de Jim Reekes
            [-1.8, 1.8].forEach((detuneCents, pairIdx) => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();

              osc.type = pairIdx === 0 ? "sawtooth" : "triangle";
              osc.frequency.setValueAtTime(note.f, now);
              osc.detune.setValueAtTime(detuneCents, now);

              const v = note.amp * (pairIdx === 0 ? 0.48 : 0.65);
              gain.gain.setValueAtTime(0.0005, now);
              // Ataque rápido de piano (35 ms) seguido de sustain cálido de órgano/cuerdas
              gain.gain.linearRampToValueAtTime(v, now + 0.038);
              gain.gain.exponentialRampToValueAtTime(v * 0.42, now + 0.45);
              gain.gain.exponentialRampToValueAtTime(0.0004, now + 2.75);

              osc.connect(gain).connect(masterFilter);
              osc.start(now);
              osc.stop(now + 2.8);
            });
          });
          break;
        }

        case "apple_silicon_spatial":
        default: {
          // 2019–2026 Apple Silicon Spatial Boot Chime (M1 a M5 Max / PROLED Touch):
          // Acorde F# Mayor remasterizado con fundamental subgrave (F#1 = 46.25 Hz) para woofers Force-Cancelling y cola envolvente
          const siliconNotes = [
            { f: 46.25,  amp: 0.16, type: "sine" },     // Subgrave F#1 (Force-Cancelling Woofers)
            { f: 92.50,  amp: 0.14, type: "triangle" }, // F#2
            { f: 138.59, amp: 0.10, type: "triangle" }, // C#3
            { f: 185.00, amp: 0.11, type: "sawtooth" }, // F#3
            { f: 233.08, amp: 0.08, type: "sawtooth" }, // A#3
            { f: 277.18, amp: 0.08, type: "triangle" }, // C#4
            { f: 369.99, amp: 0.085, type: "sine" },    // F#4
            { f: 466.16, amp: 0.055, type: "sine" },    // A#4
            { f: 554.37, amp: 0.05, type: "sine" },     // C#5
            { f: 739.99, amp: 0.04, type: "sine" }      // F#5
          ];

          const reverb = getStereoReverbNode(audioCtx, 3.1, 2.2);
          const wetGain = audioCtx.createGain();
          wetGain.gain.setValueAtTime(0.48, now);
          reverb.connect(wetGain).connect(audioCtx.destination);

          const lpFilter = audioCtx.createBiquadFilter();
          lpFilter.type = "lowpass";
          lpFilter.frequency.setValueAtTime(4200, now);
          lpFilter.frequency.exponentialRampToValueAtTime(980, now + 2.9);
          lpFilter.connect(audioCtx.destination);
          lpFilter.connect(reverb);

          siliconNotes.forEach(n => {
            [-2.2, 2.2].forEach(detune => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = n.type;
              osc.frequency.setValueAtTime(n.f, now);
              osc.detune.setValueAtTime(detune, now);

              const peak = n.amp * 0.55;
              gain.gain.setValueAtTime(0.0005, now);
              gain.gain.linearRampToValueAtTime(peak, now + 0.055);
              gain.gain.exponentialRampToValueAtTime(peak * 0.48, now + 0.65);
              gain.gain.exponentialRampToValueAtTime(0.0003, now + 3.15);

              osc.connect(gain).connect(lpFilter);
              osc.start(now);
              osc.stop(now + 3.2);
            });
          });
          break;
        }
      }
    }

