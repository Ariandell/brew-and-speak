import React from 'react';

type ButtonVariant = 'primary' | 'success' | 'outline' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    size?: 'small' | 'large' | 'default';
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    fullWidth,
    size = 'default',
    className = '',
    style,
    ...props
}) => {
    const baseClass = 'btn-modern';
    const variantClass = `btn-${variant}`;
    const sizeClass = size !== 'default' ? `btn-size-${size}` : '';

    return (
        <button
            className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
            style={{
                width: fullWidth ? '100%' : undefined,
                ...style
            }}
            {...props}
        >
            {children}
        </button>
    );
};
