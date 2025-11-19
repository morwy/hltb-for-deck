import { normalize } from '../src/utils';

describe('Other functions', () => {
    test('normalize() should make string lowercase', () => {
        expect(normalize('Far Cry')).toBe('far cry');
        expect(normalize('Café International')).toBe('café international');
    });
    test('normalize() should trim the string', () => {
        expect(normalize('  Far Cry ')).toBe('far cry');
    });
    test('normalize() should allow non-latin characters', () => {
        expect(normalize('יום פתוח (Open Day)')).toBe('יום פתוח open day');
        expect(normalize('AL QMRAH RESTAURANT - مطبخ القمرة')).toBe(
            'al qmrah restaurant مطبخ القمرة'
        );
        expect(normalize('Симулятор Прыгания по Гаражам')).toBe(
            'симулятор прыгания по гаражам'
        );
        expect(
            normalize('ポーラー エクスプローラー: 北極への VR そり遊び')
        ).toBe('ポーラー エクスプローラー 北極への vr そり遊び');
        expect(normalize('苍白花树繁茂之时Blood Flowers')).toBe(
            '苍白花树繁茂之时blood flowers'
        );
    });
    test('normalize() should remove very special characters', () => {
        expect(normalize('WORLD END ECONOMiCA episode.01')).toBe(
            'world end economica episode 01'
        );
        expect(normalize('NieR:Automata™')).toBe('nier automata');
        expect(normalize('Never Alone (Kisima Ingitchuna)')).toBe(
            'never alone kisima ingitchuna'
        );
    });
});
