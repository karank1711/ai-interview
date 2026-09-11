function clamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function qualitativeLabel(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  return 'Needs Improvement';
}

function statusFromPercent(percent, invert = false) {
  const value = invert ? 100 - Number(percent || 0) : Number(percent || 0);
  if (value >= 85) return 'Excellent';
  if (value >= 70) return 'Good';
  if (value >= 50) return 'Moderate';
  return 'Needs Improvement';
}

function tone(status) {
  if (status === 'Excellent' || status === 'Good') return 'good';
  if (status === 'Moderate') return 'fair';
  return 'poor';
}

export function getFriendlyVisualCards(visual) {
  if (!visual || visual.available === false) {
    return {
      available: false,
      cards: [],
      disclaimer:
        'Visual observations from the camera only. These are not a psychological diagnosis.',
    };
  }
  const attention = clamp(
    visual.attentionTowardCameraPercent ?? visual.engagement?.facingCameraPercent ?? 0
  );
  const face = clamp(visual.faceVisiblePercent ?? 0);
  const lookingAway = clamp(
    visual.lookingAwayPercent ??
      visual.engagement?.lookingAwayPercent ??
      Math.max(0, 100 - attention)
  );
  const awayFromScreen = clamp(100 - attention);

  const attentionStatus = statusFromPercent(attention);
  const faceStatus = statusFromPercent(face);
  const lookAwayStatus = statusFromPercent(lookingAway, true);
  const awayStatus = statusFromPercent(awayFromScreen, true);

  const cards = [
    {
      key: 'cameraAttention',
      label: 'Camera Attention',
      status: attentionStatus,
      tone: tone(attentionStatus),
      value: `${attention}%`,
      explanation:
        attentionStatus === 'Needs Improvement'
          ? 'Needs Improvement — Your gaze or head direction frequently moved away from the camera.'
          : attentionStatus === 'Moderate'
            ? 'Moderate — You looked toward the camera for part of the interview, with noticeable time looking away.'
            : 'Good — You maintained attention toward the camera for most of the interview.',
    },
    {
      key: 'faceVisibility',
      label: 'Face Visibility',
      status: faceStatus,
      tone: tone(faceStatus),
      value: `${face}%`,
      explanation:
        faceStatus === 'Needs Improvement'
          ? 'Needs Improvement — Your face was not visible to the camera for a large part of the interview.'
          : faceStatus === 'Moderate'
            ? 'Moderate — Your face was visible for much of the interview, with some gaps.'
            : 'Excellent — Your face was visible to the camera for almost the entire interview.',
    },
    {
      key: 'lookingAway',
      label: 'Looking Away',
      status: lookAwayStatus,
      tone: tone(lookAwayStatus),
      value: `${lookingAway}%`,
      explanation:
        lookingAway >= 40
          ? 'Needs Improvement — You frequently looked away from the camera.'
          : lookingAway >= 20
            ? 'Moderate — You looked away from the camera several times.'
            : 'Good — You rarely looked away from the camera.',
    },
    {
      key: 'attentionAway',
      label: 'Attention Away From Screen',
      status: awayStatus,
      tone: tone(awayStatus),
      value: `${awayFromScreen}%`,
      explanation:
        awayFromScreen >= 40
          ? 'Needs Improvement — Visual attention was often away from the interview camera.'
          : awayFromScreen >= 20
            ? 'Moderate — Visual attention left the camera at times during the interview.'
            : 'Good — Your visual attention was mostly focused on the interview.',
    },
  ];

  return {
    available: true,
    cards,
    composure: visual.visualConfidenceIndicator,
    disclaimer:
      visual.disclaimer ||
      'These are visual attention indicators from the camera. They are not a psychological diagnosis and do not prove what you were looking at.',
  };
}
