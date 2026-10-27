import { Share } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

export async function pickTextFile() {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  let text;
  try {
    text = await new File(asset.uri).text();
  } catch {
    const r = await fetch(asset.uri);
    text = await r.text();
  }
  return { name: asset.name || 'file', text };
}

export async function shareTextFile(filename, text, mimeType) {
  try {
    const f = new File(Paths.cache, filename);
    if (f.exists) f.delete();
    f.create();
    f.write(text);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: filename });
      return;
    }
  } catch {
    // Fall through to sharing the raw text.
  }
  await Share.share({ message: text, title: filename });
}
