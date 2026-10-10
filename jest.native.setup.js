// Worklets has no native runtime under Jest; its own mock stands in. Reanimated
// itself stays REAL (only switched to test mode), so a test renders through
// the same AnimatedComponent style handling as a phone.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
require('react-native-reanimated').setUpTests();

// Native modules with no Jest implementation of their own.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Components read translations; English keeps assertions readable.
require('@nouzl/i18n').initI18n('en');
