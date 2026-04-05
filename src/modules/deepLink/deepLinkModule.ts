import type {DeepLinkAction} from './types';

type ActionCallback = (action: DeepLinkAction) => void;

export class DeepLinkManager {
  private callback: ActionCallback | null = null;

  initialize(): void {
    // In production: Linking.addEventListener('url', ({url}) => this.handleLink(url))
    // Stub for now — real Linking integration requires native setup
  }

  handleLink(url: string): DeepLinkAction | null {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();

    // Referral universal link
    if (trimmed.startsWith('https://noc-tura.io/ref/')) {
      const code = trimmed.replace('https://noc-tura.io/ref/', '');
      if (!code) return null;
      const action: DeepLinkAction = {type: 'referral', params: {code}};
      this.dispatch(action);
      return action;
    }

    // Must be noctura:// scheme
    if (!trimmed.startsWith('noctura://')) return null;

    const withoutScheme = trimmed.replace('noctura://', '');
    const [pathPart, queryPart] = withoutScheme.split('?');
    const params: Record<string, string> = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    // SECURITY: reject mnemonic in URL
    if (pathPart === 'import' || params.mnemonic) {
      const action: DeepLinkAction = {
        type: 'rejected',
        params: {},
        reason: 'For security, import your wallet manually in Settings',
      };
      this.dispatch(action);
      return action;
    }

    switch (pathPart) {
      case 'pay': {
        const a: DeepLinkAction = {type: 'pay', params};
        this.dispatch(a);
        return a;
      }
      case 'receive': {
        const a: DeepLinkAction = {type: 'receive', params: {}};
        this.dispatch(a);
        return a;
      }
      case 'stake': {
        const a: DeepLinkAction = {type: 'stake', params};
        this.dispatch(a);
        return a;
      }
      case 'presale': {
        const a: DeepLinkAction = {type: 'presale', params};
        this.dispatch(a);
        return a;
      }
      default:
        return null;
    }
  }

  onAction(callback: ActionCallback): void {
    this.callback = callback;
  }

  private dispatch(action: DeepLinkAction): void {
    this.callback?.(action);
  }
}
