const DISCLAIMER =
  'These are visual observations from detected facial landmarks and expression blendshapes. They are not a psychological diagnosis and cannot determine a person’s true emotional state with certainty.';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function blendMap(blendshapes) {
  const categories = blendshapes?.[0]?.categories || [];
  const map = {};
  categories.forEach((item) => {
    map[item.categoryName] = Number(item.score) || 0;
  });
  return map;
}

function meanOf(map, keys) {
  if (!keys.length) return 0;
  return keys.reduce((sum, key) => sum + (Number(map[key]) || 0), 0) / keys.length;
}

export function eulerFromMatrix(data) {
  if (!data || data.length < 16) return { yaw: 0, pitch: 0, roll: 0 };
  const r00 = data[0];
  const r10 = data[1];
  const r20 = data[2];
  const r21 = data[6];
  const r22 = data[10];
  const yaw = Math.atan2(r10, r00) * (180 / Math.PI);
  const pitch = Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10)) * (180 / Math.PI);
  const roll = Math.atan2(r21, r22) * (180 / Math.PI);
  return { yaw, pitch, roll };
}

export function classifyExpression(map) {
  const smile = meanOf(map, ['mouthSmileLeft', 'mouthSmileRight']);
  const frown = meanOf(map, ['mouthFrownLeft', 'mouthFrownRight']);
  const browDown = meanOf(map, ['browDownLeft', 'browDownRight']);
  const browInner = map.browInnerUp || 0;
  const press = meanOf(map, ['mouthPressLeft', 'mouthPressRight']);
  const stretch = meanOf(map, ['mouthStretchLeft', 'mouthStretchRight']);
  if (smile >= 0.28 && smile > frown + 0.06) return 'smiling';
  if (browDown >= 0.22 || press >= 0.26 || stretch >= 0.34 || (frown >= 0.18 && browInner >= 0.22)) {
    return 'stressed';
  }
  return 'neutral';
}

function blinkOpen(map) {
  return meanOf(map, ['eyeBlinkLeft', 'eyeBlinkRight']);
}

function classifyGaze(gazeX, gazeY, pose, blink) {
  const yaw = pose.yaw || 0;
  const pitch = pose.pitch || 0;
  const roll = pose.roll || 0;
  const eyesOff = Math.abs(gazeX) > 0.34 || Math.abs(gazeY) > 0.4;
  const headOff = Math.abs(yaw) > 20 || Math.abs(pitch) > 18 || Math.abs(roll) > 24;
  const lookingAtCamera = blink < 0.6 && !eyesOff && !headOff;
  let direction = 'center';
  if (Math.abs(gazeX) >= Math.abs(gazeY) && Math.abs(gazeX) > 0.22) direction = gazeX > 0 ? 'right' : 'left';
  else if (Math.abs(gazeY) > 0.24) direction = gazeY > 0 ? 'down' : 'up';
  if (Math.abs(yaw) > 16 && direction === 'center') direction = yaw > 0 ? 'right' : 'left';
  const alignedOff =
    (direction === 'left' && yaw < -12) ||
    (direction === 'right' && yaw > 12) ||
    (direction === 'down' && pitch > 10) ||
    (direction === 'up' && pitch < -12);
  const combinedOffScreen = blink < 0.6 && eyesOff && headOff && alignedOff;
  return { gazeX, gazeY, yaw, pitch, roll, blink, lookingAtCamera, direction, eyesOff, headOff, combinedOffScreen };
}

export function estimateGazeAndHead(map, pose) {
  const lookInL = map.eyeLookInLeft || 0;
  const lookOutL = map.eyeLookOutLeft || 0;
  const lookInR = map.eyeLookInRight || 0;
  const lookOutR = map.eyeLookOutRight || 0;
  const lookUp = meanOf(map, ['eyeLookUpLeft', 'eyeLookUpRight']);
  const lookDown = meanOf(map, ['eyeLookDownLeft', 'eyeLookDownRight']);
  const gazeX = (lookOutL - lookInL + lookInR - lookOutR) / 2;
  const gazeY = lookDown - lookUp;
  return classifyGaze(gazeX, gazeY, pose, blinkOpen(map));
}

function headBand(std) {
  if (std < 6) return 'low';
  if (std < 14) return 'moderate';
  return 'high';
}

export class FaceSignalAggregator {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = 0;
    this.faces = 0;
    this.lookingAway = 0;
    this.blinks = 0;
    this.blinking = false;
    this.lastExpression = 'none';
    this.lastFacing = false;
    this.lastFaceVisible = false;
    this.startedAt = 0;
    this.lastAt = 0;
    this.expressions = { smiling: 0, neutral: 0, stressed: 0 };
    this.smooth = { yaw: 0, pitch: 0, roll: 0, gazeX: 0, gazeY: 0, onCamera: 1, combinedOff: 0 };
    this.attentionState = 'NORMAL';
    this.offSince = 0;
    this.onSince = 0;
    this.offScreenEvents = 0;
    this.offScreenMs = 0;
    this.attentionWarnings = 0;
    this.faceMissingEvents = 0;
    this.prevFaceVisible = false;
    this.attentionSamples = 0;
    this.onCameraSamples = 0;
    this.lastGaze = { gazeX: 0, gazeY: 0, yaw: 0, pitch: 0, roll: 0, direction: 'center' };
    this.sums = {
      smile: 0,
      frown: 0,
      browDown: 0,
      browInner: 0,
      press: 0,
      stretch: 0,
      jaw: 0,
      blink: 0,
      yaw: 0,
      yaw2: 0,
      pitch: 0,
      pitch2: 0,
      look: 0,
    };
  }

  addFrame(result, now = Date.now()) {
    this.frames += 1;
    if (!this.startedAt) this.startedAt = now;
    this.lastAt = now;
    const face = result?.faceLandmarks?.[0];
    if (!face) {
      this.lastExpression = 'none';
      this.lastFacing = false;
      this.lastFaceVisible = false;
      if (this.prevFaceVisible) this.faceMissingEvents += 1;
      this.prevFaceVisible = false;
      this.offSince = 0;
      this.onSince = 0;
      this.smooth.combinedOff *= 0.5;
      this.attentionState = this.attentionState === 'ATTENTION_WARNING' ? 'ATTENTION_WARNING' : 'NORMAL';
      return null;
    }

    this.faces += 1;
    this.lastFaceVisible = true;
    this.prevFaceVisible = true;
    const map = blendMap(result.faceBlendshapes);
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    const pose = eulerFromMatrix(matrix);
    const gaze = estimateGazeAndHead(map, pose);
    const a = 0.22;
    this.smooth.yaw = this.smooth.yaw * (1 - a) + gaze.yaw * a;
    this.smooth.pitch = this.smooth.pitch * (1 - a) + gaze.pitch * a;
    this.smooth.roll = this.smooth.roll * (1 - a) + gaze.roll * a;
    this.smooth.gazeX = this.smooth.gazeX * (1 - a) + gaze.gazeX * a;
    this.smooth.gazeY = this.smooth.gazeY * (1 - a) + gaze.gazeY * a;
    const stableGaze = classifyGaze(
      this.smooth.gazeX,
      this.smooth.gazeY,
      { yaw: this.smooth.yaw, pitch: this.smooth.pitch, roll: this.smooth.roll },
      gaze.blink
    );
    const lookingAtCamera = stableGaze.lookingAtCamera;
    this.smooth.onCamera = this.smooth.onCamera * 0.8 + (lookingAtCamera ? 1 : 0) * 0.2;
    this.smooth.combinedOff = this.smooth.combinedOff * 0.82 + (stableGaze.combinedOffScreen ? 1 : 0) * 0.18;
    const onCamera = this.smooth.onCamera >= 0.48 && this.smooth.combinedOff < 0.45;
    const offScreen = this.smooth.combinedOff >= 0.52;
    this.lastGaze = {
      gazeX: round(this.smooth.gazeX, 3),
      gazeY: round(this.smooth.gazeY, 3),
      yaw: round(this.smooth.yaw, 1),
      pitch: round(this.smooth.pitch, 1),
      roll: round(this.smooth.roll, 1),
      direction: stableGaze.direction,
    };
    const attentionEvent = this.updateAttention(onCamera, offScreen, now);

    const expression = classifyExpression(map);
    this.lastExpression = expression;
    this.lastFacing = onCamera;
    this.expressions[expression] += 1;

    const smile = meanOf(map, ['mouthSmileLeft', 'mouthSmileRight']);
    const frown = meanOf(map, ['mouthFrownLeft', 'mouthFrownRight']);
    const browDown = meanOf(map, ['browDownLeft', 'browDownRight']);
    const press = meanOf(map, ['mouthPressLeft', 'mouthPressRight']);
    const stretch = meanOf(map, ['mouthStretchLeft', 'mouthStretchRight']);
    const blink = blinkOpen(map);
    const look = Math.max(
      meanOf(map, ['eyeLookOutLeft', 'eyeLookOutRight']),
      meanOf(map, ['eyeLookInLeft', 'eyeLookInRight']),
      meanOf(map, ['eyeLookUpLeft', 'eyeLookUpRight']),
      meanOf(map, ['eyeLookDownLeft', 'eyeLookDownRight'])
    );

    this.sums.smile += smile;
    this.sums.frown += frown;
    this.sums.browDown += browDown;
    this.sums.browInner += map.browInnerUp || 0;
    this.sums.press += press;
    this.sums.stretch += stretch;
    this.sums.jaw += map.jawOpen || 0;
    this.sums.blink += blink;
    this.sums.yaw += pose.yaw;
    this.sums.yaw2 += pose.yaw * pose.yaw;
    this.sums.pitch += pose.pitch;
    this.sums.pitch2 += pose.pitch * pose.pitch;
    this.sums.look += look;

    if (!onCamera) this.lookingAway += 1;
    if (blink >= 0.5 && !this.blinking) {
      this.blinks += 1;
      this.blinking = true;
    } else if (blink < 0.28) {
      this.blinking = false;
    }
    return attentionEvent;
  }

  updateAttention(onCamera, offScreen, now) {
    this.attentionSamples += 1;
    if (onCamera && !offScreen) {
      this.onCameraSamples += 1;
      this.onSince = this.onSince || now;
      if (this.offSince) {
        const dur = now - this.offSince;
        if (dur >= 2500) {
          this.offScreenEvents += 1;
          this.offScreenMs += dur;
        }
        this.offSince = 0;
      }
      if (now - this.onSince >= 700 && this.attentionState !== 'NORMAL') {
        const wasWarning = this.attentionState === 'ATTENTION_WARNING' || this.attentionState === 'OFF_SCREEN_SUSPECTED';
        this.attentionState = 'NORMAL';
        return wasWarning ? 'recovered' : null;
      }
      return null;
    }

    if (!offScreen) {
      return null;
    }

    this.onSince = 0;
    if (!this.offSince) this.offSince = now;
    const away = now - this.offSince;
    if (away >= 1600 && this.attentionState === 'NORMAL') {
      this.attentionState = 'OFF_SCREEN_SUSPECTED';
    }
    if (away >= 3800 && this.attentionState !== 'ATTENTION_WARNING') {
      this.attentionState = 'ATTENTION_WARNING';
      this.attentionWarnings += 1;
      return 'warning';
    }
    return null;
  }

  acknowledgeAttentionWarning() {
    if (this.attentionState === 'ATTENTION_WARNING') {
      this.attentionState = 'OFF_SCREEN_SUSPECTED';
      this.offSince = Date.now();
    }
  }

  livePreview() {
    return {
      ready: this.frames > 0,
      faceVisible: this.lastFaceVisible,
      expression: this.lastFaceVisible ? this.lastExpression : 'none',
      facingCamera: this.lastFaceVisible && this.lastFacing,
      attentionState: this.attentionState,
      gazeDirection: this.lastGaze.direction,
    };
  }

  finalize() {
    const durationSec = Math.max(0, (this.lastAt - this.startedAt) / 1000);
    if (this.offSince) {
      const dur = this.lastAt - this.offSince;
      if (dur >= 2500) {
        this.offScreenEvents += 1;
        this.offScreenMs += dur;
      }
      this.offSince = 0;
    }
    if (this.faces < 20) {
      return {
        available: false,
        engine: 'mediapipe-face-landmarker',
        sampleCount: this.frames,
        faceSamples: this.faces,
        durationSec: round(durationSec, 1),
        summary:
          this.frames === 0
            ? 'Visual analysis did not run for this session.'
            : 'Not enough visible face samples were captured to summarize facial behavior.',
        disclaimer: DISCLAIMER,
      };
    }

    const n = this.faces;
    const mean = (key) => this.sums[key] / n;
    const std = (key, key2) => {
      const m = mean(key);
      return Math.sqrt(Math.max(0, this.sums[key2] / n - m * m));
    };
    const faceVisiblePercent = round((this.faces / Math.max(1, this.frames)) * 100);
    const lookingAwayPercent = round((this.lookingAway / n) * 100);
    const facingCameraPercent = clamp(100 - lookingAwayPercent, 0, 100);
    const yawStd = std('yaw', 'yaw2');
    const pitchStd = std('pitch', 'pitch2');
    const headStd = (yawStd + pitchStd) / 2;
    const blinksPerMinute = durationSec > 0 ? (this.blinks / durationSec) * 60 : 0;
    const smile = mean('smile');
    const browDown = mean('browDown');
    const press = mean('press');
    const stretch = mean('stretch');
    const expressionShare = {
      smiling: round((this.expressions.smiling / n) * 100),
      neutral: round((this.expressions.neutral / n) * 100),
      stressed: round((this.expressions.stressed / n) * 100),
    };
    const dominantExpression = Object.entries(expressionShare).sort((a, b) => b[1] - a[1])[0][0];

    const presence = faceVisiblePercent / 100;
    const facing = facingCameraPercent / 100;
    const stability = 1 - clamp(headStd / 22, 0, 1);
    const blinkPenalty = clamp((blinksPerMinute - 22) / 40, 0, 1);
    const tensionVisual = clamp(browDown * 1.4 + press * 1.2 + stretch * 0.8, 0, 1);

    const visualConfidenceIndicator = clamp(
      round(
        100 * (0.3 * presence + 0.28 * facing + 0.16 * stability + 0.12 * smile + 0.14 * (1 - tensionVisual) - 0.08 * blinkPenalty)
      ),
      0,
      100
    );
    const visualNervousnessIndicator = clamp(
      round(
        100 *
          (0.26 * tensionVisual +
            0.22 * (lookingAwayPercent / 100) +
            0.18 * clamp(headStd / 20, 0, 1) +
            0.16 * blinkPenalty +
            0.1 * (1 - presence) +
            0.08 * (1 - smile))
      ),
      0,
      100
    );

    const attentionTowardCameraPercent = this.attentionSamples
      ? round((this.onCameraSamples / this.attentionSamples) * 100)
      : facingCameraPercent;
    const offScreenDurationSec = round(this.offScreenMs / 1000, 1);
    const attentionRiskIndicator = clamp(
      round(
        this.attentionWarnings * 18 +
          this.offScreenEvents * 10 +
          clamp(offScreenDurationSec / Math.max(durationSec, 1), 0, 1) * 35 +
          (100 - attentionTowardCameraPercent) * 0.25
      ),
      0,
      100
    );
    const cameraAttention = attentionTowardCameraPercent >= 80 ? 'Good' : attentionTowardCameraPercent >= 60 ? 'Fair' : 'Needs attention';

    const summary = [
      `Camera Attention: ${cameraAttention}.`,
      `Visual attention toward camera: ${attentionTowardCameraPercent}%.`,
      `Gaze-away: ${clamp(100 - attentionTowardCameraPercent, 0, 100)}%.`,
      `Face Visibility: ${faceVisiblePercent}%.`,
      `Off-screen Attention Events: ${this.offScreenEvents}.`,
      `Attention Warnings: ${this.attentionWarnings}.`,
      `Face-missing events: ${this.faceMissingEvents}.`,
      `Across ${this.faces} face samples (${durationSec >= 60 ? `${Math.round(durationSec / 60)} min` : `${Math.round(durationSec)}s`}), the most common visual expression class was ${dominantExpression} (${expressionShare[dominantExpression]}% of visible frames).`,
      `Visual composure indicator ${visualConfidenceIndicator}/100; visual tension indicator ${visualNervousnessIndicator}/100.`,
      'These are visual observations only and do not prove cheating or a psychological state.',
    ].join(' ');

    return {
      available: true,
      engine: 'mediapipe-face-landmarker',
      sampleCount: this.frames,
      faceSamples: this.faces,
      durationSec: round(durationSec, 1),
      faceVisiblePercent,
      dominantExpression,
      expressionShare,
      visualConfidenceIndicator,
      visualNervousnessIndicator,
      cameraAttention,
      attentionTowardCameraPercent,
      lookingAwayPercent: clamp(100 - attentionTowardCameraPercent, 0, 100),
      lookingTowardCamera: attentionTowardCameraPercent >= 60,
      headStability: headBand(headStd),
      attentionRiskIndicator,
      offScreenEvents: this.offScreenEvents,
      offScreenDurationSec,
      attentionWarnings: this.attentionWarnings,
      faceMissingEvents: this.faceMissingEvents,
      engagement: {
        facingCameraPercent: attentionTowardCameraPercent,
        lookingAwayPercent: clamp(100 - attentionTowardCameraPercent, 0, 100),
        blinksPerMinute: round(blinksPerMinute, 1),
        headMovement: headBand(headStd),
        headYawStd: round(yawStd, 1),
        headPitchStd: round(pitchStd, 1),
      },
      signals: {
        smile: round(smile, 3),
        frown: round(mean('frown'), 3),
        browFurrow: round(browDown, 3),
        innerBrowRaise: round(mean('browInner'), 3),
        lipPress: round(press, 3),
        mouthStretch: round(stretch, 3),
        jawOpen: round(mean('jaw'), 3),
        eyeBlink: round(mean('blink'), 3),
        eyeMovement: round(mean('look'), 3),
      },
      summary,
      disclaimer: DISCLAIMER,
    };
  }
}

export function expressionLabel(value) {
  if (value === 'smiling') return 'Smiling';
  if (value === 'stressed') return 'Stressed (visual)';
  if (value === 'neutral') return 'Neutral';
  return 'No face';
}
