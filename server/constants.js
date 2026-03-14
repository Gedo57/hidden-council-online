export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const ROOM_CODE_LENGTH = 6;
export const LIBERAL_POLICIES_TO_WIN = 5;
export const SHADOW_POLICIES_TO_WIN = 6;
export const ELECTION_TRACKER_LIMIT = 3;

export const GAME_PHASES = {
  LOBBY: 'lobby',
  NOMINATION: 'nomination',
  VOTING: 'voting',
  LEGISLATIVE_PRESIDENT: 'legislative_president',
  LEGISLATIVE_CHANCELLOR: 'legislative_chancellor',
  PRESIDENT_POWER: 'president_power',
  GAME_OVER: 'game_over'
};

export const POLICY_TYPES = {
  LIBERAL: 'liberal',
  SHADOW: 'shadow'
};

export const TEAM_TYPES = {
  LIBERAL: 'council',
  SHADOW: 'shadow'
};

export const ROLE_TYPES = {
  COUNCIL: 'Council Member',
  SHADOW: 'Shadow Agent',
  SUPREME_SHADOW: 'Supreme Shadow'
};
