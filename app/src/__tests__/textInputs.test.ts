import { listSourceFiles, readSource } from '../test-utils/sourceFiles';

/**
 * Safety rule 4: every text field checks for crisis words. Only SafeTextInput
 * may use React Native's TextInput directly; everything else uses it.
 */
describe('text inputs', () => {
  const others = listSourceFiles(['.tsx']).filter((f) => f !== 'components/SafeTextInput.tsx');

  it.each(others)('%s uses SafeTextInput, not TextInput', (file) => {
    expect(readSource(file)).not.toMatch(/\bTextInput\b(?![\w.])/);
  });
});
