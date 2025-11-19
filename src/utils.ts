export const normalize = (str: string) => {
    return str
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, ' ') // replacing any special char with a space
        .replace(/\s\s+/g, ' ') // replacing multiple whitespaces by a single space for consistency
        .trim();
};
