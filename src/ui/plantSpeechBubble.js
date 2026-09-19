/**
 * PlantSpeechBubble (Conversational Plant Assistant)
 * Inspired by Planto reference image — anchors directly to foliage
 * and speaks from the plant's perspective in user-friendly language.
 */
export class PlantSpeechBubble {
  constructor(bubbleEl) {
    this.el = bubbleEl;
    this.textEl = bubbleEl.querySelector('.bubble-text');
    this.avatarEl = bubbleEl.querySelector('.bubble-avatar');
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
    let avatar = '🌱';

    if (profile.id === 'money_plant_wilt' || status === 'stress') {
      avatar = '🥀';
      dialogues = [
        "I'm feeling wilted... Please isolate me so it doesn't spread! ⚠️",
        "My stems feel limp and clogged. Please prune infected vines! ✂️",
        "Avoid splashing water on my leaves — bacteria travels in droplets."
      ];
    } else if (profile.id === 'money_plant_manganese' || status === 'warning') {
      avatar = '🍂';
      dialogues = [
        "My soil feels too acidic! Please flush my pot with clean water. 🧪",
        "I have dark necrotic spots from excess manganese uptake.",
        "Add a pinch of garden lime to help balance my soil pH! 🪴"
      ];
    } else if (health >= 88) {
      avatar = '🌿';
      dialogues = [
        "I'm feeling wonderful! Getting ideal indirect light today. ✨",
        "My leaves are firm, glossy, and actively growing! 🍃",
        "Water me only when my top 1 inch of soil feels dry."
      ];
    } else {
      avatar = '🌱';
      dialogues = [
        "I could use a gentle sip of water soon! 💧",
        "Place me near bright, filtered morning sunlight. ☀️",
        "Wipe my broad leaves gently to keep them dust-free. ✨"
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
      this.textEl.textContent = text;
      this.avatarEl.textContent = avatar;

      // Small bounce pulse
      this.el.classList.remove('pulse-bounce');
      void this.el.offsetWidth; // trigger reflow
      this.el.classList.add('pulse-bounce');
    }
  }

  cycleDialogue() {
    this.lastDialogueChange = 0; // Force immediate update on next frame
  }
}
