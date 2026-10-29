/* global window, document */
// One audio context per page, created only after a keyboard or pointer gesture.
const COIN_DASH_AUDIO = (() => {
  let context;
  let output;
  let muted = false;
  const button = document.getElementById('mute-audio');
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  function unlock() {
    if (!AudioContext) return;
    try {
      if (!context) {
        context = new AudioContext();
        output = context.createGain();
        output.gain.value = muted ? 0 : 1;
        output.connect(context.destination);
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch (error) { /* Audio failure must not interrupt the game. */ }
  }

  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  if (!AudioContext) {
    button.disabled = true;
    button.textContent = 'Sound unavailable';
  }
  button.addEventListener('click', () => {
    unlock();
    muted = !muted;
    if (output) output.gain.value = muted ? 0 : 1;
    button.textContent = muted ? 'Unmute sound' : 'Mute sound';
    button.setAttribute('aria-pressed', String(muted));
  });

  return {
    playCoin() {
      if (muted || !context || !output || context.state !== 'running') return;
      try {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.09);
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(0.12, now + 0.005);
        envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        oscillator.connect(envelope);
        envelope.connect(output);
        oscillator.onended = () => {
          oscillator.disconnect();
          envelope.disconnect();
        };
        oscillator.start(now);
        oscillator.stop(now + 0.13);
      } catch (error) { /* Keep coin collection working if audio is unavailable. */ }
    }
  };
})();
