import type { FieldTypes } from "../config";
import type { FormControl } from "../createForm";
import type { FieldProps, FieldSchema, FieldState } from "../types/field";



type SuggestKeys<T> = keyof T | (string & {});

interface Get<T> {
    (): { [K in SuggestKeys<T>]: K extends keyof T ? T[K] : unknown }
}

interface Set<T> {
    <K extends SuggestKeys<T>>(id: K, value?: K extends keyof T ? T[K] : unknown): void
}

type SetFieldState<T> = (fields: { [K in keyof T]?: Field<T[K]> }) => void

type Field<T> = (FieldProps & {
    value?: T
}) | T

export const _fieldMethods = <V>(api: FormControl) => {

    const get: Get<V> = () => {
        return api.get() as any
    }

    const set: Set<V> = (id, value) => {
        api.set(id as string, value)
    }

    const setFieldState: SetFieldState<V> = (fields) => {
        api.map((field) => {
            if (field.id in fields) {
                field = { ...field, ...fields[field.id as keyof V] }
            }
            return field
        })
    }

    return {
        get,
        set,
        setFieldState
    }
}