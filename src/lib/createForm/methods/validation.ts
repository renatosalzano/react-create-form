import type { FieldTypes } from "../config";
import type { FormControl } from "..";
import type { FieldSchema, FieldState } from "../types/field";


const isFieldState = (update: any): update is FieldState => {
    if (typeof update === 'object') {
        if (update.type || update.value || update.rules || update.required) {
            return true
        }
    }
    return false
}

type Schema<T extends Record<string, FieldTypes>> = { [K in keyof T]: FieldSchema<T[K], T> }

type Config<
    T extends Record<string, FieldTypes>
> = {
    register?: Schema<T>
}

type SuggestKeys<T> = keyof T | (string & {});


export const _validationMethods = <S>(api: FormControl) => {

    const validate = () => {

        api.map(field => {
            field.touched = true
            return field
        })

        const { errors } = api.getFormState()

        if (errors) {
            throw errors
        }

    }

    return {
        validate
    }
}