import React from 'react';
import {render} from '@testing-library/react-native';
import {BackupSettingsScreen} from '../BackupSettingsScreen';

jest.mock('../../../modules/backup/backupModule', () => ({
  BackupManager: jest.fn().mockImplementation(() => ({
    isCloudBackupEnabled: jest.fn().mockReturnValue(false),
    lastCloudBackupAt: jest.fn().mockReturnValue(null),
    enableCloudBackup: jest.fn().mockResolvedValue(undefined),
    disableCloudBackup: jest.fn().mockResolvedValue(undefined),
    performCloudBackup: jest.fn().mockResolvedValue(undefined),
    exportToFile: jest.fn().mockResolvedValue(new Uint8Array(0)),
  })),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
}));

describe('BackupSettingsScreen', () => {
  it('renders cloud backup toggle', () => {
    const {getByTestId} = render(<BackupSettingsScreen />);
    expect(getByTestId('cloud-toggle')).toBeTruthy();
  });

  it('shows last backup as "Never" when null', () => {
    const {getByTestId} = render(<BackupSettingsScreen />);
    const el = getByTestId('last-backup');
    expect(el.props.children).toBe('Never');
  });

  it('shows "Force Backup Now" button', () => {
    const {getByTestId} = render(<BackupSettingsScreen />);
    expect(getByTestId('force-backup-button')).toBeTruthy();
  });

  it('shows "Export Encrypted Backup" button', () => {
    const {getByTestId} = render(<BackupSettingsScreen />);
    expect(getByTestId('export-button')).toBeTruthy();
  });

  it('screen renders without crashing', () => {
    expect(() => render(<BackupSettingsScreen />)).not.toThrow();
  });
});
