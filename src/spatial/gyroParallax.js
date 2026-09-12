/**
 * GyroParallax Manager
 * Applies authentic Apple VisionOS spatial 3D card tilt based on device gyroscope
 * or desktop mouse/pointer movements.
 */
export class GyroParallax {
  constructor(containerElement) {
    this.container = containerElement;
    this.targetRotX = 0;
    this.targetRotY = 0;
    this.currentRotX = 0;
    this.currentRotY = 0;
    this.targetTransX = 0;
    this.targetTransY = 0;
    this.currentTransX = 0;
    this.currentTransY = 0;

    this.init();
  }

  init() {
    // 1. Mobile Gyroscope DeviceOrientation
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.beta !== null) {
          // Constrain angles for pleasant spatial depth
          const gamma = Math.max(-30, Math.min(30, e.gamma)); // roll (-30 to 30)
          const beta = Math.max(15, Math.min(75, e.beta));     // pitch (holding upright ~45)

          this.targetRotY = (gamma / 30) * 12;                // -12 to 12 deg
          this.targetRotX = -((beta - 45) / 30) * 12;         // -12 to 12 deg

          this.targetTransX = (gamma / 30) * 16;
          this.targetTransY = ((beta - 45) / 30) * 16;
        }
      }, { passive: true });
    }

    // 2. Desktop Pointer Tracking
    window.addEventListener('pointermove', (e) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const normX = (e.clientX / w) * 2 - 1; // -1 to 1
      const normY = (e.clientY / h) * 2 - 1; // -1 to 1

      this.targetRotY = normX * 10;
      this.targetRotX = -normY * 10;
      this.targetTransX = normX * 14;
      this.targetTransY = normY * 14;
    }, { passive: true });
  }

  update() {
    // Critically damped spring-like interpolation
    const lerp = 0.08;
    this.currentRotX += (this.targetRotX - this.currentRotX) * lerp;
    this.currentRotY += (this.targetRotY - this.currentRotY) * lerp;
    this.currentTransX += (this.targetTransX - this.currentTransX) * lerp;
    this.currentTransY += (this.targetTransY - this.currentTransY) * lerp;

    if (this.container) {
      this.container.style.transform = `
        perspective(1200px)
        translate3d(${this.currentTransX.toFixed(2)}px, ${this.currentTransY.toFixed(2)}px, 0px)
        rotateX(${this.currentRotX.toFixed(2)}deg)
        rotateY(${this.currentRotY.toFixed(2)}deg)
      `;
    }
  }
}
