import {auditElement, auditTree} from '../accessibilityAudit';

describe('accessibilityAudit', () => {
  it('flags TouchableOpacity without accessibilityLabel', () => {
    const result = auditElement({type: 'TouchableOpacity', props: {}});
    expect(result).not.toBeNull();
    expect(result!.issue).toContain('missing accessibilityLabel');
  });

  it('passes TouchableOpacity with accessibilityLabel', () => {
    const result = auditElement({type: 'TouchableOpacity', props: {accessibilityLabel: 'Submit'}});
    expect(result).toBeNull();
  });

  it('flags TextInput without accessibilityLabel', () => {
    const result = auditElement({type: 'TextInput', props: {}});
    expect(result).not.toBeNull();
  });

  it('flags Switch without accessibilityLabel', () => {
    const result = auditElement({type: 'Switch', props: {}});
    expect(result).not.toBeNull();
  });

  it('passes non-interactive elements without label', () => {
    const result = auditElement({type: 'View', props: {}});
    expect(result).toBeNull();
  });

  it('auditTree returns violations for nested tree', () => {
    const tree = {
      type: 'View',
      props: {},
      children: [
        {type: 'TouchableOpacity', props: {testID: 'btn1'}, children: []},
        {type: 'TextInput', props: {accessibilityLabel: 'Email'}, children: []},
        {type: 'Switch', props: {}, children: []},
      ],
    };
    const violations = auditTree(tree);
    expect(violations).toHaveLength(2);
    expect(violations[0]!.testID).toBe('btn1');
  });
});
