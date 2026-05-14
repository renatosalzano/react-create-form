import cls from "classnames";
import { useEffect, useRef, type ButtonHTMLAttributes, type DetailedHTMLProps, type FC } from "react";
import { type CommonProps, Color } from "./_common";
import './_inputs.css'

type Props = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & CommonProps<'ghost'> & {
    icon?: boolean
}

export const Button: FC<Props> = ({
    id,
    value = "",
    variant = "default",
    size = 'md',
    color = 'primary',
    error,
    icon,
    children,
    ...props
}) => {


    return (
        <button
            className={cls(
                'button',
                `button--${variant}`,
                `button--${size}`,
                `button--${error ? 'error' : color}`,
                {
                    'button--disabled': props.disabled,
                    'button--icon': icon,
                })}
            {...props}
        >
            {children}
        </button>
    )
}