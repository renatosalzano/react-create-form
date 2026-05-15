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



type Init<
    T = {}
> = (fields: {
    [K in keyof T]?: Field<T[K]>
}) => void

type Field<T> = (FieldProps & {
    value?: T
}) | T





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



    const register = <T extends FieldTypes>(id: string, config: FieldSchema<V, T>) => {
        api.register(id, config as any)
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