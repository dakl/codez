// ============================================================
// YTP Glitch Audio for Codez — SuperCollider NRT Score
// Renders a 30-second glitchy soundtrack to WAV
// ============================================================

(
// Use environment vars (~) for pipe compatibility
~server = Server(\nrt,
	options: ServerOptions.new
	.numOutputBusChannels_(2)
	.numInputBusChannels_(0)
	.sampleRate_(48000)
);

~score = Score.new;
~nodeId = 1000;
~nextId = { ~nodeId = ~nodeId + 1; ~nodeId };

// --- SynthDefs ---

~bassStab = SynthDef(\bassStab, { |out, freq = 80, amp = 0.5, dur = 0.15|
	var env = EnvGen.kr(Env.perc(0.005, dur, amp), doneAction: 2);
	var sig = (SinOsc.ar(freq) + Pulse.ar(freq * 0.99, 0.3, 0.3)).distort;
	sig = sig * env;
	Out.ar(out, sig.dup);
}).asBytes;

~noiseBurst = SynthDef(\noiseBurst, { |out, amp = 0.4, dur = 0.1, bits = 4, rate = 8000|
	var env = EnvGen.kr(Env.perc(0.001, dur, amp), doneAction: 2);
	var sig = WhiteNoise.ar;
	// Bitcrushing without sc3-plugins: sample-rate reduction + bit depth reduction
	var steps = (2 ** bits);
	sig = Latch.ar(sig, Impulse.ar(rate));
	sig = (sig * steps).round / steps;
	sig = sig * env;
	Out.ar(out, sig.dup);
}).asBytes;

~glitchTone = SynthDef(\glitchTone, { |out, freq = 440, amp = 0.3, dur = 0.2|
	var env = EnvGen.kr(Env.perc(0.002, dur, amp), doneAction: 2);
	var mod = LFNoise0.kr(30).range(0.5, 2);
	var sig = Saw.ar(freq * mod) + Pulse.ar(freq * mod * 1.01, LFNoise2.kr(15).range(0.1, 0.9), 0.4);
	sig = (sig * 2).clip2(0.8) * env;
	Out.ar(out, sig.dup);
}).asBytes;

~stutter = SynthDef(\stutter, { |out, freq = 200, amp = 0.35, dur = 0.3|
	var env = EnvGen.kr(Env.perc(0.001, dur, amp), doneAction: 2);
	var sig = SinOsc.ar(freq);
	sig = Latch.ar(sig, Impulse.ar(LFNoise0.kr(20).range(100, 4000)));
	sig = sig * env;
	Out.ar(out, sig.dup);
}).asBytes;

~sweep = SynthDef(\sweep, { |out, startFreq = 100, endFreq = 2000, amp = 0.3, dur = 0.5|
	var env = EnvGen.kr(Env.perc(0.01, dur, amp), doneAction: 2);
	var freq = XLine.kr(startFreq, endFreq, dur);
	var sig = Saw.ar(freq) * env;
	Out.ar(out, sig.dup);
}).asBytes;

~kick = SynthDef(\kick, { |out, amp = 0.6|
	var env = EnvGen.kr(Env.perc(0.005, 0.3, amp), doneAction: 2);
	var fenv = EnvGen.kr(Env.perc(0.001, 0.08), levelScale: 300, levelBias: 40);
	var sig = SinOsc.ar(fenv) * env;
	Out.ar(out, sig.dup);
}).asBytes;

~laser = SynthDef(\laser, { |out, amp = 0.3, dur = 0.15|
	var env = EnvGen.kr(Env.perc(0.001, dur, amp), doneAction: 2);
	var freq = XLine.kr(3000, 100, dur);
	var sig = Pulse.ar(freq, 0.5) * env;
	Out.ar(out, sig.dup);
}).asBytes;

~staticNoise = SynthDef(\staticNoise, { |out, amp = 0.2, dur = 0.5|
	var env = EnvGen.kr(Env.linen(0.01, dur - 0.02, 0.01, amp), doneAction: 2);
	var sig = Dust2.ar(8000) * 0.5 + (Crackle.ar(1.95) * 0.3);
	sig = sig * env;
	Out.ar(out, sig.dup);
}).asBytes;

// Register SynthDefs at time 0
~score.add([0.0, ['/d_recv', ~bassStab]]);
~score.add([0.0, ['/d_recv', ~noiseBurst]]);
~score.add([0.0, ['/d_recv', ~glitchTone]]);
~score.add([0.0, ['/d_recv', ~stutter]]);
~score.add([0.0, ['/d_recv', ~sweep]]);
~score.add([0.0, ['/d_recv', ~kick]]);
~score.add([0.0, ['/d_recv', ~laser]]);
~score.add([0.0, ['/d_recv', ~staticNoise]]);

// --- Timeline (timed to make-ytp.sh video cuts) ---

// == Intro title (0.0 - 1.88s) ==
~score.add([0.0,  [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.7]]);
~score.add([0.0,  [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 50, \endFreq, 800, \dur, 0.8, \amp, 0.25]]);
~score.add([0.8,  [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.5, \bits, 3]]);
~score.add([0.86, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 300, \dur, 0.3, \amp, 0.25]]);
~score.add([1.16, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.15, \amp, 0.3]]);
~score.add([1.31, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.4, \bits, 2]]);
~score.add([1.39, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 60, \dur, 0.5, \amp, 0.4]]);

// == Logo montage (1.88 - 2.88s) ==
~score.add([1.88, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 150, \dur, 0.12, \amp, 0.3]]);
~score.add([2.00, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.25]]);
~score.add([2.08, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.1, \amp, 0.35, \bits, 4]]);
~score.add([2.18, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.5]]);
~score.add([2.22, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 500, \dur, 0.06, \amp, 0.3]]);
~score.add([2.28, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 300, \dur, 0.12, \amp, 0.25]]);
~score.add([2.40, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.4, \bits, 2]]);
~score.add([2.58, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 80, \dur, 0.3, \amp, 0.35]]);

// == Agents section (2.88 - 4.38s) ==
~score.add([2.88, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.6]]);
~score.add([2.88, [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 200, \endFreq, 1500, \dur, 0.7, \amp, 0.2]]);
~score.add([3.58, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.12, \amp, 0.35, \bits, 5]]);
~score.add([3.70, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 400, \dur, 0.06, \amp, 0.3]]);
~score.add([3.76, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 100, \dur, 0.5, \amp, 0.3]]);
~score.add([4.26, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.25]]);
~score.add([4.34, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 250, \dur, 0.04, \amp, 0.3]]);

// == Terminal section (4.38 - 7.08s) ==
~score.add([4.38, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.5]]);
~score.add([4.38, [\s_new, \staticNoise, ~nextId.(), 0, 1, \dur, 1.2, \amp, 0.1]]);
~score.add([4.6,  [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.15, \bits, 8, \rate, 4000]]);
~score.add([4.75, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.15, \bits, 8, \rate, 4000]]);
~score.add([4.9,  [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.15, \bits, 8, \rate, 4000]]);
~score.add([5.05, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.15, \bits, 8, \rate, 4000]]);
~score.add([5.2,  [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.15, \bits, 8, \rate, 4000]]);
~score.add([5.58, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 600, \dur, 0.15, \amp, 0.2]]);
~score.add([5.73, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.05, \amp, 0.5, \bits, 2]]);
~score.add([5.78, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 400, \dur, 0.1, \amp, 0.25]]);
~score.add([5.88, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 70, \dur, 0.4, \amp, 0.3]]);
~score.add([6.68, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.1, \amp, 0.2]]);

// == Worktrees section (7.08 - 8.36s) ==
~score.add([7.08, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.6]]);
~score.add([7.08, [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 100, \endFreq, 600, \dur, 0.6, \amp, 0.2]]);
~score.add([7.68, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.1, \amp, 0.3, \bits, 3]]);
~score.add([7.76, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 200, \dur, 0.08, \amp, 0.25]]);
~score.add([7.84, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 90, \dur, 0.5, \amp, 0.35]]);
~score.add([8.28, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.3, \bits, 4]]);
~score.add([8.32, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.04, \amp, 0.2]]);

// == Session section (8.36 - 10.15s) ==
~score.add([8.36, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.55]]);
~score.add([8.36, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 350, \dur, 0.9, \amp, 0.15]]);
~score.add([9.26, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.12, \amp, 0.35, \bits, 3]]);
~score.add([9.38, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 500, \dur, 0.08, \amp, 0.25]]);
~score.add([9.86, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.5, \bits, 2]]);
~score.add([9.89, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.3]]);

// == Multi-agent section (10.15 - 11.47s) ==
~score.add([10.15, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.5]]);
~score.add([10.15, [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 2000, \endFreq, 100, \dur, 0.7, \amp, 0.2]]);
~score.add([10.85, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.1, \amp, 0.3, \bits, 4]]);
~score.add([10.95, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 180, \dur, 0.06, \amp, 0.25]]);
~score.add([11.01, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 700, \dur, 0.4, \amp, 0.2]]);
~score.add([11.39, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.2]]);

// == Keyboard section (11.47 - 12.7s) ==
~score.add([11.47, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.6]]);
~score.add([11.47, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 65, \dur, 0.6, \amp, 0.35]]);
~score.add([12.07, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.3, \bits, 3]]);
~score.add([12.12, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 450, \dur, 0.05, \amp, 0.25]]);
~score.add([12.20, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 350, \dur, 0.5, \amp, 0.2]]);

// == Desktop section (12.7 - 14.18s) ==
~score.add([12.7,  [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.55]]);
~score.add([12.7,  [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 150, \endFreq, 1000, \dur, 0.8, \amp, 0.2]]);
~score.add([13.5,  [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.1, \amp, 0.3, \bits, 4]]);
~score.add([13.6,  [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.25]]);
~score.add([14.1,  [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.04, \amp, 0.5, \bits, 2]]);

// == Stack section (14.18 - 15.76s) ==
~score.add([14.18, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.6]]);
~score.add([14.18, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 250, \dur, 0.8, \amp, 0.15]]);
~score.add([14.98, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 600, \dur, 0.12, \amp, 0.25]]);
~score.add([15.10, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.3, \bits, 3]]);
~score.add([15.16, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 80, \dur, 0.5, \amp, 0.3]]);
~score.add([15.68, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.2]]);

// == macOS section (15.76 - 16.84s) ==
~score.add([15.76, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.5]]);
~score.add([15.76, [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 500, \endFreq, 200, \dur, 0.6, \amp, 0.2]]);
~score.add([16.36, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.3, \bits, 5]]);
~score.add([16.44, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 380, \dur, 0.4, \amp, 0.2]]);

// == Rapid-fire logo montage (16.84 - 17.24s) ==
~score.add([16.84, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.7]]);
~score.add([16.84, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.4, \bits, 2]]);
~score.add([16.90, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.05, \amp, 0.35]]);
~score.add([16.95, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 800, \dur, 0.04, \amp, 0.3]]);
~score.add([16.99, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.04, \amp, 0.45, \bits, 3]]);
~score.add([17.03, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 1000, \dur, 0.03, \amp, 0.3]]);
~score.add([17.06, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.3]]);
~score.add([17.09, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.4, \bits, 2]]);
~score.add([17.12, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.5]]);
~score.add([17.15, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 1200, \dur, 0.03, \amp, 0.3]]);
~score.add([17.18, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.06, \amp, 0.5, \bits, 2]]);
~score.add([17.21, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.03, \amp, 0.3]]);

// == Glitch montage (17.24 - 17.55s) ==
~score.add([17.24, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.08, \amp, 0.35, \bits, 3]]);
~score.add([17.30, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 500, \dur, 0.06, \amp, 0.3]]);
~score.add([17.36, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 600, \dur, 0.05, \amp, 0.25]]);
~score.add([17.41, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.04, \amp, 0.3]]);
~score.add([17.45, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.04, \amp, 0.4, \bits, 2]]);
~score.add([17.49, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.5]]);
~score.add([17.52, [\s_new, \stutter, ~nextId.(), 0, 1, \freq, 900, \dur, 0.03, \amp, 0.25]]);

// == Outro title (17.55 - 20.24s) ==
~score.add([17.55, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.7]]);
~score.add([17.55, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 50, \dur, 1.0, \amp, 0.4]]);
~score.add([17.55, [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 2000, \endFreq, 50, \dur, 1.0, \amp, 0.15]]);
~score.add([18.55, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.15, \amp, 0.35, \bits, 3]]);
~score.add([18.70, [\s_new, \laser, ~nextId.(), 0, 1, \dur, 0.04, \amp, 0.3]]);
~score.add([18.74, [\s_new, \glitchTone, ~nextId.(), 0, 1, \freq, 200, \dur, 1.5, \amp, 0.1]]);
~score.add([18.74, [\s_new, \staticNoise, ~nextId.(), 0, 1, \dur, 1.5, \amp, 0.05]]);

// == Outro logo (20.24 - 22.15s) ==
~score.add([20.24, [\s_new, \kick, ~nextId.(), 0, 1, \amp, 0.6]]);
~score.add([20.24, [\s_new, \bassStab, ~nextId.(), 0, 1, \freq, 60, \dur, 0.8, \amp, 0.3]]);
~score.add([21.04, [\s_new, \noiseBurst, ~nextId.(), 0, 1, \dur, 0.1, \amp, 0.2, \bits, 5]]);
~score.add([21.14, [\s_new, \sweep, ~nextId.(), 0, 1, \startFreq, 300, \endFreq, 50, \dur, 1.0, \amp, 0.15]]);

// Subtle tail
~score.add([22.0,  [\s_new, \staticNoise, ~nextId.(), 0, 1, \dur, 8.0, \amp, 0.03]]);

// End marker
~score.add([30.0, [0]]);

// --- Render ---
~score.sort;

~oscPath = "/tmp/codez-ytp-score.osc"; ~outPath = "/tmp/codez-ytp-audio.wav";

"Writing OSC score...".postln; ~score.writeOSCFile(~oscPath); "Score written.".postln;

// Call scsynth NRT directly — build cmd on one line so pipe mode evaluates it together
~cmd = "/Applications/SuperCollider.app/Contents/Resources/scsynth -N /tmp/codez-ytp-score.osc _ /tmp/codez-ytp-audio.wav 48000 wav int24 -o 2"; ("Running: " ++ ~cmd).postln; ~cmd.systemCmd;

"Done! Rendered /tmp/codez-ytp-audio.wav".postln; ~server.remove; 0.exit;
)
