import cls from "classnames";
import { type DetailedHTMLProps, type FC, type InputHTMLAttributes } from "react";
import { Label } from "./Label";
import { type CommonProps, Color } from "./_common";
import './_inputs.css'

type Props = Omit<DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, 'size'> & CommonProps<'flat'> & {
    label?: string
    error?: boolean
    options?: any[]
    setOptions?: (opt: any) => { label?: string, value: string }
}


const isDate = (value: any) => {

    const date = new Date(value)

    if (!isNaN(date.getTime())) {
        return date
    }

}


export const Input: FC<Props> = ({
    id,
    label,
    value = "",
    variant = "default",
    color = "primary",
    size = "full",
    type = 'text',
    required = false,
    error,
    options,
    className,
    setOptions = (opt) => ({ label: opt, value: opt }),
    ...props
}) => {


    const format = (value?: any) => {
        // console.log(value)
        value = value ?? ""

        switch (type) {
            case "date": {
                const date = isDate(value)
                if (date) {
                    value = date.toLocaleDateString('en-CA')
                }
                return value
            }
            case "datetime-local": {

                const date = isDate(value)
                if (date) {
                    value = date.toISOString().slice(0, 16)
                }
                return value
            }
            case "number":
                // console.log(id, value)
                return (value as number).toString()
            case "text":
            default:
                return value
        }
    }


    const dataList = options
        ? options.map(setOptions)
        : null


    return (
        <div
            className={cls(
                'input',
                `input--${variant}`,
                `input--${type}`,
                `input--${size}`,
                'textfield',
                className,
                Color(color, error))
            }
        >
            <Label
                color={color}
                error={error}
            >
                {label} {label && required && "*"}
            </Label>
            <input
                {...props}
                value={format(value)}
                type={type}
                className="input__control textfield__input"
                list={options ? `${id}-options` : undefined}
            />
            {dataList && (
                <datalist id={`${id}-options`}>
                    {dataList.map(({ label = null, value }, i) => (
                        <option key={value + i} value={value}>
                            {label}
                        </option>
                    ))}
                </datalist>
            )}
        </div>
    )
}