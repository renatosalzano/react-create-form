
export function clone<T>(object: T): T {

    if (object === null || typeof object !== 'object') {
        return object;
    }

    if (object instanceof Date) {
        return new Date(object.getTime()) as T;
    }

    if (Array.isArray(object)) {
        return object.map(item => clone(item)) as T;
    }

    const clonedObj = {} as any;

    const keys = Reflect.ownKeys(object as object)

    for (const key of keys) {

        clonedObj[key] = clone((object as any)[key])
    }

    return clonedObj;
}

export function cloneAndFreeze<T>(object: T): T {

    if (object === null || typeof object !== 'object') {
        return object;
    }

    if (object instanceof Date) {
        return Object.freeze(new Date(object.getTime())) as T;
    }

    if (Array.isArray(object)) {
        const frozenArray = object.map(item => cloneAndFreeze(item));
        return Object.freeze(frozenArray) as T;
    }

    const clonedObj = {} as any;

    const keys = Reflect.ownKeys(object as object)

    for (const key of keys) {

        clonedObj[key] = cloneAndFreeze((object as any)[key])
    }

    return Object.freeze(clonedObj);
}