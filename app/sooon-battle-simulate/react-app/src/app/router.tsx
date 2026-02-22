import { createBrowserRouter, createHashRouter } from 'react-router-dom'

import { AboutPage } from '../pages/AboutPage'
import { GamePage } from '../pages/GamePage'
import { HomePage } from '../pages/HomePage'
import { QuestionBankPage } from '../pages/QuestionBankPage'
import { APP_BASE_URL, APP_ROUTES, normalizeRouterBasename } from './paths'

const routeTable = [
  {
    path: APP_ROUTES.home,
    element: <HomePage />,
  },
  {
    path: APP_ROUTES.homeHtml,
    element: <HomePage />,
  },
  {
    path: APP_ROUTES.game,
    element: <GamePage />,
  },
  {
    path: APP_ROUTES.about,
    element: <AboutPage />,
  },
  {
    path: APP_ROUTES.questionBank,
    element: <QuestionBankPage />,
  },
]

const shouldUseHashRouter = import.meta.env.PROD && import.meta.env.VITE_ROUTER_MODE !== 'browser'

export const router = shouldUseHashRouter
  ? createHashRouter(routeTable)
  : createBrowserRouter(routeTable, {
      basename: normalizeRouterBasename(APP_BASE_URL),
    })
