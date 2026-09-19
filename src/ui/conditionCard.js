/**
 * ConditionCard (Planto Minimalist Telemetry & Prescription Sheet)
 * Inspired by Planto reference image — clean, elevated, rounded frosted card
 * with high-legibility metrics and tap-to-expand clinical prescription.
 */
export class ConditionCard {
  constructor(cardAnchorEl, prescriptionModalEl) {
    this.anchor = cardAnchorEl;
    this.modal = prescriptionModalEl;

    this.valWater = cardAnchorEl.querySelector('#val-water');
    this.valLight = cardAnchorEl.querySelector('#val-light');
    this.valVigor = cardAnchorEl.querySelector('#val-vigor');
    this.valTemp = cardAnchorEl.querySelector('#val-temp');
    this.statusSub = cardAnchorEl.querySelector('#card-status-sub');
    this.expandBtn = cardAnchorEl.querySelector('#expand-prescription-btn');

    this.rxScore = document.getElementById('rx-score');
    this.rxName = document.getElementById('rx-name');
    this.rxStatusTag = document.getElementById('rx-status-tag');
    this.rxDesc = document.getElementById('rx-description');
    this.rxCareList = document.getElementById('rx-care-list');
    this.closeRxBtn = document.getElementById('close-prescription-btn');

    this.currentProfile = null;
    this.initEvents();
  }

  initEvents() {
    if (this.expandBtn) {
      this.expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPrescription();
      });
    }

    if (this.closeRxBtn) {
      this.closeRxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePrescription();
      });
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closePrescription();
        }
      });
    }
  }

  setProfile(profile) {
    this.currentProfile = profile;
    this.updateCardValues();
  }

  updateLiveTelemetry(analysis) {
    if (!analysis || !this.currentProfile) return;

    if (analysis.light && this.valLight) {
      this.valLight.textContent = `${analysis.light.lux} lx`;
    }

    if (analysis.pathology && this.valVigor) {
      this.valVigor.textContent = `${analysis.pathology.healthScore}%`;
    }
  }

  updateCardValues() {
    const p = this.currentProfile;
    if (!p) return;

    if (this.statusSub) {
      this.statusSub.textContent = p.statusLabel || 'Healthy';
      this.statusSub.style.color = p.colorScheme?.primary || '#86efac';
    }

    if (this.valWater && p.metrics?.hydration) {
      this.valWater.textContent = `${p.metrics.hydration.value}%`;
    }

    if (this.valLight && p.metrics?.solarPAR) {
      this.valLight.textContent = `${p.metrics.solarPAR.value}%`;
    }

    if (this.valVigor) {
      this.valVigor.textContent = `${p.vigor}%`;
    }

    if (this.valTemp) {
      // Comfort range representation
      this.valTemp.textContent = '22°C';
    }
  }

  openPrescription() {
    const p = this.currentProfile;
    if (!p || !this.modal) return;

    if (this.rxScore) {
      this.rxScore.textContent = `${p.vigor}%`;
      this.rxScore.style.borderColor = p.colorScheme?.primary || '#86efac';
      this.rxScore.style.color = p.colorScheme?.primary || '#86efac';
    }

    if (this.rxName) {
      this.rxName.textContent = p.name;
    }

    if (this.rxStatusTag) {
      this.rxStatusTag.textContent = p.statusLabel;
      this.rxStatusTag.style.background = p.colorScheme?.surface || 'rgba(134, 239, 172, 0.15)';
      this.rxStatusTag.style.color = p.colorScheme?.primary || '#86efac';
    }

    if (this.rxDesc) {
      if (p.id === 'money_plant_wilt') {
        this.rxDesc.textContent = 'Bacterial Wilt infection detected. Vascular tissue is compromised, causing rapid drooping and loss of turgor pressure.';
      } else if (p.id === 'money_plant_manganese') {
        this.rxDesc.textContent = 'Abiotic Manganese mineral toxicity observed. Characterized by interveinal dark necrotic spots and chlorotic halo edges from acidic potting soil.';
      } else {
        this.rxDesc.textContent = 'Turgid, vibrant leaf tissue with active chlorophyll absorption. Plant is well-nourished and maintaining healthy cellular vigor.';
      }
    }

    if (this.rxCareList) {
      const tips = p.careTips || [];
      this.rxCareList.innerHTML = tips.map(t => `
        <div class="rx-care-item">
          <div class="rx-care-icon">${t.icon}</div>
          <div class="rx-care-info">
            <h4 class="rx-care-title">${t.title}</h4>
            <p class="rx-care-desc">${t.desc}</p>
          </div>
        </div>
      `).join('');
    }

    this.modal.classList.remove('hidden');
  }

  closePrescription() {
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
  }
}
