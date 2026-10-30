import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { base64ToBytes } from '../utils/base64';

export type PickedPhoto = { bytes: Uint8Array; mime: string };

/**
 * Lets the user choose one photo. The bytes are read into memory (base64) and
 * later saved inside the encrypted database. The picker also writes an
 * unencrypted copy to its cache folder; that copy is deleted straight away.
 *
 * `quality` must stay below 1: re-encoding is what strips EXIF data such as
 * GPS location from the bytes (`exif: false` only affects the returned object).
 */
export const PHOTO_QUALITY = 0.6;

export async function pickPhoto(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: PHOTO_QUALITY,
    base64: true,
    exif: false,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  try {
    return asset.base64
      ? { bytes: base64ToBytes(asset.base64), mime: asset.mimeType ?? 'image/jpeg' }
      : null;
  } finally {
    const copy = new File(asset.uri);
    if (copy.exists) copy.delete();
  }
}
