import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import Bingo from './pages/bingo'
import { maincolor } from './constants/color'
import Header from './components/header/header'
import Keno from './pages/keno'
import Home from './pages/home'
//import Blackjack from './pages/blackjack'

//import LuckyChicken from './components/luckychicken'
//import Plinko from './components/plinko'
import logo from './assets/logo.png'

import SignInPage from './pages/signin'
import { useAuthStore } from './store/authStore'

function App() {
  const { isAuthenticated } = useAuthStore()



  return (
    <BrowserRouter>
      {isAuthenticated && (
        <Header
          name='abissinia bet'
          logo={logo}
          CompanyColor={maincolor}
          pages={['Bingo', 'Keno']} />
      )}
      <Routes>
        {!isAuthenticated ? (
          <>
            <Route path="/" element={<SignInPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/home" />} />
            <Route path="/home" element={<Home />} />
            <Route path="/bingo" element={<Bingo />} />
            <Route path="/Keno" element={<Keno />} />
            {/* <Route path="/Aviator" element={<Aviator />} />
            <Route path="/aviator" element={<Aviator />} />
            <Route path="/blackjack" element={<Blackjack />} />
            <Route path="/luckychicken" element={<LuckyChicken />} />
            <Route path="/plinko" element={<Plinko />} />*/}
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
