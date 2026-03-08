import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { TelegramProvider } from './components/TelegramProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <TelegramProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </TelegramProvider>
    </React.StrictMode>,
)
