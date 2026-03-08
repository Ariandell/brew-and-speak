import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    style?: React.CSSProperties;
    active?: boolean;
    selectable?: boolean;
    variant?: string;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, active, selectable, variant, className = '', ...props }) => {
    const baseClass = selectable ? 'card-modern card-selectable' : 'card-modern';
    const activeClass = active ? 'card-selectable--active' : '';

    return (
        <div
            className={`${baseClass} ${activeClass} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};
