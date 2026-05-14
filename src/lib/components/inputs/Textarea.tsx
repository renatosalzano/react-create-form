import cls from "classnames";
import type { DetailedHTMLProps, FC, TextareaHTMLAttributes } from "react";
import './_inputs.css'
import { Label } from "./Label";
import { Color, type CommonProps } from "./_common";

type Props = DetailedHTMLProps<TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>
    & CommonProps<'default' | 'flat'>
    & {
        label?: string
        resize?: boolean
    }

export const Textarea: FC<Props> = ({
    id,
    label,
    value = "",
    variant = "default",
    color = 'primary',
    error,
    resize,
    ...props
}) => {

    return (
        <div className={cls(
            'input',
            'textarea',
            `input--${variant}`,
            `textarea--${variant}`,
            Color(color, error),
            {
                'textarea--resize-none': !resize
            }
        )}
        >
            <Label
                color={color}
                error={error}
            >
                {label}
            </Label>
            <textarea
                {...props}
                value={value}
                className="textarea__input"
            />
        </div>
    )
}