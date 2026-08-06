import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { TelegramProvider } from './components/TelegramProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <TelegramProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </TelegramProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
