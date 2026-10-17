/**
 * Left slide-in card for house and water-meter pins (mobile touch).
 */
const DetailPanel = {
    panel: null,
    backdrop: null,
    body: null,
    title: null,
    startX: 0,

    init() {
        this.panel = document.getElementById('detailPanel');
        this.backdrop = document.getElementById('detailBackdrop');
        this.body = document.getElementById('detailPanelBody');
        this.title = document.getElementById('detailPanelTitle');
        if (!this.panel) return;

        this.backdrop.addEventListener('click', () => this.close());
        document.getElementById('detailPanelClose').addEventListener('click', () => this.close());

        this.panel.addEventListener('touchstart', (e) => {
            this.startX = e.changedTouches[0].clientX;
        }, { passive: true });
        this.panel.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - this.startX;
            if (dx < -60) this.close();
        }, { passive: true });
    },

    open(title, html, kind) {
        if (!this.panel) this.init();
        this.title.textContent = title;
        this.body.innerHTML = html;
        this.panel.dataset.kind = kind || 'meter';
        this.backdrop.classList.add('active');
        this.panel.classList.add('active');
    },

    close() {
        if (!this.panel) return;
        this.panel.classList.remove('active');
        this.backdrop.classList.remove('active');
    }
};

window.DetailPanel = DetailPanel;
window.closeDetailPanel = () => DetailPanel.close();
