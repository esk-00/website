document.addEventListener('DOMContentLoaded', function() {
  const typedTextElement = document.getElementById('typed-text');
  const progressFill = document.getElementById('progress-fill');
  const percentageElement = document.getElementById('percentage');
  const completeMessage = document.getElementById('complete-message');
  const loadingContainer = document.querySelector('.loading-container');
  const mainPage = document.getElementById('main-page');

  const textToType = "INITIALIZING NEURAL INTERFACE...";
  let currentCharIndex = 0;
  let progress = 0;

  // タイピング効果
  function typeText() {
      if (currentCharIndex < textToType.length) {
          typedTextElement.textContent += textToType[currentCharIndex];
          currentCharIndex++;

          // 文字ごとの打鍵間隔をランダムに（80-150ms）
          const nextDelay = Math.random() * 70 + 80;
          setTimeout(typeText, nextDelay);
      } else {
          // タイピング完了後、カーソルを少し表示してから進行開始
          setTimeout(startProgress, 500);
      }
  }

  // プログレス開始
  function startProgress() {
      const progressInterval = setInterval(() => {
          progress += Math.random() * 3 + 1;

          if (progress >= 100) {
              progress = 100;
              clearInterval(progressInterval);
              onComplete();
          }

          // プログレスバーとパーセントを更新
          progressFill.style.width = progress + '%';
          percentageElement.textContent = Math.floor(progress) + '%';
      }, 100);
  }

  // 完了処理
  function onComplete() {
      // カーソルを非表示
      document.querySelector('.cursor').style.display = 'none';

      // グリッチエフェクト
      typedTextElement.classList.add('glitch-effect');

      // 完了メッセージ表示
      setTimeout(() => {
          completeMessage.classList.add('show');
      }, 300);

      // メインページの表示 - 位置移動なし
      setTimeout(() => {
          // ローディング画面をフェードアウト
          loadingContainer.classList.add('fade-out');

          // 同時にメインページをフェードイン
          mainPage.classList.add('show');
      }, 1500);
  }

  // タイピング開始（少し遅延してから）
  setTimeout(typeText, 300);
});
