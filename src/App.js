import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Download, Share2, X, Eye, EyeOff } from 'lucide-react';

const VoiceEffectsApp = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState('delay');
  const [effectIntensity, setEffectIntensity] = useState(50);
  const [previewMode, setPreviewMode] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const effectsChainRef = useRef([]);
  const previewStreamRef = useRef(null);

  const voiceEffects = [
    { id: 'delay', name: 'Delay', description: 'Simple echo delay effect' },
    { id: 'reverb', name: 'Reverb', description: 'Hall reverb effect' },
    { id: 'tremolo', name: 'Tremolo', description: 'Volume oscillation effect' },
    { id: 'phaser', name: 'Phaser', description: 'Sweeping phase effect' },
    { id: 'telephone', name: 'Telephone', description: 'Old phone call effect' },
    { id: 'echo', name: 'Echo Cave', description: 'Multiple echoes' },
    { id: 'underwater', name: 'Underwater', description: 'Muffled underwater sound' },
    { id: 'radio', name: 'Radio DJ', description: 'Radio broadcast effect' }
  ];

  // Simple Delay effect: single echo
  const createDelayEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const delay = audioContext.createDelay();
    const feedback = audioContext.createGain();
    
    // Delay time: 0.1 to 0.5 seconds based on intensity
    delay.delayTime.value = 0.1 + (intensity / 100) * 0.4;
    
    // Feedback amount: 0 to 60%
    feedback.gain.value = (intensity / 100) * 0.6;
    
    // Set mix levels
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel * 0.5; // Keep more dry signal
    wet.gain.value = mixLevel * 0.8;     // Wet signal
    
    // Create feedback loop
    delay.connect(feedback);
    feedback.connect(delay);
    
    // Connect the chains
    input.connect(dry);
    input.connect(delay);
    delay.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    return { input: input, output: output };
  };

  // Reverb effect: convolution reverb
  const createReverbEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const convolver = audioContext.createConvolver();
    
    // Create impulse response for reverb
    const sampleRate = audioContext.sampleRate;
    const length = sampleRate * (1 + intensity / 50); // 1-3 seconds based on intensity
    const impulse = audioContext.createBuffer(2, length, sampleRate);
    
    // Generate impulse response
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay
        const decay = Math.pow(1 - i / length, 2);
        // Random noise for natural reverb sound
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.3;
        
        // Add some early reflections
        if (i < sampleRate * 0.1) {
          channelData[i] += (Math.random() * 2 - 1) * decay * 0.1;
        }
      }
    }
    
    convolver.buffer = impulse;
    
    // Set mix levels
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel * 0.3; // Keep more dry signal
    wet.gain.value = mixLevel * 0.6;     // Wet signal
    
    // Connect the chains
    input.connect(dry);
    input.connect(convolver);
    convolver.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    return { input: input, output: output };
  };

  // Tremolo effect: amplitude modulation
  const createTremoloEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    const tremolo = audioContext.createGain();
    
    // LFO frequency (fixed at 4 Hz for good tremolo)
    lfo.frequency.value = 4;
    lfo.type = 'sine';
    
    // Tremolo depth - always max depth for the wet signal
    lfoGain.gain.value = 0.5;
    
    // Offset for tremolo (so it oscillates around 0.5)
    const dcOffset = audioContext.createConstantSource();
    dcOffset.offset.value = 0.5;
    dcOffset.start();
    
    // Connect LFO to gain control
    lfo.connect(lfoGain);
    lfoGain.connect(tremolo.gain);
    dcOffset.connect(tremolo.gain);
    
    // Set mix levels based on intensity
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel;
    wet.gain.value = mixLevel;
    
    // Connect the chains
    input.connect(dry);
    input.connect(tremolo);
    tremolo.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    lfo.start();
    
    return { input: input, output: output };
  };

  // Phaser effect: all-pass filter modulation
  const createPhaserEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    const feedback = audioContext.createGain();
    
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    // Create allpass filters
    const allpassFilters = [];
    for (let i = 0; i < 4; i++) {
      const allpass = audioContext.createBiquadFilter();
      allpass.type = 'allpass';
      allpass.frequency.value = 200 + i * 100;
      allpass.Q.value = 1;
      allpassFilters.push(allpass);
    }
    
    // Chain the allpass filters
    let previous = input;
    allpassFilters.forEach(filter => {
      previous.connect(filter);
      previous = filter;
    });
    
    // LFO setup
    lfo.frequency.value = 0.8; // Fixed sweep rate
    lfo.type = 'sine';
    lfoGain.gain.value = 200; // Frequency modulation depth
    
    // Connect LFO to all filters
    lfo.connect(lfoGain);
    allpassFilters.forEach(filter => {
      lfoGain.connect(filter.frequency);
    });
    
    // Feedback
    feedback.gain.value = 0.5;
    previous.connect(feedback);
    feedback.connect(input);
    
    // Set mix levels based on intensity
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel;
    wet.gain.value = mixLevel;
    
    // Connect dry signal
    input.connect(dry);
    // Connect wet signal
    previous.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    lfo.start();
    
    return { input: input, output: output };
  };

  // Telephone effect: bandpass filter
  const createTelephoneEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const lowpass = audioContext.createBiquadFilter();
    const highpass = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3000;
    
    highpass.type = 'highpass';
    highpass.frequency.value = 300;
    
    gain.gain.value = 2;
    
    // Set mix levels
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel;
    wet.gain.value = mixLevel;
    
    // Connect effect chain
    input.connect(dry);
    input.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    return { input: input, output: output };
  };

  // Alien effect: ring modulation
  const createAlienEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const oscillator = audioContext.createOscillator();
    const ringMod = audioContext.createScriptProcessor(4096, 1, 1);
    
    oscillator.frequency.value = 50;
    oscillator.type = 'sine';
    oscillator.start();
    
    let phase = 0;
    ringMod.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      const outputBuffer = event.outputBuffer.getChannelData(0);
      
      for (let i = 0; i < inputBuffer.length; i++) {
        const modulator = Math.sin(phase);
        outputBuffer[i] = inputBuffer[i] * modulator;
        phase += (2 * Math.PI * oscillator.frequency.value) / audioContext.sampleRate;
      }
    };
    
    // Set mix levels
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel;
    wet.gain.value = mixLevel;
    
    input.connect(dry);
    input.connect(ringMod);
    ringMod.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    return { input: input, output: output };
  };

  // Echo effect: multiple delays
  const createEchoEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const delay1 = audioContext.createDelay();
    const delay2 = audioContext.createDelay();
    const delay3 = audioContext.createDelay();
    const feedback1 = audioContext.createGain();
    const feedback2 = audioContext.createGain();
    const feedback3 = audioContext.createGain();
    
    delay1.delayTime.value = 0.2;
    delay2.delayTime.value = 0.4;
    delay3.delayTime.value = 0.6;
    
    feedback1.gain.value = 0.3;
    feedback2.gain.value = 0.2;
    feedback3.gain.value = 0.1;
    
    // Set mix levels
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel;
    wet.gain.value = mixLevel;
    
    // Create feedback loops
    delay1.connect(feedback1);
    feedback1.connect(delay1);
    delay2.connect(feedback2);
    feedback2.connect(delay2);
    delay3.connect(feedback3);
    feedback3.connect(delay3);
    
    // Connect input to delays
    input.connect(dry);
    input.connect(delay1);
    input.connect(delay2);
    input.connect(delay3);
    
    // Mix delays to wet
    delay1.connect(wet);
    delay2.connect(wet);
    delay3.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    return { input: input, output: output };
  };

  // Underwater effect: low pass + chorus
  const createUnderwaterEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const lowpass = audioContext.createBiquadFilter();
    const delay = audioContext.createDelay();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 800;
    
    lfo.frequency.value = 2;
    lfo.type = 'sine';
    lfoGain.gain.value = 0.005;
    
    delay.delayTime.value = 0.02;
    
    // Set mix levels
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel;
    wet.gain.value = mixLevel;
    
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    
    input.connect(dry);
    input.connect(lowpass);
    lowpass.connect(delay);
    delay.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    return { input: input, output: output };
  };

  // Radio effect: compression + distortion + EQ
  const createRadioEffect = (audioContext, intensity) => {
    const input = audioContext.createGain();
    const output = audioContext.createGain();
    const dry = audioContext.createGain();
    const wet = audioContext.createGain();
    
    const compressor = audioContext.createDynamicsCompressor();
    const distortion = audioContext.createWaveShaper();
    const eq = audioContext.createBiquadFilter();
    
    compressor.threshold.value = -20;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    eq.type = 'peaking';
    eq.frequency.value = 2000;
    eq.Q.value = 1;
    eq.gain.value = 6;
    
    // Soft distortion
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 3);
    }
    distortion.curve = curve;
    
    // Set mix levels
    const mixLevel = intensity / 100;
    dry.gain.value = 1 - mixLevel;
    wet.gain.value = mixLevel;
    
    input.connect(dry);
    input.connect(compressor);
    compressor.connect(distortion);
    distortion.connect(eq);
    eq.connect(wet);
    
    dry.connect(output);
    wet.connect(output);
    
    return { input: input, output: output };
  };

  const createEffect = (audioContext, effectId, intensity) => {
    switch (effectId) {
      case 'delay': return createDelayEffect(audioContext, intensity);
      case 'reverb': return createReverbEffect(audioContext, intensity);
      case 'tremolo': return createTremoloEffect(audioContext, intensity);
      case 'phaser': return createPhaserEffect(audioContext, intensity);
      case 'telephone': return createTelephoneEffect(audioContext, intensity);
      case 'echo': return createEchoEffect(audioContext, intensity);
      case 'underwater': return createUnderwaterEffect(audioContext, intensity);
      case 'radio': return createRadioEffect(audioContext, intensity);
      default: return null;
    }
  };

  const startPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      previewStreamRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.7; // Prevent feedback
      
      sourceRef.current = source;
      
      // Create initial effect and connect
      updatePreviewEffect();
      
      setPreviewMode(true);
      
    } catch (error) {
      console.error('Error starting preview:', error);
      alert('Could not access microphone for preview.');
    }
  };

  const updatePreviewEffect = () => {
    if (!audioContextRef.current || !sourceRef.current) return;
    
    // Disconnect previous effect chain
    effectsChainRef.current.forEach(node => {
      try {
        node.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    });
    
    // Create new effect with current settings
    const effect = createEffect(audioContextRef.current, selectedEffect, effectIntensity);
    const gainNode = audioContextRef.current.createGain();
    gainNode.gain.value = 0.7;
    
    if (effect) {
      sourceRef.current.connect(effect.input);
      effect.output.connect(gainNode);
      effectsChainRef.current = [effect, gainNode];
    } else {
      sourceRef.current.connect(gainNode);
      effectsChainRef.current = [gainNode];
    }
    
    gainNode.connect(audioContextRef.current.destination);
  };

  // Update effect when settings change during preview
  useEffect(() => {
    if (previewMode) {
      updatePreviewEffect();
    }
  }, [selectedEffect, effectIntensity, previewMode]);

  const stopPreview = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(track => track.stop());
      previewStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    sourceRef.current = null;
    effectsChainRef.current = [];
    setPreviewMode(false);
  };

  const togglePreview = () => {
    if (previewMode) {
      stopPreview();
    } else {
      startPreview();
    }
  };

  const processAudioWithEffect = async (audioBlob) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const effect = createEffect(offlineContext, selectedEffect, effectIntensity);
      
      if (effect) {
        source.connect(effect.input);
        effect.output.connect(offlineContext.destination);
      } else {
        source.connect(offlineContext.destination);
      }
      
      source.start();
      const renderedBuffer = await offlineContext.startRendering();
      
      // Convert to blob
      const length = renderedBuffer.length * renderedBuffer.numberOfChannels * 2;
      const arrayBuffer2 = new ArrayBuffer(length + 44);
      const view = new DataView(arrayBuffer2);
      
      // WAV header
      const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, length + 36, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, renderedBuffer.numberOfChannels, true);
      view.setUint32(24, renderedBuffer.sampleRate, true);
      view.setUint32(28, renderedBuffer.sampleRate * renderedBuffer.numberOfChannels * 2, true);
      view.setUint16(32, renderedBuffer.numberOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(36, 'data');
      view.setUint32(40, length, true);
      
      let offset = 44;
      for (let i = 0; i < renderedBuffer.length; i++) {
        for (let channel = 0; channel < renderedBuffer.numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, renderedBuffer.getChannelData(channel)[i]));
          view.setInt16(offset, sample * 0x7FFF, true);
          offset += 2;
        }
      }
      
      return new Blob([arrayBuffer2], { type: 'audio/wav' });
    } catch (error) {
      console.error('Audio processing error:', error);
      return audioBlob;
    }
  };

  const startRecording = async () => {
    try {
      if (previewMode) {
        stopPreview();
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      // Start real-time monitoring with effects during recording
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const effect = createEffect(audioContext, selectedEffect, effectIntensity);
      const monitorGain = audioContext.createGain();
      
      monitorGain.gain.value = 0.6; // Monitor volume during recording
      
      if (effect) {
        source.connect(effect.input);
        effect.output.connect(monitorGain);
        effectsChainRef.current = [effect];
      } else {
        source.connect(monitorGain);
        effectsChainRef.current = [];
      }
      
      monitorGain.connect(audioContext.destination);
      sourceRef.current = source;
      
      // Set up MediaRecorder for the original stream (without effects)
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop monitoring
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const processedBlob = await processAudioWithEffect(audioBlob);
        setAudioBlob(processedBlob);
        setShowModal(true);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please ensure you have granted permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clean up monitoring audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      sourceRef.current = null;
      effectsChainRef.current = [];
    }
  };

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const downloadAudio = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-effect-${selectedEffect}-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const shareAudio = async () => {
    if (audioBlob && navigator.share) {
      try {
        const file = new File([audioBlob], `voice-effect-${selectedEffect}-${Date.now()}.wav`, {
          type: 'audio/wav'
        });
        
        await navigator.share({
          title: `My ${voiceEffects.find(e => e.id === selectedEffect)?.name} Voice Effect`,
          text: 'Check out this cool voice effect!',
          files: [file]
        });
      } catch (error) {
        console.error('Error sharing:', error);
        downloadAudio();
      }
    } else {
      downloadAudio();
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setAudioBlob(null);
  };

  useEffect(() => {
    return () => {
      if (previewMode) {
        stopPreview();
      }
    };
  }, [previewMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Voice Effects</h1>
        <p className="text-blue-200">Transform your voice with amazing effects</p>
      </div>

      {/* Controls */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-md mb-8">
        {/* Effect Selection */}
        <div className="mb-6">
          <label className="block text-white text-sm font-medium mb-3">Voice Effect</label>
          <select 
            value={selectedEffect} 
            onChange={(e) => setSelectedEffect(e.target.value)}
            className="w-full custom-select"
          >
            {voiceEffects.map(effect => (
              <option key={effect.id} value={effect.id}>
                {effect.name} - {effect.description}
              </option>
            ))}
          </select>
        </div>

        {/* Effect Intensity */}
        <div className="mb-6">
          <label className="block text-white text-sm font-medium mb-3">
            Effect Amount: {effectIntensity}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={effectIntensity}
            onChange={(e) => setEffectIntensity(e.target.value)}
            className="w-full slider"
          />
          <div className="flex justify-between text-xs text-white/70 mt-2">
            <span>Original Voice</span>
            <span>Full Effect</span>
          </div>
        </div>

        {/* Preview Toggle */}
        <div className="mb-4">
          <button
            onClick={togglePreview}
            className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
              previewMode 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
            }`}
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {previewMode ? 'Stop Preview' : 'Preview Effect'}
          </button>
          {previewMode && (
            <p className="text-white/80 text-xs mt-2 text-center">
              Speak into your microphone to hear the effect
            </p>
          )}
        </div>
      </div>

      {/* Record Button */}
      <button
        onClick={handleRecordClick}
        className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isRecording ? (
          <MicOff className="w-12 h-12 text-white" />
        ) : (
          <Mic className="w-12 h-12 text-white" />
        )}
      </button>

      <p className="text-white/80 mt-4 text-center">
        {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
      </p>

      {/* Modal */}
      {showModal && audioBlob && (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Voice Effect</h2>
            
            {/* Audio Player */}
            <audio 
              controls 
              src={URL.createObjectURL(audioBlob)}
              className="w-full mb-6"
            />

            <div className="text-sm text-gray-600 mb-6">
              <p>Effect: {voiceEffects.find(e => e.id === selectedEffect)?.name}</p>
              <p>Amount: {effectIntensity}%</p>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-3">
              <button
                onClick={downloadAudio}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={shareAudio}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Instructions */}
      <div className="text-center mt-8 text-white/60 text-sm">
        <p>Add to home screen for quick access!</p>
      </div>
    </div>
  );
};

function App() {
  return <VoiceEffectsApp />;
}

export default App;