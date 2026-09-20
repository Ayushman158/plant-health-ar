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

    this.cardEl = cardAnchorEl.querySelector('#condition-card');
    this.toggleBtn = cardAnchorEl.querySelector('#toggle-telemetry-btn');
    this.headerToggle = cardAnchorEl.querySelector('#condition-card-header-toggle');
    this.isCollapsed = true;

    this.valWater = cardAnchorEl.querySelector('#val-water');
    this.valLight = cardAnchorEl.querySelector('#val-light');
    this.valVigor = cardAnchorEl.querySelector('#val-vigor');
    this.valTemp = cardAnchorEl.querySelector('#val-temp');
    this.statusTitle = cardAnchorEl.querySelector('#card-status-title');
    this.statusSub = cardAnchorEl.querySelector('#card-status-sub');
    this.liveAdviceText = cardAnchorEl.querySelector('#live-diagnostic-text');
    this.expandBtn = cardAnchorEl.querySelector('#expand-prescription-btn');

    this.rxSnapshotWrap = document.getElementById('rx-snapshot-wrap');
    this.rxSnapshotImg = document.getElementById('rx-snapshot-img');
    this.rxScore = document.getElementById('rx-score');
    this.rxName = document.getElementById('rx-name');
    this.rxStatusTag = document.getElementById('rx-status-tag');
    this.rxDesc = document.getElementById('rx-description');
    this.rxCareList = document.getElementById('rx-care-list');
    this.closeRxBtn = document.getElementById('close-prescription-btn');
    this.consultAiBtn = document.getElementById('rx-consult-ai-btn');

    this.latestAnalysis = null;
    this.onConsultAi = null;
    this.initEvents();
  }

  setAiConsultCallback(cb) {
    this.onConsultAi = cb;
  }

  initEvents() {
    const toggleCollapse = (e) => {
      e.stopPropagation();
      this.isCollapsed = !this.isCollapsed;
      if (this.cardEl) {
        this.cardEl.classList.toggle('minimized', this.isCollapsed);
      }
      if (this.toggleBtn) {
        this.toggleBtn.setAttribute('aria-expanded', !this.isCollapsed);
        const icon = this.toggleBtn.querySelector('.fold-icon-svg');
        if (icon) {
          icon.innerHTML = this.isCollapsed
            ? `<polyline points="18 15 12 9 6 15"></polyline>`
            : `<polyline points="6 9 12 15 18 9"></polyline>`;
        }
      }
      if (navigator.vibrate) navigator.vibrate(12);
    };

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', toggleCollapse);
    }
    if (this.headerToggle) {
      this.headerToggle.addEventListener('click', toggleCollapse);
    }

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

    if (this.consultAiBtn) {
      this.consultAiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePrescription();
        if (this.onConsultAi) {
          this.onConsultAi(this.latestAnalysis);
        }
      });
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closePrescription();
        }
      });

      let touchStartY = 0;
      this.modal.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      this.modal.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        if (touchEndY - touchStartY > 70) {
          this.closePrescription();
        }
      }, { passive: true });
    }
  }

  updateLiveTelemetry(analysis) {
    if (!analysis) return;
    this.latestAnalysis = analysis;

    const isDetected = analysis.detected;
    const diag = analysis.diagnosis || {};

    if (isDetected) {
      if (this.statusTitle) {
        this.statusTitle.textContent = diag.headline || 'Money Plant Locked';
      }
      if (this.statusSub) {
        this.statusSub.textContent = `${diag.healthScore}% Vitality · ${analysis.light?.label || 'Directing'}`;
        this.statusSub.style.color = diag.healthScore >= 80 ? '#86efac' : '#fed7aa';
      }
      if (this.liveAdviceText) {
        this.liveAdviceText.textContent = diag.advice || 'Plant foliage is clearly focused in viewfinder.';
      }
      if (this.valVigor) {
        this.valVigor.textContent = `${diag.healthScore}%`;
      }
      if (this.valLight && analysis.light) {
        this.valLight.textContent = `${analysis.light.lux} lx`;
      }
      if (this.valWater) {
        this.valWater.textContent = `${analysis.liveChlorophyll}%`;
      }
      if (this.valTemp) {
        this.valTemp.textContent = `${analysis.coverage}%`;
      }
    } else {
      if (this.statusTitle) {
        this.statusTitle.textContent = 'Searching Foliage...';
      }
      if (this.statusSub) {
        this.statusSub.textContent = 'Hold Money Plant in viewfinder';
        this.statusSub.style.color = 'var(--mint-primary)';
      }
      if (this.liveAdviceText) {
        this.liveAdviceText.textContent = 'Point camera at Money Plant leaves to begin real-time telemetry analysis.';
      }
      if (this.valVigor) this.valVigor.textContent = '--%';
      if (this.valLight && analysis.light) this.valLight.textContent = `${analysis.light.lux} lx`;
      if (this.valWater) this.valWater.textContent = '--%';
      if (this.valTemp) this.valTemp.textContent = '--%';
    }
  }

  openPrescription(analysis = null, snapshotDataUrl = null) {
    const a = analysis || this.latestAnalysis;
    const diag = a?.diagnosis || {};
    const light = a?.light || { lux: 420, label: 'Bright Indirect' };
    const score = diag.healthScore || 94;

    // 1. Snapshot thumbnail preview
    if (this.rxSnapshotImg && snapshotDataUrl) {
      this.rxSnapshotImg.src = snapshotDataUrl;
      this.rxSnapshotWrap.style.display = 'block';
    } else if (this.rxSnapshotWrap) {
      this.rxSnapshotWrap.style.display = 'none';
    }

    // 2. Score & diagnosis badge
    if (this.rxScore) {
      this.rxScore.textContent = `${score}%`;
      const scoreColor = score >= 80 ? '#86efac' : (score >= 65 ? '#fed7aa' : '#fca5a5');
      this.rxScore.style.borderColor = scoreColor;
      this.rxScore.style.color = scoreColor;
    }

    if (this.rxName) {
      this.rxName.textContent = 'Money Plant (Epipremnum aureum)';
    }

    if (this.rxStatusTag) {
      this.rxStatusTag.textContent = diag.headline || 'Optimal Cellular Vigor';
      this.rxStatusTag.style.color = score >= 80 ? '#86efac' : '#fed7aa';
    }

    // 3. Clinical Observation Paragraph
    if (this.rxDesc) {
      const chlor = a?.liveChlorophyll || 88;
      const cov = a?.coverage || 18;
      this.rxDesc.textContent = `${diag.advice || 'Specimen evaluated via live computer vision.'} Real-time photometrics measure ${light.lux} lx (${light.label}), with ${chlor}% active chlorophyll absorption and ${cov}% screen foliage coverage.`;
    }

    // 4. Tailored Actionable Care Plan
    if (this.rxCareList) {
      let careTips = [];

      if (diag.category === 'chlorosis') {
        careTips = [
          {
            title: 'Watering Adjustment',
            desc: 'Yellowing indicates saturated soil. Pause watering until top 2 inches of soil feel dry. Empty any standing water in drainage saucers.'
          },
          {
            title: 'Drainage Check',
            desc: 'Confirm potting container has open drainage holes. Money Plants suffer root hypoxia if kept in waterlogged substrate.'
          },
          {
            title: 'Air Circulation',
            desc: 'Keep in an aerated location to facilitate natural leaf transpiration.'
          }
        ];
      } else if (diag.category === 'necrosis') {
        careTips = [
          {
            title: 'Humidity Management',
            desc: 'Crispy leaf tips indicate dry air. Mist foliage 2-3 times weekly with room-temperature water.'
          },
          {
            title: 'Avoid Air Drafts',
            desc: 'Move plant away from cold air conditioners, heaters, or forced air vents that dehydrate leaf tissue.'
          },
          {
            title: 'Hydration Check',
            desc: 'Perform a deep soak until water runs out the bottom, then allow excess to drain.'
          }
        ];
      } else if (diag.category === 'dim') {
        careTips = [
          {
            title: 'Optimize Natural Light',
            desc: `Current reading (${light.lux} lx) is low. Move plant 3-5 feet closer to an east- or north-facing window for brighter indirect illumination.`
          },
          {
            title: 'Preserve Variegation',
            desc: 'Money Plants in low light revert to solid dark green to capture minimal photons. Bright light sustains golden marbling.'
          },
          {
            title: 'Dust Foliage',
            desc: 'Wipe leaves gently with a damp microfiber cloth to maximize light absorption efficiency.'
          }
        ];
      } else {
        careTips = [
          {
            title: 'Ideal Watering Routine',
            desc: 'Maintain current cadence: water once every 7-10 days when the top 50% of the potting medium feels dry to touch.'
          },
          {
            title: 'Light Balance',
            desc: `Current light level (${light.lux} lx) is in the optimal growth zone. Continue providing bright, filtered indirect sunlight.`
          },
          {
            title: 'Vine Propagation',
            desc: 'Healthy nodes are visible along the vine. Stems with 2-3 leaves can easily root in clean water for new cuttings.'
          }
        ];
      }

      this.rxCareList.innerHTML = careTips.map(t => `
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
