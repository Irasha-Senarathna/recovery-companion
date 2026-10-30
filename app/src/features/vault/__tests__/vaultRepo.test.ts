import { createTestDb } from '../../../test-utils/db';
import {
  addPhoto,
  addText,
  addVoice,
  deleteItem,
  getMedia,
  listItems,
  MAX_ITEMS,
  PHOTO_MAX_BYTES,
  randomItem,
  TEXT_MAX,
  VaultError,
  VOICE_MAX_BYTES,
  VOICE_MAX_MS,
} from '../vaultRepo';

const bytes = (size: number) => Uint8Array.from({ length: size }, (_, i) => i % 256);

async function expectVaultError(promise: Promise<unknown>, code: VaultError['code']) {
  await expect(promise).rejects.toBeInstanceOf(VaultError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('reasons vault', () => {
  it('stores text reasons', async () => {
    const db = await createTestDb();
    await addText(db, '  My daughter  ', 10);
    expect(await listItems(db)).toEqual([
      expect.objectContaining({ kind: 'text', text: 'My daughter', createdAt: 10 }),
    ]);
  });

  it('round-trips a photo as a BLOB inside the database', async () => {
    const db = await createTestDb();
    const photo = bytes(5000);
    const id = await addPhoto(db, photo, 'image/jpeg', 1);
    expect(await getMedia(db, id)).toEqual({ bytes: photo, mime: 'image/jpeg' });
  });

  it('round-trips a voice note with its length', async () => {
    const db = await createTestDb();
    const voice = bytes(2048);
    const id = await addVoice(db, voice, 'audio/mp4', 12_000, 1);
    expect(await getMedia(db, id)).toEqual({ bytes: voice, mime: 'audio/mp4' });
    expect((await listItems(db))[0]).toMatchObject({ kind: 'voice', durationMs: 12_000 });
  });

  it('lists items without loading their media', async () => {
    const db = await createTestDb();
    await addPhoto(db, bytes(100), 'image/png', 1);
    const [item] = await listItems(db);
    expect(item).not.toHaveProperty('data');
    expect(item).not.toHaveProperty('bytes');
  });

  it('enforces size and length limits', async () => {
    const db = await createTestDb();
    await expectVaultError(addText(db, '   ', 1), 'empty');
    await expectVaultError(addText(db, 'x'.repeat(TEXT_MAX + 1), 1), 'too_long');
    await expectVaultError(addPhoto(db, bytes(PHOTO_MAX_BYTES + 1), 'image/jpeg', 1), 'too_large');
    await expectVaultError(addPhoto(db, bytes(10), 'text/html', 1), 'bad_type');
    await expectVaultError(
      addVoice(db, bytes(VOICE_MAX_BYTES + 1), 'audio/mp4', 1000, 1),
      'too_large',
    );
    await expectVaultError(addVoice(db, bytes(10), 'audio/mp4', VOICE_MAX_MS + 1, 1), 'too_long');
    expect(await listItems(db)).toEqual([]);
  });

  it(`holds at most ${MAX_ITEMS} items`, async () => {
    const db = await createTestDb();
    for (let i = 0; i < MAX_ITEMS; i++) await addText(db, `reason ${i}`, i);
    await expectVaultError(addText(db, 'one more', 99), 'full');
  });

  it('deletes items, including their media', async () => {
    const db = await createTestDb();
    const id = await addPhoto(db, bytes(10), 'image/jpeg', 1);
    await deleteItem(db, id);
    expect(await listItems(db)).toEqual([]);
    expect(await getMedia(db, id)).toBeNull();
  });

  it('picks one random item for the SOS flow', async () => {
    const db = await createTestDb();
    expect(await randomItem(db)).toBeNull();
    await addText(db, 'first', 1);
    await addText(db, 'second', 2);
    expect((await randomItem(db, () => 0))?.text).toBe('second');
    expect((await randomItem(db, () => 0.99))?.text).toBe('first');
  });
});
