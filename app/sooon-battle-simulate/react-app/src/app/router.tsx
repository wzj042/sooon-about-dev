import { createBrowserRouter } from 'react-router-dom'

import { AboutPage } from '../pages/AboutPage'
import { GamePage } from '../pages/GamePage'
import { HomePage } from '../pages/HomePage'
import { QuestionBankPage } from '../pages/QuestionBankPage'
import { APP_BASE_URL, APP_ROUTES, normalizeRouterBasename } from './paths'

export const router = createBrowserRouter([
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
], {
  basename: normalizeRouterBasename(APP_BASE_URL),
})
