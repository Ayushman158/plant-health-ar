/**
 * CameraStream Manager
 * Handles rear environment camera stream for mobile & desktop fallback.
 * Allows seamless switching between real camera and high-res botanical specimen mode.
 */
export class CameraStream {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    this.stream = null;
    this.isLiveCamera = false;
    this.activeSpecimenImage = null;
    this.facingMode = 'environment';
  }

  async startCamera(preferredFacing = null) {
    if (preferredFacing) {
      this.facingMode = preferredFacing;
    }
    try {
      this.stopCamera();

      const constraints = {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();
      this.isLiveCamera = true;
      this.activeSpecimenImage = null;
      return true;
    } catch (err) {
      console.warn('Camera stream could not be started, falling back to botanical specimen mode:', err);
      this.isLiveCamera = false;
      return false;
    }
  }

  async flipCamera() {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    return await this.startCamera();
  }

  captureSnapshot() {
    if (!this.canvas || this.canvas.width === 0 || this.canvas.height === 0) return null;
    try {
      return this.canvas.toDataURL('image/jpeg', 0.88);
    } catch (e) {
      console.warn('Snapshot capture failed:', e);
      return null;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.isLiveCamera = false;
  }

  loadSpecimen(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.activeSpecimenImage = img;
        this.isLiveCamera = false;
        resolve(img);
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }

  renderFrame() {
    if (this.isLiveCamera && this.video.readyState >= 2) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this.ctx.drawImage(this.video, 0, 0);
      return true;
    } else if (this.activeSpecimenImage) {
      this.canvas.width = this.activeSpecimenImage.naturalWidth || 1000;
      this.canvas.height = this.activeSpecimenImage.naturalHeight || 1250;
      this.ctx.drawImage(this.activeSpecimenImage, 0, 0, this.canvas.width, this.canvas.height);
      return true;
    }
    return false;
  }
}
