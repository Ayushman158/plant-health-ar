/**
 * ConditionCard (Planto Minimalist Telemetry & Prescription Sheet)
 * Elevated, rounded frosted glass card with high-legibility tabular metrics
 * and tap-to-expand clinical prescription.
 */

function getCareIconSvg(title = '') {
  const t = title.toLowerCase();
  if (t.includes('water') || t.includes('flush')) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#bae6fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
  }
  if (t.includes('sun') || t.includes('light')) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fef08a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  }
  if (t.includes('quarantine') || t.includes('alert') || t.includes('cease')) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fca5a5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
  if (t.includes('prune')) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fca5a5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
  }
  if (t.includes('ph') || t.includes('lime') || t.includes('test') || t.includes('fertilizer')) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fed7aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v7.31L4.69 19.3A2 2 0 0 0 6.44 22h11.12a2 2 0 0 0 1.75-2.7L14 9.31V2z"/><line x1="8.5" y1="2" x2="15.5" y2="2"/><line x1="14" y1="9.3" x2="10" y2="9.3"/></svg>`;
  }
  if (t.includes('temp')) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fca5a5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#86efac" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
}

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
        this.rxDesc.textContent = 'Bacterial Wilt infection detected. Vascular xylem tissue is compromised by Ralstonia colonies, causing drooping and petiole collapse.';
      } else if (p.id === 'money_plant_manganese') {
        this.rxDesc.textContent = 'Abiotic Manganese toxicity observed. Characterized by interveinal dark necrotic flecks and marginal chlorosis from acidic potting substrate.';
      } else {
        this.rxDesc.textContent = 'Turgid, glossy leaf tissue with active chlorophyll absorption. Plant is well-nourished and maintaining optimal cellular vigor.';
      }
    }

    if (this.rxCareList) {
      const tips = p.careTips || [];
      this.rxCareList.innerHTML = tips.map(t => `
        <div class="rx-care-item">
          <div class="rx-care-icon" aria-hidden="true">${getCareIconSvg(t.title)}</div>
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
