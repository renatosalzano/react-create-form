const isObject = (value: any): value is Object => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isArray = (value: any): value is Array<any> => {
    return Array.isArray(value)
}

const isUndefined = (value: any): value is undefined => {
    return value === undefined || value === null
}

const isNumber = (value: any): value is Number => {
    return typeof value === 'number'
}

export const is = {
    object: isObject,
    array: isArray,
    undefined: isUndefined,
    number: isNumber
}
