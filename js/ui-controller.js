export class UIController {
    constructor() {
        this.sidePanel = document.getElementById('side-panel');
        // 他の要素も取得
        this.panelTitle = document.getElementById('panel-title');
        this.panelArtist = document.getElementById('player-artist');
        this.jacketImg = document.getElementById('player-jacket');
        this.closeBtn = document.getElementById('close-btn');
    }

    openPanel(data) {
        if (!this.sidePanel) return;

        // 文字の流し込み
        if (this.panelTitle) this.panelTitle.innerText = data.title;
        if (this.panelArtist) this.panelArtist.innerText = data.artist;
        if (this.jacketImg) {
            this.jacketImg.src = data.image || "";
            this.jacketImg.style.display = data.image ? "block" : "none";
        }

        // CSSで用意した active クラスをつけるだけ！
        this.sidePanel.classList.add('active');
    }

    closePanel() {
        if (this.sidePanel) {
            this.sidePanel.classList.remove('active');
        }
    }
}