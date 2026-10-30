import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as ImagePicker from 'expo-image-picker';
import HelpRoute from '../../../app/help';
import VaultRoute from '../../../app/vault';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { listItems } from '../vaultRepo';

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

function renderVault() {
  return renderRouter(
    { _layout: layoutWithSession(fakeSession({ db })), vault: VaultRoute, help: HelpRoute },
    { initialUrl: '/vault' },
  );
}

describe('reasons vault screen', () => {
  it('adds and deletes a text reason', async () => {
    await renderVault();
    await fireEvent.changeText(await screen.findByTestId('vault-text-input'), 'My garden');
    await fireEvent.press(screen.getByTestId('vault-add-text'));
    expect(await screen.findByText('My garden')).toBeOnTheScreen();

    const [item] = await listItems(db);
    await fireEvent.press(screen.getByTestId(`vault-delete-${item.id}`));
    await fireEvent.press(screen.getByTestId(`vault-delete-confirm-${item.id}`));
    expect(screen.queryByText('My garden')).toBeNull();
    expect(await listItems(db)).toEqual([]);
  });

  it('adds a photo from the library', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'x', width: 1, height: 1, base64: 'AQID', mimeType: 'image/jpeg' }],
    } as ImagePicker.ImagePickerResult);
    await renderVault();
    await fireEvent.press(await screen.findByTestId('vault-add-photo'));
    expect(await screen.findByTestId(/^vault-photo-/)).toBeOnTheScreen();
    expect((await listItems(db))[0]).toMatchObject({ kind: 'photo', mime: 'image/jpeg' });
  });

  it('explains when a photo is too large', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'x', width: 1, height: 1, base64: 'A'.repeat(4_000_000), mimeType: 'image/jpeg' },
      ],
    } as ImagePicker.ImagePickerResult);
    await renderVault();
    await fireEvent.press(await screen.findByTestId('vault-add-photo'));
    expect(await screen.findByText(/too large/i)).toBeOnTheScreen();
    expect(await listItems(db)).toEqual([]);
  });

  it('crisis words in a reason open help', async () => {
    await renderVault();
    await fireEvent.changeText(await screen.findByTestId('vault-text-input'), 'I want to die');
    expect(await screen.findByTestId('crisis-message')).toBeOnTheScreen();
  });
});
