/**
 * Sheet — the bottom sheet behaviour shared by the diagnosis and care panels.
 *
 * Handles open/close, scrim and close-button dismissal, Escape, swipe-down, and
 * returning focus to whatever opened it. `hidden` is toggled around the
 * transition so the panel is genuinely out of the accessibility tree when
 * closed, rather than merely translated off-screen.
 */

const SWIPE_DISMISS_PX = 70;

export class Sheet {
  constructor(root) {
    this.root = root;
    this.panel = root.querySelector('.sheet-panel');
    this.body = root.querySelector('.sheet-body');
    this.isOpen = false;
    this.lastFocused = null;

    root.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    this.bindSwipe();
  }

  bindSwipe() {
    let startY = 0;
    let tracking = false;

    this.panel.addEventListener('touchstart', (e) => {
      // Only start a dismiss gesture from the top of the scroll area, so
      // swiping through long content does not close the sheet.
      tracking = this.body ? this.body.scrollTop <= 0 : true;
      startY = e.touches[0].clientY;
    }, { passive: true });

    this.panel.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      const delta = e.touches[0].clientY - startY;
      if (delta > 0) {
        this.panel.style.transform = `translateY(${delta}px)`;
        this.panel.style.transition = 'none';
      }
    }, { passive: true });

    this.panel.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      this.panel.style.transition = '';
      this.panel.style.transform = '';

      if (e.changedTouches[0].clientY - startY > SWIPE_DISMISS_PX) this.close();
    }, { passive: true });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.lastFocused = document.activeElement;

    this.root.hidden = false;
    if (this.body) this.body.scrollTop = 0;

    // Force a reflow so the transform transition runs from its closed state.
    void this.root.offsetHeight;
    this.root.classList.add('is-open');

    this.panel.querySelector('.sheet-close')?.focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('is-open');

    const finish = () => {
      if (!this.isOpen) this.root.hidden = true;
    };
    this.panel.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 450);

    this.lastFocused?.focus?.({ preventScroll: true });
  }
}
