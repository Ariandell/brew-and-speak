import React, { createContext, useContext, useEffect, useState } from 'react';

// Simplified types for Telegram Web App
export interface WebAppUser {
    id: number;
    is_bot?: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
}

export interface TelegramContextType {
    webApp: any | null;
    user: WebAppUser | null;
    ready: boolean;
}

const TelegramContext = createContext<TelegramContextType>({
    webApp: null,
    user: null,
    ready: false,
});

export const useTelegram = () => useContext(TelegramContext);

export const TelegramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [webApp, setWebApp] = useState<any | null>(null);
    const [user, setUser] = useState<WebAppUser | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // @ts-ignore
        const app = window.Telegram?.WebApp;

        if (app) {
            app.ready();
            app.expand(); // Expand to full height

            setWebApp(app);

            // Try to get user from initDataUnsafe
            const tgUser = app.initDataUnsafe?.user;

            if (tgUser) {
                setUser(tgUser as WebAppUser);
            } else {
                // Fallback for local development outside Telegram
                console.warn('Telegram WebApp initialized but no user found in initDataUnsafe. Using demo-user fallback.');
                setUser({
                    id: 1,
                    first_name: 'Demo',
                    username: 'demo_user',
                } as unknown as WebAppUser);
            }

            // Apply Telegram theme dynamically to root CSS variables
            if (app.colorScheme === 'dark') {
                const root = document.documentElement;
                root.style.setProperty('--color-bg-main', app.themeParams.secondary_bg_color || '#000000');
                root.style.setProperty('--color-surface', app.themeParams.bg_color || '#1c1c1d');
                root.style.setProperty('--color-text-main', app.themeParams.text_color || '#ffffff');
                root.style.setProperty('--color-text-muted', app.themeParams.hint_color || '#aaaaaa');
                root.style.setProperty('--color-border', '#333333');
            } else if (app.themeParams) {
                const root = document.documentElement;
                // Light mode overrides if provided by Telegram
                if (app.themeParams.secondary_bg_color) root.style.setProperty('--color-bg-main', app.themeParams.secondary_bg_color);
                if (app.themeParams.bg_color) root.style.setProperty('--color-surface', app.themeParams.bg_color);
                if (app.themeParams.text_color) root.style.setProperty('--color-text-main', app.themeParams.text_color);
                if (app.themeParams.hint_color) root.style.setProperty('--color-text-muted', app.themeParams.hint_color);
            }

        } else {
            console.warn('Telegram WebApp SDK not found.');
            // Development fallback
            setUser({
                id: 1,
                first_name: 'Demo (Web)',
                username: 'demo_web',
            } as unknown as WebAppUser);
        }

        setReady(true);
    }, []);

    return (
        <TelegramContext.Provider value={{ webApp, user, ready }}>
            {children}
        </TelegramContext.Provider>
    );
};

// Helper hook to get the normalized User ID (real TG ID, or 'demo-user' for local)
export const useUserId = () => {
    const { user } = useTelegram();
    // If we have a real TG user, use their ID. If we are falling back to our mock ID (1), use 'demo-user'.
    if (user && user.id !== 1) {
        return user.id.toString();
    }
    return 'demo-user';
};

// Helper hook to check if the current user is an admin
export const useIsAdmin = () => {
    const { user } = useTelegram();
    if (!user) return true; // Default true in local dev without tg sdk (optional, but safe for testing)
    const adminUsernames = ['Olia16', 'ARIANDEL21', 'demo_user'];
    return adminUsernames.includes(user.username || '');
};
