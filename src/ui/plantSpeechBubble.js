/**
 * PlantSpeechBubble (Conversational Botanical Guide)
 * Anchors directly to detected leaf foliage and delivers clinical/care guidance.
 */
export class PlantSpeechBubble {
  constructor(bubbleEl) {
    this.el = bubbleEl;
    this.textEl = bubbleEl.querySelector('.bubble-text');
    this.avatarEl = bubbleEl.querySelector('.bubble-avatar-icon');
    this.currentText = '';
    this.currentStatus = 'optimal';

    this.dialogueIndex = 0;
    this.lastDialogueChange = 0;

    this.initClick();
  }

  initClick() {
    this.el.addEventListener('click', () => {
      this.cycleDialogue();
    });
  }

  update(profile, analysis) {
    if (!profile) return;

    const detected = analysis && analysis.detected;
    if (!detected) {
      this.el.classList.add('hidden');
      return;
    }

    this.el.classList.remove('hidden');

    // Anchor bubble near top-center of detected leaf box
    const b = analysis.box || { x: 0.3, y: 0.2, width: 0.4, height: 0.5 };
    const targetX = (b.x + b.width * 0.5) * 100;
    const targetY = Math.max(12, (b.y - 0.05) * 100);

    this.el.style.left = `${targetX}%`;
    this.el.style.top = `${targetY}%`;

    // Determine dialogue based on pathology & plant profile
    const status = profile.status || 'optimal';
    const health = analysis.pathology?.healthScore || profile.vigor || 90;

    let dialogues = [];
    let avatarSvg = '';

    if (profile.id === 'money_plant_wilt' || status === 'stress') {
      avatarSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fca5a5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
      dialogues = [
        "Vascular wilt detected. Isolate specimen to prevent microbial spread.",
        "Stem conduits are clogged. Prune limp vines using sterilized shears.",
        "Avoid overhead water contact. Bacterial pathogens travel via droplets."
      ];
    } else if (profile.id === 'money_plant_manganese' || status === 'warning') {
      avatarSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fed7aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      dialogues = [
        "Substrate acidity is excessive. Flush root ball with distilled water.",
        "Dark necrotic spots observed from hyper-soluble manganese uptake.",
        "Apply dolomitic lime to buffer potting soil pH toward 6.2."
      ];
    } else if (health >= 88) {
      avatarSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#86efac" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>`;
      dialogues = [
        "Foliage is thriving. Ideal PAR solar absorption and transpiration.",
        "Cellular turgor is robust. Leaves show clean variegation.",
        "Maintain current cadence: hydrate only when top inch of soil dries."
      ];
    } else {
      avatarSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#86efac" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`;
      dialogues = [
        "Substrate hydration is slightly dry. Moderate irrigation recommended.",
        "Position foliage in filtered indirect morning sunlight.",
        "Clean cuticle surface gently to optimize photosynthetic efficiency."
      ];
    }

    // Auto-cycle dialogue every 8 seconds
    const now = Date.now();
    if (now - this.lastDialogueChange > 8000) {
      this.dialogueIndex = (this.dialogueIndex + 1) % dialogues.length;
      this.lastDialogueChange = now;
    }

    const text = dialogues[this.dialogueIndex % dialogues.length];
    if (this.currentText !== text) {
      this.currentText = text;
      if (this.textEl) this.textEl.textContent = text;
      if (this.avatarEl) this.avatarEl.innerHTML = avatarSvg;

      // Exponential ease settle
      this.el.classList.remove('pulse-settle');
      void this.el.offsetWidth; // trigger reflow
      this.el.classList.add('pulse-settle');
    }
  }

  cycleDialogue() {
    this.lastDialogueChange = 0; // Force immediate update on next frame
  }
}
