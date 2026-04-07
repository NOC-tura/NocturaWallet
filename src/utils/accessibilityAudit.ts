export interface A11yViolation {
  type: string;
  testID?: string;
  issue: string;
}

const INTERACTIVE_TYPES = [
  'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback',
  'Pressable', 'Switch', 'TextInput', 'Button',
];

export function auditTree(tree: {type: string; props?: Record<string, unknown>; children?: unknown[]}): A11yViolation[] {
  const violations: A11yViolation[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as {type?: string; props?: Record<string, unknown>; children?: unknown[]};
    if (typeof n.type === 'string' && INTERACTIVE_TYPES.includes(n.type)) {
      if (!n.props?.accessibilityLabel) {
        violations.push({
          type: n.type,
          testID: n.props?.testID as string | undefined,
          issue: `${n.type} missing accessibilityLabel`,
        });
      }
    }
    if (Array.isArray(n.children)) {
      n.children.forEach(walk);
    }
  }
  walk(tree);
  return violations;
}

export function auditElement(element: {type: string; props?: Record<string, unknown>}): A11yViolation | null {
  if (INTERACTIVE_TYPES.includes(element.type) && !element.props?.accessibilityLabel) {
    return {
      type: element.type,
      testID: element.props?.testID as string | undefined,
      issue: `${element.type} missing accessibilityLabel`,
    };
  }
  return null;
}
