import cls from "classnames";
import type { DetailedHTMLProps, FC, LabelHTMLAttributes, ReactNode } from "react";
import { Color, type CommonProps } from "./_common";
import './_inputs.css'

type Props = DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>
    & Omit<CommonProps, 'variant'>
    & {
        children: ReactNode
    }

export const Label: FC<Props> = ({
    children,
    size,
    color,
    error,
    ...props
}) => {

    return (
        <label
            {...props}
            className={
                cls("field-label", Color(color, error),
                    {
                        'hidden': !children
                    }
                )}
        >
            {children}
        </label>
    )
}