/**
 * ConditionCard — Premium Floating Botanical Result Card & Diagnosis Bottom Sheet
 * 
 * Complies with Apple Camera × modern plant-care app visual standards.
 * Features:
 * - Live SVG circular vitality ring (circumference 163.36px)
 * - Concise, plain-language botanical status ("Looks healthy!", "93% Vitality")
 * - Clean iOS diagnosis bottom sheet with Foliage, Hydration, Potential concerns, and Care tips.
 */

export class ConditionCard {
  constructor(cardAnchorEl, prescriptionModalEl) {
    this.anchor = cardAnchorEl;
    this.modal = prescriptionModalEl;

    // Primary Result Card elements
    this.cardEl = cardAnchorEl.querySelector('#condition-card');
    this.thumbImg = cardAnchorEl.querySelector('#result-card-thumb');
    this.titleEl = cardAnchorEl.querySelector('#result-card-title');
    this.descEl = cardAnchorEl.querySelector('#result-card-desc');
    this.vitalityPctEl = cardAnchorEl.querySelector('#result-vitality-pct');
    this.vitalityCircle = cardAnchorEl.querySelector('#vitality-progress-circle');

    // Diagnosis Bottom Sheet elements
    this.rxSnapshotWrap = document.getElementById('rx-snapshot-wrap');
    this.rxSnapshotImg = document.getElementById('rx-snapshot-img');
    this.sheetStatusPill = document.getElementById('sheet-status-pill');
    this.diagValVitality = document.getElementById('diag-val-vitality');
    this.diagValFoliage = document.getElementById('diag-val-foliage');
    this.diagValHydration = document.getElementById('diag-val-hydration');
    this.diagValConcerns = document.getElementById('diag-val-concerns');
    this.tipWateringText = document.getElementById('tip-watering-text');
    this.tipLightText = document.getElementById('tip-light-text');
    this.rxDesc = document.getElementById('rx-description');
    this.closeRxBtn = document.getElementById('close-prescription-btn');
    this.consultAiBtn = document.getElementById('rx-consult-ai-btn');

    this.circleCircumference = 2 * Math.PI * 26; // ~163.36
    this.latestAnalysis = null;
    this.onConsultAi = null;

    this.initEvents();
    this.setVitalityRing(93);
  }

  setAiConsultCallback(cb) {
    this.onConsultAi = cb;
  }

  initEvents() {
    // Tapping primary result card opens diagnosis sheet
    if (this.cardEl) {
      this.cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(15);
        this.openPrescription();
      });
    }

    // Modal close button
    if (this.closeRxBtn) {
      this.closeRxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePrescription();
      });
    }

    // Modal background overlay click to dismiss
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closePrescription();
        }
      });

      // Swipe down gesture to dismiss
      let touchStartY = 0;
      this.modal.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      this.modal.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        if (touchEndY - touchStartY > 60) {
          this.closePrescription();
        }
      }, { passive: true });
    }

    // Consult AI button inside diagnosis sheet
    if (this.consultAiBtn) {
      this.consultAiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePrescription();
        if (this.onConsultAi) {
          this.onConsultAi(this.latestAnalysis);
        }
      });
    }
  }

  setVitalityRing(percentage) {
    if (!this.vitalityCircle) return;
    const clamped = Math.min(100, Math.max(0, percentage));
    const offset = this.circleCircumference * (1 - clamped / 100);
    this.vitalityCircle.style.strokeDashoffset = offset;

    // Color transition based on health
    const color = clamped >= 80 ? '#4ade80' : (clamped >= 65 ? '#fed7aa' : '#fca5a5');
    this.vitalityCircle.style.stroke = color;
  }

  updateLiveTelemetry(analysis) {
    if (!analysis) return;
    this.latestAnalysis = analysis;

    const isDetected = analysis.detected;
    const diag = analysis.diagnosis || {};
    const healthScore = diag.healthScore || 93;

    if (isDetected) {
      if (this.titleEl) {
        if (healthScore >= 85) {
          this.titleEl.textContent = 'Looks healthy!';
        } else if (healthScore >= 70) {
          this.titleEl.textContent = 'Mild stress detected';
        } else {
          this.titleEl.textContent = 'Care needed';
        }
      }

      if (this.descEl) {
        if (diag.category === 'chlorosis') {
          this.descEl.textContent = 'Mild foliage yellowing detected. Check soil moisture and avoid overwatering.';
        } else if (diag.category === 'necrosis') {
          this.descEl.textContent = 'Edge browning detected. Ambient humidity may be low; consider misting leaves.';
        } else if (diag.category === 'dim') {
          this.descEl.textContent = 'Room light is low. Indirect window light will encourage vibrant golden streaks.';
        } else {
          this.descEl.textContent = 'Your money plant looks vibrant with no major issues detected.';
        }
      }

      if (this.vitalityPctEl) {
        this.vitalityPctEl.textContent = `${healthScore}%`;
      }

      this.setVitalityRing(healthScore);
    } else {
      if (this.titleEl) {
        this.titleEl.textContent = 'Scanning for plant...';
      }
      if (this.descEl) {
        this.descEl.textContent = 'Point camera at your Money Plant to inspect foliage vitality.';
      }
      if (this.vitalityPctEl) {
        this.vitalityPctEl.textContent = '--%';
      }
      this.setVitalityRing(0);
    }
  }

  openPrescription(analysis = null, snapshotDataUrl = null) {
    const a = analysis || this.latestAnalysis;
    const diag = a?.diagnosis || {};
    const light = a?.light || { lux: 420, label: 'Bright Indirect' };
    const score = diag.healthScore || 93;

    // Snapshot image preview
    if (this.rxSnapshotImg && snapshotDataUrl) {
      this.rxSnapshotImg.src = snapshotDataUrl;
      if (this.rxSnapshotWrap) this.rxSnapshotWrap.style.display = 'block';
    } else if (this.rxSnapshotWrap) {
      this.rxSnapshotWrap.style.display = 'none';
    }

    // Status pill
    if (this.sheetStatusPill) {
      if (score >= 85) {
        this.sheetStatusPill.textContent = '● Healthy';
        this.sheetStatusPill.className = 'sheet-status-pill optimal';
      } else if (score >= 70) {
        this.sheetStatusPill.textContent = '● Moderate';
        this.sheetStatusPill.className = 'sheet-status-pill warning';
      } else {
        this.sheetStatusPill.textContent = '● Attention';
        this.sheetStatusPill.className = 'sheet-status-pill alert';
      }
    }

    // Grid values
    if (this.diagValVitality) {
      this.diagValVitality.textContent = `${score}%`;
      this.diagValVitality.style.color = score >= 80 ? '#4ade80' : '#fed7aa';
    }

    if (this.diagValFoliage) {
      if (diag.category === 'chlorosis') {
        this.diagValFoliage.textContent = 'Yellowing';
      } else if (diag.category === 'necrosis') {
        this.diagValFoliage.textContent = 'Dry margins';
      } else {
        this.diagValFoliage.textContent = 'Healthy';
      }
    }

    if (this.diagValHydration) {
      if (diag.category === 'chlorosis') {
        this.diagValHydration.textContent = 'Excess moisture';
      } else if (diag.category === 'necrosis') {
        this.diagValHydration.textContent = 'Dry air / Low mist';
      } else {
        this.diagValHydration.textContent = 'Good';
      }
    }

    if (this.diagValConcerns) {
      if (diag.category === 'chlorosis') {
        this.diagValConcerns.textContent = 'Overwatering risk';
      } else if (diag.category === 'necrosis') {
        this.diagValConcerns.textContent = 'Marginal tip drying';
      } else if (diag.category === 'dim') {
        this.diagValConcerns.textContent = 'Low ambient illumination';
      } else {
        this.diagValConcerns.textContent = 'None detected';
      }
    }

    // Tailored Care Tips
    if (this.tipWateringText) {
      if (diag.category === 'chlorosis') {
        this.tipWateringText.textContent = 'Allow the top 2–3 cm of soil to dry completely before watering again.';
      } else {
        this.tipWateringText.textContent = 'Water when the top 2–3 cm of soil becomes dry.';
      }
    }

    if (this.tipLightText) {
      if (diag.category === 'dim') {
        this.tipLightText.textContent = 'Move closer to an east- or south-facing window with filtered indirect sunlight.';
      } else {
        this.tipLightText.textContent = 'Keep in bright, indirect light.';
      }
    }

    if (this.rxDesc) {
      this.rxDesc.textContent = `Ambient room light measures ${light.lux} lx (${light.label}). Active photosynthesis reflection index: ${a?.liveChlorophyll || 88}%.`;
    }

    // Open bottom sheet
    if (this.modal) {
      this.modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  closePrescription() {
    if (this.modal) {
      this.modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
}
