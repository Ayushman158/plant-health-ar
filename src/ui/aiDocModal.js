/**
 * AiDocModal — Interactive Plant Doctor Consultation
 * Powered by Gemma prompt reasoning & Money Plant pathological intelligence.
 */
export class AiDocModal {
  constructor(modalEl, topTriggerBtn, bottomTriggerBtn) {
    this.modal = modalEl;
    this.closeBtn = modalEl.querySelector('#close-ai-doc-btn');
    this.messagesContainer = modalEl.querySelector('#ai-chat-messages');
    this.form = modalEl.querySelector('#ai-chat-form');
    this.input = modalEl.querySelector('#ai-user-input');
    this.quickPromptsContainer = modalEl.querySelector('#ai-quick-prompts');

    this.topBtn = topTriggerBtn;
    this.bottomBtn = bottomTriggerBtn;
    this.currentPlant = null;

    this.initEvents();
  }

  setPlant(plantProfile) {
    this.currentPlant = plantProfile;
  }

  initEvents() {
    if (this.topBtn) {
      this.topBtn.addEventListener('click', () => this.open());
    }
    if (this.bottomBtn) {
      this.bottomBtn.addEventListener('click', () => this.open());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.input.value.trim();
        if (text) {
          this.handleUserQuery(text);
          this.input.value = '';
        }
      });
    }

    if (this.quickPromptsContainer) {
      this.quickPromptsContainer.querySelectorAll('.quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const query = chip.dataset.query;
          if (query) {
            this.handleUserQuery(query);
          }
        });
      });
    }
  }

  open() {
    if (this.modal) {
      this.modal.classList.remove('hidden');
      if (this.input) this.input.focus();
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }

  appendMessage(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender === 'user' ? 'user-msg' : 'doc-msg'}`;

    const avatar = sender === 'user' ? '👤' : '🩺';
    bubble.innerHTML = `
      <div class="doc-avatar">${avatar}</div>
      <div class="bubble-body">
        <p>${text}</p>
      </div>
    `;

    this.messagesContainer.appendChild(bubble);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  async handleUserQuery(query) {
    this.appendMessage('user', query);

    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'chat-bubble doc-msg typing-msg';
    typingIndicator.innerHTML = `
      <div class="doc-avatar">🩺</div>
      <div class="bubble-body">
        <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>
    `;
    this.messagesContainer.appendChild(typingIndicator);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

    // Simulate AI synthesis with Gemma clinical reasoning
    const response = await this.generateDoctorResponse(query);

    typingIndicator.remove();
    this.appendMessage('doc', response);
  }

  async generateDoctorResponse(query) {
    // Artificial small delay for natural conversation
    await new Promise(r => setTimeout(r, 650));

    const q = query.toLowerCase();
    const plantName = this.currentPlant?.name || 'Money Plant';
    const condition = this.currentPlant?.id || 'money_plant';

    if (q.includes('wilt') || q.includes('bacterial') || condition === 'money_plant_wilt' && q.includes('cure')) {
      return `For <strong>Bacterial Wilt</strong> in Money Plants, act fast:
      <br><br>
      1. <strong>Immediate Quarantine:</strong> Isolate the plant from other flora to avoid transmission via air or tools.
      <br>
      2. <strong>Pruning:</strong> Cut all wilted or soft brown stems with shears sterilized in 70% alcohol.
      <br>
      3. <strong>Watering Protocol:</strong> Stop misting foliage. Keep leaves completely dry as bacteria thrives in droplets.
      <br>
      4. <strong>Fresh Soil:</strong> Repot into a well-draining, sterile aroid mix with perlite and pine bark.`;
    }

    if (q.includes('yellow') || q.includes('chlorosis')) {
      return `Yellowing leaves (chlorosis) in Money Plants typically point to three common causes:
      <br><br>
      • <strong>Overwatering:</strong> The most common cause. Allow the top 1-2 inches of soil to dry out before watering again.
      <br>
      • <strong>Inadequate Drainage:</strong> Ensure the container has drainage holes so water never sits at the roots.
      <br>
      • <strong>Natural Aging:</strong> Older lower leaves naturally turn golden-yellow and shed as the vine grows forward.`;
    }

    if (q.includes('water') || q.includes('how often')) {
      return `Money Plants (<em>Epipremnum aureum</em>) thrive when watered <strong>once every 7 to 10 days</strong>.
      <br><br>
      The golden rule: insert your index finger into the soil. If the top 1 inch feels dry and crumbly, give it a thorough soak until water drains from the bottom. In winter, reduce watering frequency.`;
    }

    if (q.includes('manganese') || q.includes('ph') || q.includes('toxicity') || condition === 'money_plant_manganese') {
      return `<strong>Manganese Toxicity</strong> happens when potting soil becomes excessively acidic (pH < 5.2), causing the plant to hyper-absorb manganese:
      <br><br>
      • <strong>Symptoms:</strong> Interveinal brown/black speckled lesions and curled leaf edges.
      <br>
      • <strong>Remedy:</strong> Flush the pot thoroughly with filtered room-temperature water to leach out excess minerals.
      <br>
      • <strong>pH Balance:</strong> Add a pinch of dolomitic lime to bring soil back to the ideal pH range of <strong>6.0 – 6.5</strong>.`;
    }

    if (q.includes('sunlight') || q.includes('light')) {
      return `Money Plants love <strong>bright, indirect sunlight</strong>.
      <br><br>
      Place your plant near an east-facing window or a few feet away from a south/west window. Avoid intense direct mid-day sun, which can scorch the cuticle. Under gentle bright light, golden variegation will be vivid and rich!`;
    }

    // Default expert response
    return `Based on your ${plantName} bio-scan:
    <br><br>
    The foliage is currently showing <strong>${this.currentPlant?.vigor || 93}% vigor</strong>. Keep room temperature between 18°C–28°C, provide bright filtered light, and let the soil breathe between waterings. If you spot any drooping or unusual spots, run another quick scan!`;
  }
}
