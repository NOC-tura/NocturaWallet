import RNFS from 'react-native-fs';
import type {AssetIO} from './provingAssets';

export const rnfsAssetIO: AssetIO = {
  cachePath(id: string): string {
    return `${RNFS.CachesDirectoryPath}/noctura-${id}.zkey`;
  },
  async exists(path: string): Promise<boolean> {
    return RNFS.exists(path);
  },
  async download(url: string, path: string): Promise<void> {
    const {statusCode} = await RNFS.downloadFile({fromUrl: url, toFile: path}).promise;
    if (statusCode !== 200) {
      throw new Error(`zkey download failed: HTTP ${statusCode}`);
    }
  },
  async sha256(path: string): Promise<string> {
    return (await RNFS.hash(path, 'sha256')).toLowerCase();
  },
  async remove(path: string): Promise<void> {
    await RNFS.unlink(path);
  },
};
