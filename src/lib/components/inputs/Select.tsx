import cls from "classnames";
import { type DetailedHTMLProps, type FC, type SelectHTMLAttributes } from "react";
import './_inputs.css'
import { Label } from "./Label";
import { Color, type CommonProps } from "./_common";


type SelectPrimitiveProps = Omit<DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>, 'size'>

type Props<T> = SelectPrimitiveProps & CommonProps<'default' | 'flat'> & {
    label?: string
    color?: 'primary' | 'error'
    error?: boolean
    options: T[]
    setOptions?: (opt: T) => { label: string, value: any }
}

export function Select<T>({
    id,
    label,
    variant = "default",
    color = "primary",
    size = "md",
    error,
    options = [],
    className,
    setOptions = (opt: any) => ({ label: opt, value: opt }),
    ...props
}: Props<T>) {

    // console.log(options)

    const list = options.map(setOptions)

    return (
        <div
            className={cls(
                'select',
                'input',
                `input--${variant}`,
                `select--${variant}`,
                `input--${size}`,
                className,
                Color(color, error)
            )}
        >
            <Label
                color={color}
                error={error}
            >
                {label}
            </Label>
            <select
                {...props}
                className="input__control select__input"
            >
                <option value={""}>
                    {" "}
                </option>
                {list.map(({ label, value }, index) => (
                    <option key={label + index} value={value}>
                        {label}
                    </option>
                ))}

            </select>
        </div>
    )
}