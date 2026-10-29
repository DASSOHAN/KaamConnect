// Voice accessibility helper for informal workers (Bengali / Hindi)

export class VoiceAssistant {
  static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  static currentUtterance = null;

  static speakJobAlert(job, lang, onStart, onEnd) {
    if (!this.synth) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return;
    }

    this.stop();

    let text = '';
    let voiceLang = 'en-IN';

    if (lang === 'bn') {
      text = `নতুন কাজ এসেছে! কাজ: ${job.serviceTitle}। ঠিকানা: ${job.locality}। দূরত্ব: ${job.distanceKm} কিলোমিটার দূরে। নির্ধারিত পারিশ্রমিক: ${job.payoutAmount} টাকা। গ্রহণ করতে সবুজ বোতাম চাপুন।`;
      voiceLang = 'bn-IN';
    } else if (lang === 'hi') {
      text = `नया काम उपलब्ध है! काम: ${job.serviceTitle}। स्थान: ${job.locality}। दूरी: ${job.distanceKm} किलोमीटर। मजदूरी: ${job.payoutAmount} रुपये। काम स्वीकार करने के लिए हरा बटन दबाएं।`;
      voiceLang = 'hi-IN';
    } else {
      text = `New job alert! Service: ${job.serviceTitle}. Location: ${job.locality}, ${job.distanceKm} kilometers away. Fair wage: ${job.payoutAmount} rupees. Press the green button to accept.`;
      voiceLang = 'en-IN';
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = this.synth.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(voiceLang.split('-')[0]));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error:', e);
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  static stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }
}
