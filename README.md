# 🎙️ Necrophonic Simulator

An interactive **paranormal audio simulation app** built with **React**, **Tone.js**, and **Tailwind CSS**.  
Generates randomized phonemes, words, and static/noise effects with optional DR60 mode, motion sensor control, and AI-generated speech.
---

## ✨ Features

- **Multiple Sound Banks** – phonemes, partial words, reversed words, foreign words, common words, and DR60-style static.
- **DR60 Mode** – simulate Panasonic DR60 EVP recorder noise & hum.
- **Simulated EMF Strength Slider** – controls message frequency.
- **Motion Sensor Integration** – tilt your device to change filter frequency (mobile only, requires permission).
- **TTS Support** – uses AI Text-to-Speech (Gemini API) for robotic/distorted voices.
- **Real-Time Effects** – reverb, delay, and filter via Tone.js.
- **Log Display** – shows timestamped entries for each generated sound.
- **Dark, Modern UI** – styled with Tailwind CSS.

---

## 🖼️ Screenshots
<img width="681" height="847" alt="image" src="https://github.com/user-attachments/assets/69a321b7-94ad-49b6-aad8-7acc8202e929" />


---

## 📦 Installation

1. **Download Dependencies **
```bash
   npm install
```

```bash
   npm run dev
```

---

#### 🎮 Usage
- **Start Session** – begins generating random entries from the sound banks.
- **DR60 Mode** – toggles static-filled DR60 recorder simulation.
- **Mute** – toggles all audio output.
- **Clear Log** – removes all previous entries from the display.
- **EMF Slider** – increases/decreases event frequency.
- **Motion Sensor** – tilt your phone to modulate noise filter frequency.

#### 📚 Tech Stack
- **React 18** – UI framework
- **Tone.js** – audio synthesis & effects
- **Tailwind CSS** – styling
- **Heroicons** – UI icons
- **Gemini API** – AI Text-to-Speech

#### 🤝 Contributing
Pull requests are welcome! If you have ideas for:
- **New sound banks**
- **Additional effects**
- **Performance improvements**
