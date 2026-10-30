import * as ImagePicker from 'expo-image-picker';
import { base64ToBytes } from '../utils/base64';

export type PickedPhoto = { bytes: Uint8Array; mime: string };

export const PHOTO_QUALITY = 0.6;

/** Web demo: the browser picker keeps nothing on disk. */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: PHOTO_QUALITY,
    base64: true,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.base64) return null;
  return { bytes: base64ToBytes(asset.base64), mime: asset.mimeType ?? 'image/jpeg' };
}
