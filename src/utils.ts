export const normalize = (str: string) => {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ') // replacing any special char with a space instead of an empty string should avoid game names like "NieR:Automata™" to end up as "NieRAutomata" which will fail in HLTB search
        .replace(/\s\s+/g, ' ') // replacing multiple whitespaces by a single space for consistency
        .trim();
};
