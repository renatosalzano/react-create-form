import type { FieldTypes } from "../config";
import type { FormControl } from "../createForm";
import type { FieldProps, FieldSchema } from "../types/field";


const isField = (field: any): field is Field<any> => {

    if (typeof field === 'object') {
        if ("value" in field || "required" in field || "disabled" in field || "readonly" in field || "error" in field) {
            return true
        }
    }
    return false
}

type Schema<T extends Record<string, FieldTypes> = Record<string, FieldTypes>> = { [K in keyof T]: FieldSchema<T[K], T> }

type Override<
    T = {},
    S = Schema
> = { [K in keyof Omit<S, keyof T>]?: S[K] }


type SuggestKeys<T> = keyof T | (string & {});

type Init<
    T = {}
> = (fields: {
    [K in keyof T]?: Field<T[K]>
}) => void

type Field<T> = (FieldProps & {
    value?: T
}) | T


interface Register<
    T extends Record<string, FieldTypes> = Record<string, FieldTypes>,
> {
    (id: string, schema: FieldSchema): void
    (schema: { [id: string]: FieldSchema }): void
}


export const _formMethods = <S, V>(api: FormControl) => {


    const init: Init<V> = (fields) => {

        api.reset()

        api.map(field => {

            if (field.id in fields) {
                const update = fields[field.id as keyof V]
                if (isField(update)) {
                    field = { ...field, ...update }
                } else {
                    field.value = update
                }
            }

            return field
        })
    }



    const register: Register = (...args: []) => {

    }

    const disabled = (disabled = false) => {
        const schema = api.getSchema()
        for (const id of Object.keys(schema)) {
            api.setField(id, { disabled })
        }
    }

    const reset = () => {
        api.reset()
    }

    return {
        init,
        reset,
        register,
        disabled
    }
}