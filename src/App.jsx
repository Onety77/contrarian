import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Home from './pages/Home'
import Manifesto from './pages/Manifesto'
import Community from './pages/Community'
import { ReadingRoom, Tracker, TestPage, GamePage } from './pages/InnerPages'

function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Layout() {
  return (
    <>
      <ScrollReset />
      <Nav />
      <Routes>
        <Route path="/"             element={<Home />} />
        <Route path="/manifesto"    element={<Manifesto />} />
        <Route path="/reading-room" element={<ReadingRoom />} />
        <Route path="/tracker"      element={<Tracker />} />
        <Route path="/test"         element={<TestPage />} />
        <Route path="/game"         element={<GamePage />} />
        <Route path="/community"    element={<Community />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
