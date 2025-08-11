import React, { useState, useEffect, useRef } from 'react';
import { PlayIcon, StopIcon, SpeakerWaveIcon, SpeakerXMarkIcon, ArrowPathIcon, RadioIcon } from '@heroicons/react/24/solid';
import * as Tone from 'tone';

const App = () => {
  // Define 8 different sound banks of phonemes, partial words, and reverse sounds.
  const soundBanks = [
    // Phonemes and partial words
    ['ba', 'la', 'ko', 'hi', 'mo', 're', 'da', 'na', 'si', 'ta', 'ka', 'el'],
    // Reversed-sounding words
    ['evil', 'dark', 'fear', 'pain', 'cold', 'die'],
    // Foreign words (sounding like communication)
    ['salve', 'vita', 'amor', 'lumen', 'spes'],
    // Common words that could be manipulated
    ['listen', 'back', 'go', 'stay', 'gone', 'here', 'see', 'love', 'light', 'safe'],
    // White noise sound bank mimicking DR60
    ['static hiss', 'radio interference', 'low frequency hum', 'broken signal'],
  ];

  // State variables for app functionality
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [log, setLog] = useState([]);
  const [isApiCalling, setIsApiCalling] = useState(false);
  const [simulatedEmf, setSimulatedEmf] = useState(50);
  const [deviceOrientation, setDeviceOrientation] = useState({ alpha: null, beta: null, gamma: null });
  const [permissionState, setPermissionState] = useState('unknown'); // 'unknown', 'granted', 'denied'
  const [dr60Mode, setDr60Mode] = useState(false);
  const intervalRef = useRef(null);

  // Tone.js audio components
  const noiseRef = useRef(null);
  const reverbRef = useRef(null);
  const delayRef = useRef(null);
  const filterRef = useRef(null);

  // Helper function to convert base64 PCM data to a WAV Blob
  const pcmToWav = (pcmData, sampleRate) => {
    const pcm16 = new Int16Array(pcmData);
    const dataLength = pcm16.length * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    let offset = 0;

    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };

    // RIFF header
    writeString('RIFF');
    view.setUint32(offset, 36 + dataLength, true); offset += 4;
    writeString('WAVE');

    // FMT sub-chunk
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * 2, true); offset += 4;
    view.setUint16(offset, 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;

    // Data sub-chunk
    writeString('data');
    view.setUint32(offset, dataLength, true); offset += 4;

    // Write PCM data
    for (let i = 0; i < pcm16.length; i++) {
      view.setInt16(offset, pcm16[i], true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  // Helper function to convert base64 to ArrayBuffer
  const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Function to call the Gemini TTS API
  const fetchAndPlaySpeech = async (text) => {
    setIsApiCalling(true);
    try {
      let ttsPrompt;
      if (dr60Mode) {
        ttsPrompt = `Generate a sound of a a brief, raw, static-filled white noise from a radio, followed by the sound of a low-frequency hum.`;
      } else {
        ttsPrompt = `Say in a robotic and slightly distorted voice: ${text}`;
      }

      const payload = {
        contents: [{
          parts: [{ text: ttsPrompt }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Fenrir" }
            }
          }
        },
        model: "gemini-2.5-flash-preview-tts"
      };

      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const part = result?.candidates?.[0]?.content?.parts?.[0];
      const audioData = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType;

      if (audioData && mimeType && mimeType.startsWith("audio/")) {
        const sampleRateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 16000;

        const pcmData = base64ToArrayBuffer(audioData);
        const wavBlob = pcmToWav(pcmData, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);

        const audio = new Audio(audioUrl);
        audio.play().catch(e => console.error("Audio playback failed:", e));

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error("Error fetching and playing speech:", error);
    } finally {
      setIsApiCalling(false);
    }
  };

  // Function to request permission for device motion.
  const requestDeviceOrientationPermission = async () => {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        if (state === 'granted') {
          setPermissionState('granted');
        } else {
          setPermissionState('denied');
        }
      } catch (error) {
        console.error("Permission request failed:", error);
        setPermissionState('denied');
      }
    } else {
      // For devices that don't need explicit permission (e.g., Android)
      setPermissionState('granted');
    }
  };

  // Tone.js setup
  useEffect(() => {
    noiseRef.current = new Tone.Noise('white').start();
    filterRef.current = new Tone.Filter(1000, 'lowpass').toDestination();
    reverbRef.current = new Tone.Reverb({
      decay: 3,
      wet: 0.5
    }).connect(filterRef.current);
    delayRef.current = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.3,
      wet: 0.5
    }).connect(reverbRef.current);

    noiseRef.current.connect(delayRef.current);
    Tone.Destination.volume.value = isMuted ? -Infinity : 0;

    return () => {
      noiseRef.current?.dispose();
      reverbRef.current?.dispose();
      delayRef.current?.dispose();
      filterRef.current?.dispose();
    };
  }, []);

  // Device orientation event listener
  useEffect(() => {
    const handleOrientation = (event) => {
      setDeviceOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      });
    };

    if (permissionState === 'granted' && isRunning) {
      window.addEventListener('deviceorientation', handleOrientation);
    } else {
      window.removeEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [permissionState, isRunning]);

  // Main logic loop for the app.
  useEffect(() => {
    if (isRunning) {
      if (Tone.Transport.state !== 'started') {
        Tone.start();
      }
      Tone.Destination.volume.value = isMuted ? -Infinity : 0;
      noiseRef.current.start();

      const minInterval = 1000;
      const maxInterval = 10000;
      const interval = maxInterval - (simulatedEmf / 100) * (maxInterval - minInterval);

      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        let newEntry;
        if (dr60Mode) {
          const dr60Bank = soundBanks[4]; // The last bank is the DR60 bank
          newEntry = dr60Bank[Math.floor(Math.random() * dr60Bank.length)];
        } else {
          const regularBanks = soundBanks.slice(0, 4);
          const bankIndex = Math.floor(Math.random() * regularBanks.length);
          const currentBank = regularBanks[bankIndex];
          newEntry = currentBank[Math.floor(Math.random() * currentBank.length)];
        }

        if (Math.random() < 0.2) {
          reverbRef.current.wet.value = 0.8;
        } else {
          reverbRef.current.wet.value = 0.5;
        }

        if (Math.random() < 0.2) {
          delayRef.current.wet.value = 0.8;
        } else {
          delayRef.current.wet.value = 0.5;
        }

        setLog(prevLog => {
          const maxLogEntries = 15;
          const updatedLog = [
            { id: Date.now(), text: newEntry, timestamp: new Date() },
            ...prevLog
          ];
          return updatedLog.slice(0, maxLogEntries);
        });

        fetchAndPlaySpeech(newEntry);
      }, interval);
    } else {
      clearInterval(intervalRef.current);
      noiseRef.current.stop();
    }

    // This part of the effect handles the gyroscope data.
    if (isRunning && permissionState === 'granted' && deviceOrientation.beta !== null) {
      // Map the device's tilt (beta) to the noise filter frequency.
      // Beta is typically -180 to 180. We map it to a more useful range like 100Hz to 5000Hz.
      const filterFrequency = 100 + ((deviceOrientation.beta + 90) / 180) * 4900;
      filterRef.current.frequency.value = filterFrequency;
    } else {
      filterRef.current.frequency.value = 1000; // Reset frequency when not running or permission is denied
    }

    return () => {
      clearInterval(intervalRef.current);
      if (noiseRef.current) {
        noiseRef.current.stop();
      }
    };
  }, [isRunning, isMuted, simulatedEmf, permissionState, dr60Mode, deviceOrientation]);

  // Function to toggle the running state of the app.
  const toggleRunning = async () => {
    if (!isRunning) {
      if (permissionState === 'unknown') {
        await requestDeviceOrientationPermission();
      }
      await Tone.start();
    }
    setIsRunning(!isRunning);
  };

  const clearLog = () => {
    setLog([]);
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (Tone.Destination) {
      Tone.Destination.volume.value = newMuteState ? -Infinity : 0;
    }
  };

  const toggleDr60Mode = () => {
    setDr60Mode(!dr60Mode);
  };

  return (
    <div className="bg-black min-h-screen text-gray-200 flex flex-col items-center justify-center p-4 font-inter">
      <div className="bg-gray-950 p-8 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col space-y-6 border border-gray-700">

        <div className="text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            SpectreEye SpiritBox
          </h1>
          <p className="text-sm text-gray-400">
            Now with DR60 Mode and specialized sound banks.
          </p>
        </div>

        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={toggleRunning}
            className={`flex items-center px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-md ${
              isRunning
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isRunning ? (
              <StopIcon className="h-6 w-6 mr-2" />
            ) : (
              <PlayIcon className="h-6 w-6 mr-2" />
            )}
            {isRunning ? 'Stop Session' : 'Start Session'}
          </button>
          <button
            onClick={clearLog}
            className="px-6 py-3 rounded-full font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors duration-300 transform hover:scale-105 shadow-md"
          >
            Clear Log
          </button>
          <button
            onClick={toggleMute}
            className="px-4 py-3 rounded-full text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors duration-300 shadow-md"
          >
            {isMuted ? (
              <SpeakerXMarkIcon className="h-6 w-6" />
            ) : (
              <SpeakerWaveIcon className="h-6 w-6" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={toggleDr60Mode}
            className={`flex items-center px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-md ${
              dr60Mode
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            <RadioIcon className="h-6 w-6 mr-2" />
            DR60 Mode {dr60Mode ? 'ON' : 'OFF'}
          </button>
        </div>

        {permissionState === 'denied' && (
          <div className="text-center text-sm text-red-400">
            Permission to use motion sensors was denied. Gyroscope features will not work.
            <button onClick={requestDeviceOrientationPermission} className="ml-2 text-blue-400 hover:underline flex items-center justify-center mx-auto mt-2">
              <ArrowPathIcon className="h-4 w-4 mr-1" /> Re-request Permission
            </button>
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <label htmlFor="emf-slider" className="text-gray-400 font-medium text-center">
            Simulated EMF Strength: {simulatedEmf}%
          </label>
          <input
            id="emf-slider"
            type="range"
            min="0"
            max="100"
            value={simulatedEmf}
            onChange={(e) => setSimulatedEmf(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-lg accent-purple-500"
          />
        </div>

        <div className="text-center text-sm">
          {isApiCalling ? (
            <span className="text-purple-400 animate-pulse">Scanning and Speaking...</span>
          ) : (
            <span className="text-gray-500">Ready</span>
          )}
        </div>

        <div className="bg-black p-4 rounded-xl h-64 overflow-y-auto border border-gray-700 shadow-inner">
          <ul className="text-sm space-y-2">
            {log.length === 0 ? (
              <li className="text-gray-500 text-center italic mt-20">
                Log is empty. Start a session to begin.
              </li>
            ) : (
              log.map(item => (
                <li key={item.id} className="flex items-center space-x-2">
                  <span className="text-purple-400 font-mono">
                    [{item.timestamp.toLocaleTimeString()}]
                  </span>
                  <span className="text-white font-bold text-lg leading-none">
                    {item.text}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6 max-w-md text-center">
        Disclaimer: This is an audio-based simulation for entertainment purposes. It uses a TTS model, generated noise, and real motion sensor data (with user permission).
      </p>
    </div>
  );
};

export default App;
