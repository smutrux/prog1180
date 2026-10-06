import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'
import Button from './components/button'
import StatusCard from './components/statusCard'
import { FaPlus, FaRegTrashAlt  } from 'react-icons/fa'
import { Md7kPlus } from 'react-icons/md'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <StatusCard></StatusCard>
       
    </>
  )
}

export default App
