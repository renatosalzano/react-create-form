import type { FormControl } from "../createForm";


export const _validationMethods = <S>(api: FormControl) => {

    const validate = () => {

        api.map(field => {
            field.touched = true
            return field
        })

        const { errors } = api.getFormState()

        console.log(errors)

        if (errors) {
            throw errors
        }

    }

    return {
        validate
    }
}