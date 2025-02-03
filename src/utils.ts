export const normalize = (str: string) => {
    return str
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{Zs}]/gu, ' ') // replacing any special char with a space instead of an empty string should avoid game names like "NieR:Automata™" to end up as "NieRAutomata" which will fail in HLTB search
        .replace(/\s\s+/g, ' ') // replacing multiple whitespaces by a single space for consistency
        .trim();
};
