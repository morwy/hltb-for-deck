import { normalize } from '../src/utils';

describe('Other functions', () => {
    test('normalize() should make string lowercase', () => {
        expect(normalize('Far Cry')).toBe('far cry');
    });
    test('normalize() should trim the string', () => {
        expect(normalize('  Far Cry ')).toBe('far cry');
    });
    test('normalize() should remove diacritical marks', () => {
        expect(normalize('Café International')).toBe('cafe international');
    });
    test('normalize() should remove very special characters', () => {
        expect(normalize('WORLD END ECONOMiCA episode.01')).toBe(
            'world end economica episode.01'
        );
        expect(normalize('NieR:Automata™')).toBe('nier:automata');
        expect(normalize('Never Alone (Kisima Ingitchuna)')).toBe(
            'never alone (kisima ingitchuna)'
        );
    });
});
