const PREFIX = 'interviewiq-friend-ui:';

export const DEFAULT_FRIEND_UI = {
  simpleChatMode: false,
  coachName: 'AI Coach',
  quickActionsOpen: true,
};

function keyFor(userId) {
  return `${PREFIX}${userId || 'guest'}`;
}

export function readFriendUiPrefs(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(userId)) || 'null');
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_FRIEND_UI };
    return {
      simpleChatMode: Boolean(parsed.simpleChatMode),
      coachName: String(parsed.coachName || DEFAULT_FRIEND_UI.coachName).slice(0, 40) || DEFAULT_FRIEND_UI.coachName,
      quickActionsOpen: parsed.quickActionsOpen !== false,
    };
  } catch {
    return { ...DEFAULT_FRIEND_UI };
  }
}

export function writeFriendUiPrefs(userId, patch) {
  const next = { ...readFriendUiPrefs(userId), ...patch };
  next.coachName = String(next.coachName || DEFAULT_FRIEND_UI.coachName).trim().slice(0, 40) || DEFAULT_FRIEND_UI.coachName;
  next.simpleChatMode = Boolean(next.simpleChatMode);
  next.quickActionsOpen = Boolean(next.quickActionsOpen);
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}
