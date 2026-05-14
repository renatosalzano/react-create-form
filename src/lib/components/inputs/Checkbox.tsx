import cls from "classnames";
import { type DetailedHTMLProps, type FC, type InputHTMLAttributes } from "react";
import { Label } from "./Label";
import { Color, type CommonProps } from "./_common";
import './_inputs.css'

type InputProps = Omit<DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>, 'size'> & CommonProps

type Props = InputProps & {
    label?: string
    color?: 'primary' | 'error'
    error?: boolean
}

export const Checkbox: FC<Props> = ({
    id,
    label,
    value = "",
    variant = "default",
    color = "primary",
    size = 'md',
    error,
    ...props
}) => {

    return (
        <div
            className={cls(
                'checkbox',
                `checkbox--${variant}`,
                `checkbox--${size}`,
                Color(color, error)
            )}
        >
            <Label
                color={color}
                error={error}
            >
                <input
                    {...props}
                    type="checkbox"
                    className="checkbox__input"
                    value={value}
                />
                {label}
            </Label>
        </div>
    )
}