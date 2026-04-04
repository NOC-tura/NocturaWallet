type NetInfoStateType = 'wifi' | 'cellular' | 'none' | 'unknown';

interface NetInfoState {
  type: NetInfoStateType;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

type Listener = (state: NetInfoState) => void;

let _currentState: NetInfoState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
};

const _listeners: Set<Listener> = new Set();

const NetInfo = {
  fetch: jest.fn(() => Promise.resolve(_currentState)),

  addEventListener: jest.fn((listener: Listener) => {
    _listeners.add(listener);
    // Immediately fire with current state (matches real behavior)
    listener(_currentState);
    return () => {
      _listeners.delete(listener);
    };
  }),

  // Test helper — not part of real API
  __setMockState(state: Partial<NetInfoState>) {
    _currentState = {..._currentState, ...state};
    _listeners.forEach(l => l(_currentState));
  },

  // Test helper — reset between tests
  __reset() {
    _currentState = {type: 'wifi', isConnected: true, isInternetReachable: true};
    _listeners.clear();
    NetInfo.fetch.mockClear();
    NetInfo.addEventListener.mockClear();
  },
};

export default NetInfo;
