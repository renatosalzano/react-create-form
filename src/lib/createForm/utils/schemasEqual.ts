

export const schemasEqual = (s1: any, s2: any): boolean => {
    if (s1 === s2) return true;
    if (!s1 || !s2 || typeof s1 !== 'object' || typeof s2 !== 'object') {
        return s1 === s2;
    }

    const keys1 = Object.keys(s1);
    const keys2 = Object.keys(s2);
    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => {
        const val1 = s1[key];
        const val2 = s2[key];

        if (typeof val1 === 'function' && typeof val2 === 'function') {
            return val1.toString() === val2.toString();
        }

        if (typeof val1 === 'object' && typeof val2 === 'object') {
            return schemasEqual(val1, val2);
        }

        return val1 === val2;
    });
};