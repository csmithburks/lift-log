export const colors = {
  bg: '#0E0F12',
  card: '#181A1F',
  cardAlt: '#20232A',
  border: '#2A2E37',
  text: '#F2F3F5',
  muted: '#8B909C',
  accent: '#3B82F6',
  accentDim: '#1E3A64',
  success: '#22C55E',
  successDim: '#14532D',
  danger: '#EF4444',
  gold: '#F5B83D',
  warmup: '#F59E0B',
  drop: '#A78BFA',
  failure: '#F87171',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16 };

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'];
export const SET_TYPE_LABEL = { warmup: 'W', drop: 'D', failure: 'F' };
export const SET_TYPE_COLOR = {
  warmup: colors.warmup,
  drop: colors.drop,
  failure: colors.failure,
};
